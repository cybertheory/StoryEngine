import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getViewerUserId, canViewUniverse } from "./lib/access";
import {
  STORYOBJECT_SCENE_ANCHOR_DEFAULT_NAME,
  STORYOBJECT_SCENE_ANCHOR_DESCRIPTION,
  STORYOBJECT_SCENE_ANCHOR_TAG,
} from "./lib/sceneAnchorConstants";

const kindValidator = v.union(
  v.literal("character"),
  v.literal("place"),
  v.literal("item"),
  v.literal("faction"),
  v.literal("lore"),
  v.literal("event_type")
);

/** Kinds authors may create from the UI (excludes internal `event_type`). */
const authorKindValidator = v.union(
  v.literal("character"),
  v.literal("place"),
  v.literal("item"),
  v.literal("faction"),
  v.literal("lore")
);

export const listByUniverse = query({
  args: {
    universeId: v.id("universes"),
    kind: v.optional(kindValidator),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const universe = await ctx.db.get(args.universeId);
    if (!universe) return [];
    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    if (!canViewUniverse(universe, viewerId)) return [];

    if (args.kind) {
      return ctx.db
        .query("objects")
        .withIndex("by_universe_kind", (q) =>
          q.eq("universeId", args.universeId).eq("kind", args.kind!)
        )
        .collect();
    }
    return ctx.db
      .query("objects")
      .withIndex("by_universe", (q) => q.eq("universeId", args.universeId))
      .collect();
  },
});

const NOTEPAD_MANIFEST_CAP = 400;

/**
 * Compact, name-ordered object list for notepad LLM assist.
 * Bounded by NOTEPAD_MANIFEST_CAP so prompts stay small at scale.
 */
export const manifestForNotepadAssist = query({
  args: {
    universeId: v.id("universes"),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const universe = await ctx.db.get(args.universeId);
    if (!universe) return null;
    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    if (!canViewUniverse(universe, viewerId)) return null;

    const rows = await ctx.db
      .query("objects")
      .withIndex("by_universe_name", (q) =>
        q.eq("universeId", args.universeId)
      )
      .take(NOTEPAD_MANIFEST_CAP + 1);
    const capped = rows.length > NOTEPAD_MANIFEST_CAP;
    const slice = capped ? rows.slice(0, NOTEPAD_MANIFEST_CAP) : rows;
    const withoutAnchor = slice.filter(
      (o) => !o.tags.includes(STORYOBJECT_SCENE_ANCHOR_TAG)
    );

    return {
      objects: withoutAnchor.map((o) => ({
        name: o.name,
        kind: o.kind,
        blurb: o.description.replace(/\s+/g, " ").slice(0, 72),
      })),
      capped,
    };
  },
});

/**
 * Ensures the universe has the hidden “Ambient” object (solo-beat target). Idempotent.
 * Any signed-in viewer who can see the universe may call (e.g. story workspace load).
 */
