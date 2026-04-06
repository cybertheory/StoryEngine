import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  anthropicMessages,
  DEFAULT_ANTHROPIC_MODEL,
  getAnthropicApiKey,
  unwrapJsonFromMarkdown,
} from "./lib/anthropic";
import {
  STORYOBJECT_SCENE_ANCHOR_DEFAULT_NAME,
  STORYOBJECT_SCENE_ANCHOR_DESCRIPTION,
  STORYOBJECT_SCENE_ANCHOR_TAG,
} from "./lib/sceneAnchorConstants";

const BATCH_SIZE = 10;
const USER_AGENT = "StoryObject/1.0 (Fandom Import Pipeline)";

const importStatusValidator = v.union(
  v.literal("pending"),
  v.literal("discovering"),
  v.literal("processing"),
  v.literal("linking"),
  v.literal("completed"),
  v.literal("failed")
);

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  character: [
    "characters",
    "individuals",
    "people",
    "heroes",
    "villains",
    "protagonists",
    "antagonists",
    "males",
    "females",
    "cast",
  ],
  place: [
    "locations",
    "places",
    "planets",
    "cities",
    "countries",
    "regions",
    "buildings",
    "worlds",
    "realms",
    "landmarks",
  ],
  item: [
    "items",
    "objects",
    "weapons",
    "artifacts",
    "tools",
    "vehicles",
    "ships",
    "equipment",
    "relics",
    "potions",
  ],
  faction: [
    "factions",
    "organizations",
    "groups",
    "teams",
    "houses",
    "clans",
    "species",
    "races",
    "guilds",
    "families",
    "tribes",
  ],
  lore: [
    "lore",
    "history",
    "magic",
    "abilities",
    "powers",
    "concepts",
    "mythology",
    "spells",
    "technology",
    "sciences",
  ],
  event_type: [
    "events",
    "battles",
    "wars",
    "conflicts",
    "ceremonies",
    "incidents",
    "campaigns",
    "missions",
    "quests",
  ],
};

