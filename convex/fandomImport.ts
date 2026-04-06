import { v } from "convex/values";
import { action, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const MAX_PAGES_DEFAULT = 200;
const USER_AGENT = "StoryObject/1.0 (Fandom Import Pipeline)";

// ═══════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════

export const getImportStatus = query({
  args: { importId: v.id("fandomImports") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.importId);
  },
});

export const listImports = query({
  args: { createdBy: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("fandomImports")
      .withIndex("by_created_by", (q) => q.eq("createdBy", args.createdBy))
      .order("desc")
      .collect();
  },
});

export const listImportPages = query({
  args: {
    importId: v.id("fandomImports"),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return ctx.db
        .query("fandomPages")
        .withIndex("by_import_status", (q) =>
          q
            .eq("importId", args.importId)
            .eq(
              "status",
              args.status as
                | "queued"
                | "processing"
                | "completed"
                | "failed"
                | "skipped"
            )
        )
        .take(args.limit ?? 100);
    }
    return ctx.db
      .query("fandomPages")
      .withIndex("by_import", (q) => q.eq("importId", args.importId))
      .take(args.limit ?? 100);
  },
});

// ═══════════════════════════════════════════════════════════
// PUBLIC ACTIONS
// ═══════════════════════════════════════════════════════════

export const searchFandoms = action({
  args: { query: v.string() },
  handler: async (_ctx, args) => {
    const raw = args.query.trim();

    const urlMatch = raw.match(
      /^(?:https?:\/\/)?([a-z0-9-]+)\.fandom\.com/i
    );
    const slugsToTry: string[] = [];

    if (urlMatch) {
      slugsToTry.push(urlMatch[1].toLowerCase());
    } else {
      const lower = raw.toLowerCase();
      const candidates = [
        lower.replace(/[\s_]+/g, ""),
        lower.replace(/[\s_]+/g, "-"),
        lower.replace(/[\s_]+/g, "_"),
        lower.split(/\s+/)[0],
      ];
      const seen = new Set<string>();
      for (const s of candidates) {
        if (!seen.has(s)) {
          seen.add(s);
          slugsToTry.push(s);
        }
      }
    }

    type WikiResult = {
      id: string;
      name: string;
      url: string;
      domain: string;
      language: string;
      imageUrl: string | null;
      stats: {
        articles: number;
        pages: number;
        edits: number;
        activeUsers: number;
        images: number;
      };
    };

    const results: WikiResult[] = [];

    await Promise.all(
      slugsToTry.map(async (slug) => {
        try {
          const siteUrl = `https://${slug}.fandom.com`;
          const resp = await fetch(
            `${siteUrl}/api.php?action=query&meta=siteinfo&siprop=general|statistics&format=json`,
            { headers: { "User-Agent": USER_AGENT } }
          );
          if (!resp.ok) return;
          const data = (await resp.json()) as {
            query?: {
              general?: {
                sitename?: string;
                servername?: string;
                wikiid?: string;
                lang?: string;
                logo?: string;
              };
              statistics?: {
                articles?: number;
                pages?: number;
                edits?: number;
                activeusers?: number;
                images?: number;
              };
            };
          };
          const g = data.query?.general;
          const s = data.query?.statistics;
          if (!g?.sitename) return;

          results.push({
            id: g.wikiid || slug,
            name: g.sitename,
            url: `https://${g.servername || `${slug}.fandom.com`}`,
            domain: g.servername || `${slug}.fandom.com`,
            language: g.lang || "en",
            imageUrl: g.logo || null,
            stats: {
              articles: s?.articles ?? 0,
              pages: s?.pages ?? 0,
              edits: s?.edits ?? 0,
              activeUsers: s?.activeusers ?? 0,
              images: s?.images ?? 0,
            },
          });
        } catch {
          // slug didn't resolve
        }
      })
    );

    return results;
  },
});

export const startImport = action({
  args: {
    wikiId: v.string(),
    wikiName: v.string(),
    wikiUrl: v.string(),
    wikiImageUrl: v.optional(v.string()),
    wikiDescription: v.optional(v.string()),
    createdBy: v.id("users"),
    maxPages: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<Id<"fandomImports">> => {
    const importId: Id<"fandomImports"> = await ctx.runMutation(
      internal.fandomPipeline.createImportRecord,
      {
        wikiId: args.wikiId,
        wikiName: args.wikiName,
        wikiUrl: args.wikiUrl.replace(/\/$/, ""),
        wikiImageUrl: args.wikiImageUrl,
        wikiDescription:
          args.wikiDescription || `Imported from ${args.wikiName}`,
        createdBy: args.createdBy,
        tags: args.tags || [],
      }
    );

    await ctx.scheduler.runAfter(0, internal.fandomPipeline.discoverPages, {
      importId,
      maxPages: args.maxPages ?? MAX_PAGES_DEFAULT,
    });

    return importId;
  },
});