export const ensureAmbientAnchor = mutation({
  args: {
    sessionToken: v.string(),
    universeId: v.id("universes"),
  },
  handler: async (ctx, args): Promise<{ id: Id<"objects"> }> => {
    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    if (!viewerId) {
      throw new Error("Sign in first.");
    }
    const universe = await ctx.db.get(args.universeId);
    if (!universe || !canViewUniverse(universe, viewerId)) {
      throw new Error("Universe not found.");
    }

    const all = await ctx.db
      .query("objects")
      .withIndex("by_universe", (q) => q.eq("universeId", args.universeId))
      .collect();
    const existing = all.find((o) => o.tags.includes(STORYOBJECT_SCENE_ANCHOR_TAG));
    if (existing) {
      return { id: existing._id };
    }

    const now = Date.now();
    const id = await ctx.db.insert("objects", {
      universeId: args.universeId,
      kind: "lore",
      name: STORYOBJECT_SCENE_ANCHOR_DEFAULT_NAME,
      description: STORYOBJECT_SCENE_ANCHOR_DESCRIPTION,
      tags: [STORYOBJECT_SCENE_ANCHOR_TAG],
      createdBy: viewerId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(args.universeId, {
      objectCount: universe.objectCount + 1,
      updatedAt: now,
    });
    return { id };
  },
});

export const getById = query({
  args: {
    id: v.id("objects"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const obj = await ctx.db.get(args.id);
    if (!obj) return null;
    const universe = await ctx.db.get(obj.universeId);
    if (!universe) return null;
    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    if (!canViewUniverse(universe, viewerId)) return null;
    return obj;
  },
});

/** Object detail for `/universe/{slug}/object/{id}` — enforces slug matches parent universe. */
export const getPreviewInUniverse = query({
  args: {
    universeSlug: v.string(),
    objectId: v.id("objects"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const universe = await ctx.db
      .query("universes")
      .withIndex("by_slug", (q) => q.eq("slug", args.universeSlug))
      .unique();
    if (!universe) return null;

    const obj = await ctx.db.get(args.objectId);
    if (!obj || obj.universeId !== universe._id) return null;

    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    if (!canViewUniverse(universe, viewerId)) return null;

    return { object: obj, universe };
  },
});

export const search = query({
  args: {
    query: v.string(),
    universeId: v.optional(v.id("universes")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const searchQ = ctx.db
      .query("objects")
      .withSearchIndex("search_objects", (q) => {
        const s = q.search("name", args.query);
        if (args.universeId) return s.eq("universeId", args.universeId);
        return s;
      });
    const candidates = await searchQ.take(60);
    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    const cache = new Map<string, Doc<"universes"> | null>();
    const out: Array<(typeof candidates)[number] & { universeSlug: string }> =
      [];
    for (const obj of candidates) {
      const uid = obj.universeId as string;
      let u = cache.get(uid);
      if (u === undefined) {
        u = (await ctx.db.get(obj.universeId)) as Doc<"universes"> | null;
        cache.set(uid, u);
      }
      if (!u || !canViewUniverse(u, viewerId)) continue;
      out.push(Object.assign({}, obj, { universeSlug: u.slug }));
      if (out.length >= 30) break;
    }
    return out;
  },
});

export const create = mutation({
  args: {
    universeId: v.id("universes"),
    kind: kindValidator,
    name: v.string(),
    description: v.string(),
    imageUrl: v.optional(v.string()),
    metadata: v.optional(v.any()),
    tags: v.array(v.string()),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("objects", {
      ...args,
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

    return id;
  },
});

/** Create an object in a universe — only the universe owner may call. */
export const createForUniverseOwner = mutation({
  args: {
    sessionToken: v.string(),
    universeId: v.id("universes"),
    kind: authorKindValidator,
    name: v.string(),
    description: v.string(),
    imageUrl: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    if (!viewerId) {
      throw new Error("Sign in to add objects.");
    }
    const universe = await ctx.db.get(args.universeId);
    if (!universe) {
      throw new Error("Universe not found.");
    }
    if (universe.creatorId !== viewerId) {
      throw new Error("Only the universe owner can add objects here. Fork the universe to edit your own copy.");
    }
    const name = args.name.trim();
    const description = args.description.trim();
    if (!name) {
      throw new Error("Name is required.");
    }
    const now = Date.now();
    const id = await ctx.db.insert("objects", {
      universeId: args.universeId,
      kind: args.kind,
      name,
      description,
      imageUrl: args.imageUrl,
      tags: args.tags ?? [],
      createdBy: viewerId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(args.universeId, {
      objectCount: universe.objectCount + 1,
      updatedAt: now,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("objects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    metadata: v.optional(v.any()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined)
    );
    await ctx.db.patch(id, { ...filtered, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("objects") },
  handler: async (ctx, args) => {
    const obj = await ctx.db.get(args.id);
    if (!obj) return;

    await ctx.db.delete(args.id);

    const universe = await ctx.db.get(obj.universeId);
    if (universe) {
      await ctx.db.patch(obj.universeId, {
        objectCount: Math.max(0, universe.objectCount - 1),
        updatedAt: Date.now(),
      });
    }

    const rels = await ctx.db
      .query("relationships")
      .withIndex("by_source", (q) => q.eq("sourceId", args.id))
      .collect();
    const rels2 = await ctx.db
      .query("relationships")
      .withIndex("by_target", (q) => q.eq("targetId", args.id))
      .collect();
    for (const r of [...rels, ...rels2]) {
      await ctx.db.delete(r._id);
    }
  },
});