function matchCategoryToKind(categoryName: string): string | null {
  const lower = categoryName.toLowerCase();
  for (const [kind, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return kind;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
// INTERNAL QUERIES
// ═══════════════════════════════════════════════════════════

export const getImportInternal = internalQuery({
  args: { importId: v.id("fandomImports") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.importId);
  },
});

export const countRemainingPages = internalQuery({
  args: { importId: v.id("fandomImports") },
  handler: async (ctx, args) => {
    const queued = await ctx.db
      .query("fandomPages")
      .withIndex("by_import_status", (q) =>
        q.eq("importId", args.importId).eq("status", "queued")
      )
      .collect();
    const processing = await ctx.db
      .query("fandomPages")
      .withIndex("by_import_status", (q) =>
        q.eq("importId", args.importId).eq("status", "processing")
      )
      .collect();
    return queued.length + processing.length;
  },
});

export const getCompletedPagesWithRelationships = internalQuery({
  args: { importId: v.id("fandomImports") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("fandomPages")
      .withIndex("by_import_status", (q) =>
        q.eq("importId", args.importId).eq("status", "completed")
      )
      .collect();
  },
});

// ═══════════════════════════════════════════════════════════
// INTERNAL MUTATIONS
// ═══════════════════════════════════════════════════════════

export const createImportRecord = internalMutation({
  args: {
    wikiId: v.string(),
    wikiName: v.string(),
    wikiUrl: v.string(),
    wikiImageUrl: v.optional(v.string()),
    wikiDescription: v.string(),
    createdBy: v.id("users"),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const slug = args.wikiName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const existing = await ctx.db
      .query("fandomImports")
      .withIndex("by_wiki", (q) => q.eq("wikiId", args.wikiId))
      .first();
    if (existing && existing.status !== "failed") {
      throw new Error(
        `Import already exists for ${args.wikiName} (status: ${existing.status})`
      );
    }

    let finalSlug = slug;
    let attempt = 0;
    while (true) {
      const slugExists = await ctx.db
        .query("universes")
        .withIndex("by_slug", (q) => q.eq("slug", finalSlug))
        .first();
      if (!slugExists) break;
      attempt++;
      finalSlug = `${slug}-${attempt}`;
    }

    const universeName = args.wikiName
      .replace(/ Wiki$/i, "")
      .replace(/ Fandom$/i, "");
    const allTags = [...args.tags, "fandom-import"];

    const universeId = await ctx.db.insert("universes", {
      name: universeName,
      slug: finalSlug,
      description: args.wikiDescription,
      coverUrl: args.wikiImageUrl,
      creatorId: args.createdBy,
      tags: allTags,
      visibility: "public",
      objectCount: 1,
      storyCount: 0,
      forkCount: 0,
      likeCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("objects", {
      universeId,
      kind: "lore",
      name: STORYOBJECT_SCENE_ANCHOR_DEFAULT_NAME,
      description: STORYOBJECT_SCENE_ANCHOR_DESCRIPTION,
      tags: [STORYOBJECT_SCENE_ANCHOR_TAG],
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    for (const tag of allTags) {
      const tagSlug = tag.toLowerCase().replace(/\s+/g, "-");
      const existingTag = await ctx.db
        .query("tags")
        .withIndex("by_slug", (q) => q.eq("slug", tagSlug))
        .unique();
      if (existingTag) {
        await ctx.db.patch(existingTag._id, {
          universeCount: existingTag.universeCount + 1,
        });
      } else {
        await ctx.db.insert("tags", {
          name: tag,
          slug: tagSlug,
          universeCount: 1,
        });
      }
    }

    const importId = await ctx.db.insert("fandomImports", {
      wikiId: args.wikiId,
      wikiName: args.wikiName,
      wikiUrl: args.wikiUrl,
      wikiImageUrl: args.wikiImageUrl,
      universeId,
      createdBy: args.createdBy,
      status: "pending",
      totalPages: 0,
      processedPages: 0,
      failedPages: 0,
      objectsCreated: 0,
      relationshipsCreated: 0,
      createdAt: now,
      updatedAt: now,
    });

    return importId;
  },
});

export const updateImport = internalMutation({
  args: {
    importId: v.id("fandomImports"),
    status: v.optional(importStatusValidator),
    totalPages: v.optional(v.number()),
    processedPages: v.optional(v.number()),
    failedPages: v.optional(v.number()),
    objectsCreated: v.optional(v.number()),
    relationshipsCreated: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { importId, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined)
    );
    await ctx.db.patch(importId, {
      ...filtered,
      updatedAt: Date.now(),
    });
  },
});

export const queuePages = internalMutation({
  args: {
    importId: v.id("fandomImports"),
    universeId: v.id("universes"),
    pages: v.array(
      v.object({
        pageId: v.number(),
        pageTitle: v.string(),
        category: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let queued = 0;

    for (const page of args.pages) {
      const existing = await ctx.db
        .query("fandomPages")
        .withIndex("by_universe_title", (q) =>
          q
            .eq("universeId", args.universeId)
            .eq("pageTitle", page.pageTitle)
        )
        .first();
      if (existing) continue;

      await ctx.db.insert("fandomPages", {
        importId: args.importId,
        universeId: args.universeId,
        pageId: page.pageId,
        pageTitle: page.pageTitle,
        category: page.category,
        status: "queued",
        createdAt: now,
        updatedAt: now,
      });
      queued++;
    }

    return queued;
  },
});

export const grabPageBatch = internalMutation({
  args: {
    importId: v.id("fandomImports"),
    batchSize: v.number(),
  },
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("fandomPages")
      .withIndex("by_import_status", (q) =>
        q.eq("importId", args.importId).eq("status", "queued")
      )
      .take(args.batchSize);

    const now = Date.now();
    for (const page of pages) {
      await ctx.db.patch(page._id, { status: "processing", updatedAt: now });
    }

    return pages;
  },
});

export const savePageResult = internalMutation({
  args: {
    pageDocId: v.id("fandomPages"),
    importId: v.id("fandomImports"),
    universeId: v.id("universes"),
    createdBy: v.id("users"),
    kind: v.union(
      v.literal("character"),
      v.literal("place"),
      v.literal("item"),
      v.literal("faction"),
      v.literal("lore"),
      v.literal("event_type")
    ),
    name: v.string(),
    description: v.string(),
    imageUrl: v.optional(v.string()),
    metadata: v.optional(v.any()),
    tags: v.array(v.string()),
    pendingRelationships: v.optional(
      v.array(
        v.object({
          targetName: v.string(),
          label: v.string(),
          bidirectional: v.optional(v.boolean()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const objectId = await ctx.db.insert("objects", {
      universeId: args.universeId,
      kind: args.kind,
      name: args.name,
      description: args.description,
      imageUrl: args.imageUrl,
      metadata: args.metadata,
      tags: args.tags,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    const universe = await ctx.db.get(args.universeId);
    if (universe) {
      await ctx.db.patch(args.universeId, {
        objectCount: universe.objectCount + 1,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.pageDocId, {
      status: "completed" as const,
      objectId,
      pendingRelationships: args.pendingRelationships,
      updatedAt: now,
    });

    const imp = await ctx.db.get(args.importId);
    if (imp) {
      await ctx.db.patch(args.importId, {
        processedPages: imp.processedPages + 1,
        objectsCreated: imp.objectsCreated + 1,
        updatedAt: now,
      });
    }

    return objectId;
  },
});

export const markPageFailed = internalMutation({
  args: {
    pageDocId: v.id("fandomPages"),
    importId: v.id("fandomImports"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.pageDocId, {
      status: "failed" as const,
      error: args.error,
      updatedAt: now,
    });
    const imp = await ctx.db.get(args.importId);
    if (imp) {
      await ctx.db.patch(args.importId, {
        failedPages: imp.failedPages + 1,
        processedPages: imp.processedPages + 1,
        updatedAt: now,
      });
    }
  },
});

export const markPageSkipped = internalMutation({
  args: {
    pageDocId: v.id("fandomPages"),
    importId: v.id("fandomImports"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.pageDocId, {
      status: "skipped" as const,
      updatedAt: now,
    });
    const imp = await ctx.db.get(args.importId);
    if (imp) {
      await ctx.db.patch(args.importId, {
        processedPages: imp.processedPages + 1,
        updatedAt: now,
      });
    }
  },
});

export const batchCreateRelationships = internalMutation({
  args: {
    importId: v.id("fandomImports"),
    universeId: v.id("universes"),
    relationships: v.array(
      v.object({
        sourceId: v.id("objects"),
        targetId: v.id("objects"),
        label: v.string(),
        description: v.optional(v.string()),
        bidirectional: v.optional(v.boolean()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let created = 0;
    for (const rel of args.relationships) {
      const existing = await ctx.db
        .query("relationships")
        .withIndex("by_source", (q) => q.eq("sourceId", rel.sourceId))
        .filter((q) =>
          q.and(
            q.eq(q.field("targetId"), rel.targetId),
            q.eq(q.field("label"), rel.label)
          )
        )
        .first();
      if (existing) continue;

      await ctx.db.insert("relationships", {
        universeId: args.universeId,
        sourceId: rel.sourceId,
        targetId: rel.targetId,
        label: rel.label,
        description: rel.description,
        bidirectional: rel.bidirectional,
      });
      created++;
    }

    const imp = await ctx.db.get(args.importId);
    if (imp) {
      await ctx.db.patch(args.importId, {
        relationshipsCreated: imp.relationshipsCreated + created,
        updatedAt: Date.now(),
      });
    }

    return created;
  },
});

// ═══════════════════════════════════════════════════════════
// INTERNAL ACTIONS
// ═══════════════════════════════════════════════════════════

export const discoverPages = internalAction({
  args: {
    importId: v.id("fandomImports"),
    maxPages: v.number(),
  },
  handler: async (ctx, args) => {
    const imp = await ctx.runQuery(
      internal.fandomPipeline.getImportInternal,
      { importId: args.importId }
    );
    if (!imp) throw new Error("Import not found");

    await ctx.runMutation(internal.fandomPipeline.updateImport, {
      importId: args.importId,
      status: "discovering",
    });

    const baseUrl = imp.wikiUrl.replace(/\/$/, "");
    const apiUrl = `${baseUrl}/api.php`;

    try {
      // Discover categories on this wiki
      const categoriesResp = await fetch(
        `${apiUrl}?action=query&list=allcategories&aclimit=500&format=json`,
        { headers: { "User-Agent": USER_AGENT } }
      );

      if (!categoriesResp.ok) {
        throw new Error(
          `Failed to fetch categories: ${categoriesResp.status}`
        );
      }

      const categoriesData = (await categoriesResp.json()) as {
        query?: { allcategories?: Array<{ "*"?: string; title?: string }> };
      };
      const allCategories: string[] = (
        categoriesData.query?.allcategories || []
      ).map((c) => c["*"] || c.title || "");

      const relevantCategories: { name: string; kind: string }[] = [];
      for (const cat of allCategories) {
        const kind = matchCategoryToKind(cat);
        if (kind) {
          relevantCategories.push({ name: cat, kind });
        }
      }

      const allPages: {
        pageId: number;
        pageTitle: string;
        category?: string;
      }[] = [];
      const seenTitles = new Set<string>();

      // Fetch pages from a category, recursing into subcategories up to depth limit
      async function fetchCategoryPages(
        catName: string,
        kind: string,
        depth: number
      ) {
        if (depth > 2 || allPages.length >= args.maxPages) return;

        // First, try to get direct page members
        let pageCount = 0;
        let cmcontinue: string | undefined;
        do {
          const params = new URLSearchParams({
            action: "query",
            list: "categorymembers",
            cmtitle: `Category:${catName}`,
            cmlimit: "500",
            cmtype: "page",
            format: "json",
          });
          if (cmcontinue) params.set("cmcontinue", cmcontinue);

          const resp = await fetch(`${apiUrl}?${params}`, {
            headers: { "User-Agent": USER_AGENT },
          });
          if (!resp.ok) break;

          const data = (await resp.json()) as {
            query?: {
              categorymembers?: Array<{
                pageid: number;
                title: string;
              }>;
            };
            continue?: { cmcontinue?: string };
          };
          const members = data.query?.categorymembers || [];

          for (const m of members) {
            if (allPages.length >= args.maxPages) return;
            const title = m.title;
            if (seenTitles.has(title)) continue;
            if (title.includes(":")) continue;
            seenTitles.add(title);
            allPages.push({
              pageId: m.pageid,
              pageTitle: title,
              category: kind,
            });
            pageCount++;
          }

          cmcontinue = data.continue?.cmcontinue;
        } while (cmcontinue && allPages.length < args.maxPages);

        // If the category had few/no direct pages, recurse into subcategories
        if (pageCount < 5 && allPages.length < args.maxPages) {
          const subParams = new URLSearchParams({
            action: "query",
            list: "categorymembers",
            cmtitle: `Category:${catName}`,
            cmlimit: "50",
            cmtype: "subcat",
            format: "json",
          });
          const subResp = await fetch(`${apiUrl}?${subParams}`, {
            headers: { "User-Agent": USER_AGENT },
          });
          if (subResp.ok) {
            const subData = (await subResp.json()) as {
              query?: {
                categorymembers?: Array<{ title: string }>;
              };
            };
            const subcats = subData.query?.categorymembers || [];
            for (const sub of subcats) {
              if (allPages.length >= args.maxPages) break;
              const subName = sub.title.replace(/^Category:/, "");
              await fetchCategoryPages(subName, kind, depth + 1);
            }
          }
        }
      }

      // Enumerate pages from relevant categories (with subcategory recursion)
      if (relevantCategories.length > 0) {
        for (const cat of relevantCategories) {
          if (allPages.length >= args.maxPages) break;
          await fetchCategoryPages(cat.name, cat.kind, 0);
        }
      }

      // Fallback: grab all pages if category discovery yielded few results
      if (allPages.length < 20) {
        let apcontinue: string | undefined;
        do {
          const params = new URLSearchParams({
            action: "query",
            list: "allpages",
            aplimit: "500",
            format: "json",
          });
          if (apcontinue) params.set("apcontinue", apcontinue);

          const resp = await fetch(`${apiUrl}?${params}`, {
            headers: { "User-Agent": USER_AGENT },
          });
          if (!resp.ok) break;

          const data = (await resp.json()) as {
            query?: {
              allpages?: Array<{ pageid: number; title: string }>;
            };
            continue?: { apcontinue?: string };
          };
          const pages = data.query?.allpages || [];

          for (const p of pages) {
            if (allPages.length >= args.maxPages) break;
            const title = p.title;
            if (seenTitles.has(title)) continue;
            if (title.includes(":")) continue;
            seenTitles.add(title);
            allPages.push({ pageId: p.pageid, pageTitle: title });
          }

          apcontinue = data.continue?.apcontinue;
        } while (apcontinue && allPages.length < args.maxPages);
      }

      if (allPages.length === 0) {
        await ctx.runMutation(internal.fandomPipeline.updateImport, {
          importId: args.importId,
          status: "failed",
          error: "No pages found on this wiki",
        });
        return;
      }

      // Queue pages in batches (mutations have document write limits)
      const QUEUE_BATCH = 50;
      for (let i = 0; i < allPages.length; i += QUEUE_BATCH) {
        const batch = allPages.slice(i, i + QUEUE_BATCH);
        await ctx.runMutation(internal.fandomPipeline.queuePages, {
          importId: args.importId,
          universeId: imp.universeId,
          pages: batch,
        });
      }

      await ctx.runMutation(internal.fandomPipeline.updateImport, {
        importId: args.importId,
        status: "processing",
        totalPages: allPages.length,
      });

      // Kick off the first processing batch — each batch schedules the next
      await ctx.scheduler.runAfter(
        0,
        internal.fandomPipeline.processPageBatch,
        { importId: args.importId }
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Discovery failed";
      await ctx.runMutation(internal.fandomPipeline.updateImport, {
        importId: args.importId,
        status: "failed",
        error: message,
      });
    }
  },
});

export const processPageBatch = internalAction({
  args: { importId: v.id("fandomImports") },
  handler: async (ctx, args) => {
    const imp = await ctx.runQuery(
      internal.fandomPipeline.getImportInternal,
      { importId: args.importId }
    );
    if (!imp) return;
    if (imp.status === "failed" || imp.status === "completed") return;

    // Atomically grab a batch of queued pages
    const pages = await ctx.runMutation(
      internal.fandomPipeline.grabPageBatch,
      { importId: args.importId, batchSize: BATCH_SIZE }
    );

    if (pages.length === 0) {
      const remaining = await ctx.runQuery(
        internal.fandomPipeline.countRemainingPages,
        { importId: args.importId }
      );
      if (remaining === 0) {
        await ctx.scheduler.runAfter(
          0,
          internal.fandomPipeline.resolveRelationships,
          { importId: args.importId }
        );
      }
      return;
    }

    const baseUrl = imp.wikiUrl.replace(/\/$/, "");

    // Process all pages in the batch concurrently
    await Promise.all(
      pages.map((page: Doc<"fandomPages">) =>
        processOnePage(ctx, {
          page: {
            _id: page._id,
            pageTitle: page.pageTitle,
            category: page.category,
          },
          importId: args.importId,
          universeId: imp.universeId,
          createdBy: imp.createdBy,
          baseUrl,
          wikiName: imp.wikiName,
        }).catch(async (error: unknown) => {
          const message =
            error instanceof Error ? error.message : "Processing failed";
          await ctx.runMutation(internal.fandomPipeline.markPageFailed, {
            pageDocId: page._id,
            importId: args.importId,
            error: message,
          });
        })
      )
    );

    // Schedule the next batch with a small delay for rate-limiting
    await ctx.scheduler.runAfter(
      2000,
      internal.fandomPipeline.processPageBatch,
      { importId: args.importId }
    );
  },
});

export const resolveRelationships = internalAction({
  args: { importId: v.id("fandomImports") },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.fandomPipeline.updateImport, {
      importId: args.importId,
      status: "linking",
    });

    const imp = await ctx.runQuery(
      internal.fandomPipeline.getImportInternal,
      { importId: args.importId }
    );
    if (!imp) return;

    const pages = await ctx.runQuery(
      internal.fandomPipeline.getCompletedPagesWithRelationships,
      { importId: args.importId }
    );

    // Build name → objectId lookup (case-insensitive)
    const nameToObjectId = new Map<string, Id<"objects">>();
    for (const page of pages) {
      if (page.objectId) {
        nameToObjectId.set(page.pageTitle.toLowerCase(), page.objectId);
      }
    }

    const LINK_BATCH = 25;
    let batch: Array<{
      sourceId: Id<"objects">;
      targetId: Id<"objects">;
      label: string;
      bidirectional?: boolean;
    }> = [];

    for (const page of pages) {
      if (!page.objectId || !page.pendingRelationships) continue;

      for (const rel of page.pendingRelationships) {
        const targetId = nameToObjectId.get(rel.targetName.toLowerCase());
        if (!targetId) continue;
        if (targetId === page.objectId) continue;

        batch.push({
          sourceId: page.objectId,
          targetId,
          label: rel.label,
          bidirectional: rel.bidirectional,
        });

        if (batch.length >= LINK_BATCH) {
          await ctx.runMutation(
            internal.fandomPipeline.batchCreateRelationships,
            {
              importId: args.importId,
              universeId: imp.universeId,
              relationships: batch,
            }
          );
          batch = [];
        }
      }
    }

    if (batch.length > 0) {
      await ctx.runMutation(
        internal.fandomPipeline.batchCreateRelationships,
        {
          importId: args.importId,
          universeId: imp.universeId,
          relationships: batch,
        }
      );
    }

    await ctx.runMutation(internal.fandomPipeline.updateImport, {
      importId: args.importId,
      status: "completed",
    });
  },
});

// ═══════════════════════════════════════════════════════════
// HELPERS (run inside actions, not exported as Convex functions)
// ═══════════════════════════════════════════════════════════

type ActionCtx = {
  runMutation: typeof Function.prototype;
  runQuery: typeof Function.prototype;
};

async function processOnePage(
  ctx: ActionCtx,
  args: {
    page: {
      _id: Id<"fandomPages">;
      pageTitle: string;
      category?: string;
    };
    importId: Id<"fandomImports">;
    universeId: Id<"universes">;
    createdBy: Id<"users">;
    baseUrl: string;
    wikiName: string;
  }
) {
  const { page, importId, universeId, createdBy, baseUrl, wikiName } = args;

  // Fetch raw wikitext + categories via revisions API (confirmed working on Fandom)
  const queryParams = new URLSearchParams({
    action: "query",
    titles: page.pageTitle,
    prop: "revisions|categories",
    rvprop: "content",
    rvslots: "main",
    cllimit: "50",
    format: "json",
  });
  const queryResp = await fetch(`${baseUrl}/api.php?${queryParams}`, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!queryResp.ok) {
    throw new Error(`MediaWiki API error: ${queryResp.status}`);
  }

  const queryData = (await queryResp.json()) as {
    error?: { info?: string };
    query?: {
      pages?: Record<
        string,
        {
          missing?: string;
          revisions?: Array<{
            slots?: { main?: { "*"?: string } };
            "*"?: string;
          }>;
          categories?: Array<{ title?: string }>;
        }
      >;
    };
  };
  if (queryData.error) {
    throw new Error(`MediaWiki: ${queryData.error.info}`);
  }

  const pages = queryData.query?.pages || {};
  const pageData = Object.values(pages)[0];
  if (!pageData || "missing" in pageData) {
    throw new Error(`Page not found: ${page.pageTitle}`);
  }

  const revision = pageData.revisions?.[0];
  const wikitext =
    revision?.slots?.main?.["*"] || revision?.["*"] || "";
  const categories = (pageData.categories || []).map(
    (c) => (c.title || "").replace(/^Category:/, "")
  );

  if (!wikitext || wikitext.length < 50) {
    await ctx.runMutation(internal.fandomPipeline.markPageSkipped, {
      pageDocId: page._id,
      importId,
    });
    return;
  }

  // Try to fetch the page's main image
  const imageUrl = await getPageImage(baseUrl, page.pageTitle);

  // Truncate for the LLM context window
  const truncatedContent =
    wikitext.length > 8000
      ? wikitext.slice(0, 8000) + "\n[... content truncated ...]"
      : wikitext;

  const extracted = await callLLM(
    truncatedContent,
    page.pageTitle,
    wikiName,
    categories,
    page.category
  );

  if (!extracted || extracted.skip) {
    await ctx.runMutation(internal.fandomPipeline.markPageSkipped, {
      pageDocId: page._id,
      importId,
    });
    return;
  }

  await ctx.runMutation(internal.fandomPipeline.savePageResult, {
    pageDocId: page._id,
    importId,
    universeId,
    createdBy,
    kind: extracted.kind,
    name: extracted.name,
    description: extracted.description,
    imageUrl,
    metadata: extracted.metadata,
    tags: extracted.tags,
    pendingRelationships: extracted.relationships,
  });
}

async function getPageImage(
  baseUrl: string,
  pageTitle: string
): Promise<string | undefined> {
  try {
    const params = new URLSearchParams({
      action: "query",
      titles: pageTitle,
      prop: "pageimages",
      piprop: "original",
      format: "json",
    });
    const resp = await fetch(`${baseUrl}/api.php?${params}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!resp.ok) return undefined;
    const data = (await resp.json()) as {
      query?: { pages?: Record<string, { original?: { source?: string } }> };
    };
    const pages = data.query?.pages || {};
    const first = Object.values(pages)[0];
    return first?.original?.source;
  } catch {
    return undefined;
  }
}

interface LLMExtraction {
  skip?: boolean;
  kind: "character" | "place" | "item" | "faction" | "lore" | "event_type";
  name: string;
  description: string;
  metadata: Record<string, unknown>;
  tags: string[];
  relationships: Array<{
    targetName: string;
    label: string;
    bidirectional?: boolean;
  }>;
}

async function callLLM(
  wikitext: string,
  pageTitle: string,
  wikiName: string,
  categories: string[],
  hintKind?: string
): Promise<LLMExtraction | null> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not set — add it via `npx convex env set ANTHROPIC_API_KEY <key>`"
    );
  }

  const kindHint = hintKind
    ? `\nCategory hint from the wiki structure: "${hintKind}" — use this as a starting point but override if the content clearly says otherwise.`
    : "";

  const systemPrompt = `You are an entity extraction system for StoryObject, a storytelling/worldbuilding platform.

Given a wiki page from the "${wikiName}" fandom wiki, extract a structured entity.

Classify the page into EXACTLY ONE type:
- character: A person, creature, or sentient being
- place: A location, region, building, planet, or geographical feature
- item: An object, weapon, artifact, vehicle, tool, or consumable
- faction: A group, organization, team, species, house, or political entity
- lore: A concept, magic system, historical era, prophecy, or rule of the world
- event_type: A specific plot event, battle, ceremony, or incident
${kindHint}
Wiki categories on this page: ${categories.join(", ")}

Respond with ONLY valid JSON (no markdown fences):
{
  "skip": false,
  "kind": "character|place|item|faction|lore|event_type",
  "name": "Canonical name",
  "description": "A vivid 2-4 sentence description capturing essence, significance, and most interesting aspects. Write compelling worldbuilding prose, not a dry encyclopedia entry.",
  "tags": ["lowercase-hyphenated", "relevant", "tags"],
  "metadata": {
    // Extract ALL meaningful structured attributes from infoboxes, stat blocks, and prose.
    // character: aliases, titles, species, gender, age, occupation, abilities, weapons, affiliations, status, first_appearance, personality_traits
    // place: type, region, climate, population, notable_features, rulers, dangers
    // item: type, creator, powers, materials, current_holder, history, rarity
    // faction: type, leader, headquarters, goals, motto, notable_members, size, alignment
    // lore: type, origin, effects, rules, practitioners
    // event_type: date_or_era, location, participants, outcome, significance, casualties
  },
  "relationships": [
    {
      "targetName": "Exact page-title name of a related entity",
      "label": "relationship (e.g. 'ally of', 'located in', 'member of', 'created by')",
      "bidirectional": false
    }
  ]
}

If the page is a meta/admin page, disambiguation, redirect, list, or not a meaningful story entity, respond: {"skip": true}

Rules:
- Extract up to 10 most significant relationships
- Descriptions should be vivid and narrative
- Tags: lowercase, hyphenated
- Use the most common/canonical name
- metadata: be exhaustive — extract every detail from infoboxes and prose`;

  const userContent = `Page title: ${pageTitle}\n\nWikitext content:\n${wikitext}`;

  const llm = await anthropicMessages({
    apiKey,
    model: DEFAULT_ANTHROPIC_MODEL,
    system: systemPrompt,
    user: userContent,
    maxTokens: 8192,
    temperature: 0.3,
  });

  if (!llm.ok) {
    throw new Error(`Anthropic API error ${llm.status}: ${llm.message}`);
  }

  const content = unwrapJsonFromMarkdown(llm.text);
  if (!content) throw new Error("Empty LLM response");

  try {
    const parsed = JSON.parse(content) as LLMExtraction;
    if (parsed.skip) return parsed;

    const validKinds = [
      "character",
      "place",
      "item",
      "faction",
      "lore",
      "event_type",
    ];
    if (!validKinds.includes(parsed.kind)) {
      parsed.kind = "lore";
    }

    parsed.tags = (parsed.tags || [])
      .map((t: string) => t.toLowerCase().replace(/\s+/g, "-"))
      .slice(0, 20);

    parsed.relationships = (parsed.relationships || []).slice(0, 10);

    return parsed;
  } catch {
    throw new Error("Failed to parse LLM JSON response");
  }
}
