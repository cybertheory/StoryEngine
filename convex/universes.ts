import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getViewerUserId, canViewUniverse } from "./lib/access";
import {
  STORYOBJECT_SCENE_ANCHOR_DEFAULT_NAME,
  STORYOBJECT_SCENE_ANCHOR_DESCRIPTION,
  STORYOBJECT_SCENE_ANCHOR_TAG,
} from "./lib/sceneAnchorConstants";

export const list = query({
  args: {
    visibility: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const vis = (args.visibility ?? "public") as
      | "public"
      | "private"
      | "unlisted";
    return ctx.db
      .query("universes")
      .withIndex("by_visibility", (idx) => idx.eq("visibility", vis))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const trending = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return ctx.db
      .query("universes")
      .withIndex("by_likes")
      .order("desc")
      .filter((q) => q.eq(q.field("visibility"), "public"))
      .take(args.limit ?? 20);
  },
});

export const featured = query({
  handler: async (ctx) => {
    const u = await ctx.db
      .query("universes")
      .withIndex("by_featured", (q) => q.eq("featured", true))
      .first();
    if (!u || u.visibility !== "public") return null;
    return u;
  },
});

export const getBySlug = query({
  args: {
    slug: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const u = await ctx.db
      .query("universes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!u) return null;
    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    if (!canViewUniverse(u, viewerId)) return null;
    return u;
  },
});

export const getById = query({
  args: {
    id: v.id("universes"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const u = await ctx.db.get(args.id);
    if (!u) return null;
    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    if (!canViewUniverse(u, viewerId)) return null;
    return u;
  },
});

export const byTag = query({
  args: { tag: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("universes")
      .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
      .order("desc")
      .take(200);
    return all.filter((u) => u.tags.includes(args.tag)).slice(0, args.limit ?? 20);
  },
});

export const byCreator = query({
  args: {
    creatorId: v.id("users"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("universes")
      .withIndex("by_creator", (q) => q.eq("creatorId", args.creatorId))
      .order("desc")
      .collect();
    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    if (viewerId === args.creatorId) return all;
    return all.filter((u) => u.visibility === "public");
  },
});

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("universes")
      .withSearchIndex("search_universes", (q) =>
        q.search("name", args.query).eq("visibility", "public")
      )
      .take(20);
  },
});

/** Public universes plus any the viewer owns (private / unlisted / public), for picking a world to write in. */
export const listForStoryPicker = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    if (!viewerId) {
      throw new Error("You must be signed in.");
    }

    const publicUniverses = await ctx.db
      .query("universes")
      .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
      .order("desc")
      .take(200);

    const ownedUniverses = await ctx.db
      .query("universes")
      .withIndex("by_creator", (q) => q.eq("creatorId", viewerId))
      .collect();

    const byId = new Map<string, Doc<"universes">>();
    for (const u of publicUniverses) {
      if (canViewUniverse(u, viewerId)) {
        byId.set(u._id, u);
      }
    }
    for (const u of ownedUniverses) {
      if (canViewUniverse(u, viewerId)) {
        byId.set(u._id, u);
      }
    }

    return [...byId.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  },
});

/** Search public universes by name plus filter the viewer’s own worlds by name/description. */
export const searchForStoryPicker = query({
  args: { sessionToken: v.string(), query: v.string() },
  handler: async (ctx, args) => {
    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    if (!viewerId) {
      throw new Error("You must be signed in.");
    }

    const q = args.query.trim();
    if (!q) {
      return [];
    }

    const ql = q.toLowerCase();

    const publicHits = await ctx.db
      .query("universes")
      .withSearchIndex("search_universes", (sq) =>
        sq.search("name", q).eq("visibility", "public")
      )
      .take(40);

    const owned = await ctx.db
      .query("universes")
      .withIndex("by_creator", (iq) => iq.eq("creatorId", viewerId))
      .collect();

    const ownedHits = owned.filter(
      (u) =>
        u.name.toLowerCase().includes(ql) ||
        u.description.toLowerCase().includes(ql)
    );

    const byId = new Map<string, Doc<"universes">>();
    for (const u of publicHits) {
      if (canViewUniverse(u, viewerId)) {
        byId.set(u._id, u);
      }
    }
    for (const u of ownedHits) {
      if (canViewUniverse(u, viewerId)) {
        byId.set(u._id, u);
      }
    }

    return [...byId.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  },
});

export const create = mutation({
  args: {
    sessionToken: v.string(),
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    tags: v.array(v.string()),
    visibility: v.union(
      v.literal("public"),
      v.literal("private"),
      v.literal("unlisted")
    ),
    coverUrl: v.optional(v.string()),
    forkedFromId: v.optional(v.id("universes")),
  },
  handler: async (ctx, args) => {
    const creatorId = await getViewerUserId(ctx, args.sessionToken);
    if (!creatorId) throw new Error("You must be signed in to create a universe.");

    const now = Date.now();
    const { sessionToken: _t, ...rest } = args;
    const id = await ctx.db.insert("universes", {
      ...rest,
      creatorId,
      objectCount: 1,
      storyCount: 0,
      forkCount: 0,
      likeCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("objects", {
      universeId: id,
      kind: "lore",
      name: STORYOBJECT_SCENE_ANCHOR_DEFAULT_NAME,
      description: STORYOBJECT_SCENE_ANCHOR_DESCRIPTION,
      tags: [STORYOBJECT_SCENE_ANCHOR_TAG],
      createdBy: creatorId,
      createdAt: now,
      updatedAt: now,
    });

    if (args.forkedFromId) {
      const parent = await ctx.db.get(args.forkedFromId);
      if (parent) {
        await ctx.db.patch(args.forkedFromId, {
          forkCount: parent.forkCount + 1,
        });
      }
    }

    for (const tag of args.tags) {
      const existing = await ctx.db
        .query("tags")
        .withIndex("by_slug", (q) =>
          q.eq("slug", tag.toLowerCase().replace(/\s+/g, "-"))
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          universeCount: existing.universeCount + 1,
        });
      } else {
        await ctx.db.insert("tags", {
          name: tag,
          slug: tag.toLowerCase().replace(/\s+/g, "-"),
          universeCount: 1,
        });
      }
    }

    return id;
  },
});

/**
 * Duplicate a universe you can view: new universe row + copies of all objects and
 * relationships. Stories are not copied — fork is for remixing the object graph.
 */
export const fork = mutation({
  args: {
    sessionToken: v.string(),
    parentUniverseId: v.id("universes"),
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    tags: v.array(v.string()),
    visibility: v.union(
      v.literal("public"),
      v.literal("private"),
      v.literal("unlisted")
    ),
    coverUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const creatorId = await getViewerUserId(ctx, args.sessionToken);
    if (!creatorId) {
      throw new Error("You must be signed in to fork a universe.");
    }

    const parent = await ctx.db.get(args.parentUniverseId);
    if (!parent || !canViewUniverse(parent, creatorId)) {
      throw new Error("Universe not found or not accessible.");
    }

    const slugTaken = await ctx.db
      .query("universes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (slugTaken) {
      throw new Error("That URL slug is already taken. Try a different name.");
    }

    const now = Date.now();
    const newUniverseId = await ctx.db.insert("universes", {
      name: args.name.trim(),
      slug: args.slug,
      description: args.description.trim(),
      tags: args.tags,
      visibility: args.visibility,
      coverUrl: args.coverUrl?.trim() || parent.coverUrl,
      creatorId,
      forkedFromId: parent._id,
      objectCount: 0,
      storyCount: 0,
      forkCount: 0,
      likeCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(parent._id, {
      forkCount: parent.forkCount + 1,
    });

    const objs = await ctx.db
      .query("objects")
      .withIndex("by_universe", (q) => q.eq("universeId", parent._id))
      .collect();

    const idMap = new Map<Id<"objects">, Id<"objects">>();
    for (const o of objs) {
      const newObjId = await ctx.db.insert("objects", {
        universeId: newUniverseId,
        kind: o.kind,
        name: o.name,
        description: o.description,
        imageId: o.imageId,
        imageUrl: o.imageUrl,
        metadata: o.metadata,
        tags: o.tags,
        createdBy: creatorId,
        createdAt: now,
        updatedAt: now,
      });
      idMap.set(o._id, newObjId);
    }

    const rels = await ctx.db
      .query("relationships")
      .withIndex("by_universe", (q) => q.eq("universeId", parent._id))
      .collect();

    for (const r of rels) {
      const sourceId = idMap.get(r.sourceId);
      const targetId = idMap.get(r.targetId);
      if (!sourceId || !targetId) continue;
      await ctx.db.insert("relationships", {
        universeId: newUniverseId,
        sourceId,
        targetId,
        label: r.label,
        description: r.description,
        bidirectional: r.bidirectional,
      });
    }

    await ctx.db.patch(newUniverseId, {
      objectCount: objs.length,
    });

    for (const tag of args.tags) {
      const existing = await ctx.db
        .query("tags")
        .withIndex("by_slug", (q) =>
          q.eq("slug", tag.toLowerCase().replace(/\s+/g, "-"))
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          universeCount: existing.universeCount + 1,
        });
      } else {
        await ctx.db.insert("tags", {
          name: tag,
          slug: tag.toLowerCase().replace(/\s+/g, "-"),
          universeCount: 1,
        });
      }
    }

    return newUniverseId;
  },
});

export const update = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("universes"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    visibility: v.optional(
      v.union(
        v.literal("public"),
        v.literal("private"),
        v.literal("unlisted")
      )
    ),
    coverUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    if (!viewerId) throw new Error("Unauthorized.");

    const universe = await ctx.db.get(args.id);
    if (!universe || universe.creatorId !== viewerId) {
      throw new Error("Only the creator can update this universe.");
    }

    const { sessionToken: _t, id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined)
    );
    await ctx.db.patch(id, { ...filtered, updatedAt: Date.now() });
  },
});
