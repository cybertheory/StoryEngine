import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  getViewerUserId,
  canViewUniverse,
  canViewStory,
} from "./lib/access";
import {
  assertSceneEventsNonOverlapping,
  envelopeTicks,
  flattenSceneEventsForDb,
} from "./lib/workspaceModel";

const CHAPTER_SCENE_DEFAULT_DURATION = 24;
const CHAPTER_SCENE_GAP = 4;

/** Timeline row order for the unified scene workspace (notepad, canvas, beats). */
const WORKSPACE_EVENT_ORDER = 0;

/** Next start tick for a new scene appended to this chapter (sequential default track). */
async function nextChapterTimelineStart(
  ctx: MutationCtx,
  chapterId: Id<"chapters">
): Promise<number> {
  const scenes = await ctx.db
    .query("scenes")
    .withIndex("by_chapter", (q) => q.eq("chapterId", chapterId))
    .collect();
  scenes.sort((a, b) => a.order - b.order);
  let cursor = 0;
  for (const s of scenes) {
    const st = s.chapterTimelineStart;
    const dur = s.chapterTimelineDuration;
    if (st !== undefined && dur !== undefined) {
      cursor = Math.max(cursor, st + dur + CHAPTER_SCENE_GAP);
    } else {
      cursor += CHAPTER_SCENE_DEFAULT_DURATION + CHAPTER_SCENE_GAP;
    }
  }
  return cursor;
}

async function assertStoryAuthorForStoryId(
  ctx: MutationCtx,
  storyId: Id<"stories">,
  sessionToken: string
) {
  const viewerId = await getViewerUserId(ctx, sessionToken);
  if (!viewerId) throw new Error("Sign in required.");
  const story = await ctx.db.get(storyId);
  if (!story || story.authorId !== viewerId) {
    throw new Error("You can’t edit this story.");
  }
  return story;
}

async function assertStoryAuthorForChapterId(
  ctx: MutationCtx,
  chapterId: Id<"chapters">,
  sessionToken: string
) {
  const chapter = await ctx.db.get(chapterId);
  if (!chapter) throw new Error("Chapter not found.");
  await assertStoryAuthorForStoryId(ctx, chapter.storyId, sessionToken);
  return chapter;
}

async function assertStoryAuthorForSceneId(
  ctx: MutationCtx,
  sceneId: Id<"scenes">,
  sessionToken: string
) {
  const scene = await ctx.db.get(sceneId);
  if (!scene) throw new Error("Scene not found.");
  await assertStoryAuthorForChapterId(ctx, scene.chapterId, sessionToken);
  return scene;
}

export const listByUniverse = query({
  args: {
    universeId: v.id("universes"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const universe = await ctx.db.get(args.universeId);
    if (!universe) return [];
    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    if (!canViewUniverse(universe, viewerId)) return [];

    const rows = await ctx.db
      .query("stories")
      .withIndex("by_universe", (q) => q.eq("universeId", args.universeId))
      .order("desc")
      .collect();
    return rows.filter((s) => canViewStory(s, viewerId));
  },
});

export const listByAuthor = query({
  args: {
    authorId: v.id("users"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    const raw = await ctx.db
      .query("stories")
      .withIndex("by_author", (q) => q.eq("authorId", args.authorId))
      .order("desc")
      .collect();

    const out: Array<Doc<"stories"> & { universeSlug: string }> = [];
    for (const s of raw) {
      const u = await ctx.db.get(s.universeId);
      if (!u) continue;
      if (!canViewUniverse(u, viewerId)) continue;
      if (!canViewStory(s, viewerId)) continue;
      out.push(Object.assign({}, s, { universeSlug: u.slug }));
    }
    return out;
  },
});

export const getById = query({
  args: {
    id: v.id("stories"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.id);
    if (!story) return null;
    const universe = await ctx.db.get(story.universeId);
    if (!universe) return null;
    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    if (!canViewUniverse(universe, viewerId)) return null;
    if (!canViewStory(story, viewerId)) return null;
    return story;
  },
});

/** Author-only gate for the workspace agent / canvas automation. */
export const workspaceAgentGate = query({
  args: {
    storyId: v.id("stories"),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    if (!viewerId) {
      return {
        ok: false as const,
        message: "Sign in to use the workbench agent.",
      };
    }
    const story = await ctx.db.get(args.storyId);
    if (!story) {
      return { ok: false as const, message: "Story not found." };
    }
    const universe = await ctx.db.get(story.universeId);
    if (!universe) {
      return { ok: false as const, message: "Universe not found." };
    }
    if (!canViewUniverse(universe, viewerId)) {
      return { ok: false as const, message: "You can’t access this universe." };
    }
    if (story.authorId !== viewerId) {
      return {
        ok: false as const,
        message: "Only the story author can run the workbench agent.",
      };
    }
    return {
      ok: true as const,
      message: "",
      universeId: story.universeId,
    };
  },
});

/** Story reader bundle for `/universe/{slug}/story/{id}`. */
export const getReaderInUniverse = query({
  args: {
    universeSlug: v.string(),
    storyId: v.id("stories"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const universe = await ctx.db
      .query("universes")
      .withIndex("by_slug", (q) => q.eq("slug", args.universeSlug))
      .unique();
    if (!universe) return null;

    const story = await ctx.db.get(args.storyId);
    if (!story || story.universeId !== universe._id) return null;

    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    if (!canViewUniverse(universe, viewerId)) return null;
    if (!canViewStory(story, viewerId)) return null;

    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
      .collect();
    chapters.sort((a, b) => a.order - b.order);

    const chaptersWithReader = [];
    for (const ch of chapters) {
      const scenes = await ctx.db
        .query("scenes")
        .withIndex("by_chapter", (q) => q.eq("chapterId", ch._id))
        .collect();
      scenes.sort((a, b) => a.order - b.order);
      const readerScenes: {
        sceneId: Id<"scenes">;
        title: string;
        order: number;
        proseText: string;
        proseGenerated: boolean;
      }[] = [];
      for (const sc of scenes) {
        const evs = await ctx.db
          .query("events")
          .withIndex("by_scene", (q) => q.eq("sceneId", sc._id))
          .collect();
        const ws = evs.find((e) => e.order === WORKSPACE_EVENT_ORDER);
        readerScenes.push({
          sceneId: sc._id,
          title: sc.title,
          order: sc.order,
          proseText: (ws?.proseText ?? "").trim(),
          proseGenerated: Boolean(ws?.proseGenerated),
        });
      }
      chaptersWithReader.push({ ...ch, readerScenes });
    }

    return { story, universe, chapters: chaptersWithReader };
  },
});

export const create = mutation({
  args: {
    sessionToken: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    universeId: v.id("universes"),
    visibility: v.union(
      v.literal("public"),
      v.literal("private"),
      v.literal("unlisted")
    ),
    forkedFromId: v.optional(v.id("stories")),
  },
  handler: async (ctx, args) => {
    const authorId = await getViewerUserId(ctx, args.sessionToken);
    if (!authorId) {
      throw new Error("You must be signed in to create a story.");
    }

    const universe = await ctx.db.get(args.universeId);
    if (!universe) {
      throw new Error("Universe not found.");
    }
    if (!canViewUniverse(universe, authorId)) {
      throw new Error("You don’t have access to this universe.");
    }

    const now = Date.now();
    const id = await ctx.db.insert("stories", {
      title: args.title,
      description: args.description,
      universeId: args.universeId,
      authorId,
      visibility: args.visibility,
      forkedFromId: args.forkedFromId,
      likeCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.universeId, {
      storyCount: universe.storyCount + 1,
    });

    const chapterId = await ctx.db.insert("chapters", {
      storyId: id,
      title: "Chapter 1",
      order: 0,
      createdAt: now,
    });

    await ctx.db.insert("scenes", {
      chapterId,
      title: "Scene 1",
      order: 0,
      cameraX: 0,
      cameraY: 0,
      cameraZoom: 1,
      cameraWidth: 800,
      cameraHeight: 600,
      createdAt: now,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("stories"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    visibility: v.optional(
      v.union(
        v.literal("public"),
        v.literal("private"),
        v.literal("unlisted")
      )
    ),
  },
  handler: async (ctx, args) => {
    await assertStoryAuthorForStoryId(ctx, args.id, args.sessionToken);
    const { sessionToken: _t, id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined)
    );
    if (Object.keys(filtered).length === 0) return;
    await ctx.db.patch(id, { ...filtered, updatedAt: Date.now() });
  },
});

// --- Chapters ---

export const listChapters = query({
  args: {
    storyId: v.id("stories"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story) return [];
    const universe = await ctx.db.get(story.universeId);
    if (!universe) return [];
    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    if (!canViewUniverse(universe, viewerId)) return [];
    if (!canViewStory(story, viewerId)) return [];

    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
      .collect();
    chapters.sort((a, b) => a.order - b.order);
    return chapters;
  },
});

/** Chapters with nested scenes (single round-trip). Same visibility as listChapters. */
export const listChaptersWithScenes = query({
  args: {
    storyId: v.id("stories"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story) return [];
    const universe = await ctx.db.get(story.universeId);
    if (!universe) return [];
    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    if (!canViewUniverse(universe, viewerId)) return [];
    if (!canViewStory(story, viewerId)) return [];

    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
      .collect();
    chapters.sort((a, b) => a.order - b.order);

    const out: Array<
      Doc<"chapters"> & {
        scenes: Doc<"scenes">[];
      }
    > = [];

    for (const ch of chapters) {
      const scenes = await ctx.db
        .query("scenes")
        .withIndex("by_chapter", (q) => q.eq("chapterId", ch._id))
        .collect();
      scenes.sort((a, b) => a.order - b.order);
      out.push({ ...ch, scenes });
    }

    return out;
  },
});

export const createChapter = mutation({
  args: {
    sessionToken: v.string(),
    storyId: v.id("stories"),
    title: v.string(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    await assertStoryAuthorForStoryId(ctx, args.storyId, args.sessionToken);
    return ctx.db.insert("chapters", {
      storyId: args.storyId,
      title: args.title,
      order: args.order,
      createdAt: Date.now(),
    });
  },
});

export const updateChapter = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("chapters"),
    title: v.optional(v.string()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertStoryAuthorForChapterId(ctx, args.id, args.sessionToken);
    const { sessionToken: _t, id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

// --- Scenes ---

export const listScenes = query({
  args: { chapterId: v.id("chapters") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("scenes")
      .withIndex("by_chapter", (q) => q.eq("chapterId", args.chapterId))
      .collect();
  },
});

export const createScene = mutation({
  args: {
    sessionToken: v.string(),
    chapterId: v.id("chapters"),
    title: v.string(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    await assertStoryAuthorForChapterId(ctx, args.chapterId, args.sessionToken);
    const timelineStart = await nextChapterTimelineStart(ctx, args.chapterId);
    return ctx.db.insert("scenes", {
      chapterId: args.chapterId,
      title: args.title,
      order: args.order,
      chapterTimelineStart: timelineStart,
      chapterTimelineDuration: CHAPTER_SCENE_DEFAULT_DURATION,
      cameraX: 0,
      cameraY: 0,
      cameraZoom: 1,
      cameraWidth: 800,
      cameraHeight: 600,
      createdAt: Date.now(),
    });
  },
});

/** Fills missing chapter timeline fields with sequential defaults; keeps explicit ranges (overlap OK). */
export const ensureChapterSceneTimelineDefaults = mutation({
  args: {
    sessionToken: v.string(),
    chapterId: v.id("chapters"),
  },
  handler: async (ctx, args) => {
    await assertStoryAuthorForChapterId(ctx, args.chapterId, args.sessionToken);
    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_chapter", (q) => q.eq("chapterId", args.chapterId))
      .collect();
    scenes.sort((a, b) => a.order - b.order);
    let cursor = 0;
    for (const s of scenes) {
      const st = s.chapterTimelineStart;
      const dur = s.chapterTimelineDuration;
      if (st !== undefined && dur !== undefined) {
        cursor = Math.max(cursor, st + dur + CHAPTER_SCENE_GAP);
      } else {
        await ctx.db.patch(s._id, {
          chapterTimelineStart: cursor,
          chapterTimelineDuration: CHAPTER_SCENE_DEFAULT_DURATION,
        });
        cursor += CHAPTER_SCENE_DEFAULT_DURATION + CHAPTER_SCENE_GAP;
      }
    }
  },
});

export const updateScene = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("scenes"),
    title: v.optional(v.string()),
    order: v.optional(v.number()),
    chapterTimelineStart: v.optional(v.number()),
    chapterTimelineDuration: v.optional(v.number()),
    cameraX: v.optional(v.number()),
    cameraY: v.optional(v.number()),
    cameraZoom: v.optional(v.number()),
    cameraWidth: v.optional(v.number()),
    cameraHeight: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertStoryAuthorForSceneId(ctx, args.id, args.sessionToken);
    const { sessionToken: _t, id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

/** Ensures every chapter has at least one scene (author-only). Fixes legacy stories. */
export const ensureDefaultScenes = mutation({
  args: {
    sessionToken: v.string(),
    storyId: v.id("stories"),
  },
  handler: async (ctx, args) => {
    await assertStoryAuthorForStoryId(ctx, args.storyId, args.sessionToken);
    const now = Date.now();
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
      .collect();
    chapters.sort((a, b) => a.order - b.order);

    if (chapters.length === 0) {
      const chapterId = await ctx.db.insert("chapters", {
        storyId: args.storyId,
        title: "Chapter 1",
        order: 0,
        createdAt: now,
      });
      await ctx.db.insert("scenes", {
        chapterId,
        title: "Scene 1",
        order: 0,
        chapterTimelineStart: 0,
        chapterTimelineDuration: CHAPTER_SCENE_DEFAULT_DURATION,
        cameraX: 0,
        cameraY: 0,
        cameraZoom: 1,
        cameraWidth: 800,
        cameraHeight: 600,
        createdAt: now,
      });
      return;
    }

    for (const ch of chapters) {
      const existing = await ctx.db
        .query("scenes")
        .withIndex("by_chapter", (q) => q.eq("chapterId", ch._id))
        .collect();
      if (existing.length === 0) {
        await ctx.db.insert("scenes", {
          chapterId: ch._id,
          title: "Scene 1",
          order: 0,
          chapterTimelineStart: 0,
          chapterTimelineDuration: CHAPTER_SCENE_DEFAULT_DURATION,
          cameraX: 0,
          cameraY: 0,
          cameraZoom: 1,
          cameraWidth: 800,
          cameraHeight: 600,
          createdAt: now,
        });
      }
    }
  },
});

// --- Events ---

export const listEvents = query({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("events")
      .withIndex("by_scene", (q) => q.eq("sceneId", args.sceneId))
      .collect();
  },
});

export const createEvent = mutation({
  args: {
    sceneId: v.id("scenes"),
    order: v.number(),
    startTick: v.number(),
    duration: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("events", {
      ...args,
      objectPlacements: [],
      interactions: [],
      createdAt: Date.now(),
    });
  },
});

export const updateEvent = mutation({
  args: {
    id: v.id("events"),
    startTick: v.optional(v.number()),
    duration: v.optional(v.number()),
    order: v.optional(v.number()),
    objectPlacements: v.optional(
      v.array(
        v.object({
          objectId: v.id("objects"),
          x: v.number(),
          y: v.number(),
          scale: v.optional(v.number()),
        })
      )
    ),
    interactions: v.optional(
      v.array(
        v.object({
          sourceObjectId: v.id("objects"),
          targetObjectId: v.id("objects"),
          label: v.string(),
          style: v.union(
            v.literal("solid"),
            v.literal("dashed"),
            v.literal("wavy"),
            v.literal("dotted")
          ),
        })
      )
    ),
    proseText: v.optional(v.string()),
    proseGenerated: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const deleteEvent = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

const MIN_WORKSPACE_TIMELINE_TICKS = 100;

const workspacePlacementValidator = v.object({
  objectId: v.id("objects"),
  x: v.number(),
  y: v.number(),
  scale: v.optional(v.number()),
});

const WORKSPACE_MODEL_VERSION = 2;

const workspaceEdgeValidator = v.object({
  edgeId: v.string(),
  sourceObjectId: v.id("objects"),
  targetObjectId: v.id("objects"),
  label: v.string(),
  style: v.union(
    v.literal("solid"),
    v.literal("dashed"),
    v.literal("wavy"),
    v.literal("dotted")
  ),
  interactionMeaning: v.optional(v.string()),
});

const workspaceNestedInteractionValidator = v.object({
  interactionId: v.string(),
  startTick: v.number(),
  duration: v.number(),
  /** Stacked beats on the same object row when intervals overlap. */
  timelineLane: v.optional(v.number()),
  lineIndexInEvent: v.optional(v.number()),
  linePlaybackStart: v.optional(v.number()),
  linePlaybackEnd: v.optional(v.number()),
  edges: v.array(workspaceEdgeValidator),
});

const workspaceSceneEventValidator = v.object({
  eventId: v.string(),
  startTick: v.number(),
  duration: v.number(),
  order: v.optional(v.number()),
  interactions: v.array(workspaceNestedInteractionValidator),
});

/** Single workspace bundle per scene (order 0): notepad, placements, beats — same data as timeline/prose/canvas. */
export const getSceneWorkspace = query({
  args: {
    sceneId: v.id("scenes"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scene = await ctx.db.get(args.sceneId);
    if (!scene) return null;
    const chapter = await ctx.db.get(scene.chapterId);
    if (!chapter) return null;
    const st = await ctx.db.get(chapter.storyId);
    if (!st) return null;
    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    if (!canViewStory(st, viewerId)) return null;

    const events = await ctx.db
      .query("events")
      .withIndex("by_scene", (q) => q.eq("sceneId", args.sceneId))
      .collect();
    const workspace = events
      .filter((e) => e.order === WORKSPACE_EVENT_ORDER)
      .sort((a, b) => a.order - b.order)[0];
    return workspace ?? null;
  },
});

export const ensureSceneWorkspace = mutation({
  args: {
    sceneId: v.id("scenes"),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    if (!viewerId) {
      throw new ConvexError("Sign in to edit the workspace.");
    }
    const scene = await ctx.db.get(args.sceneId);
    if (!scene) throw new ConvexError("Scene not found.");
    const chapter = await ctx.db.get(scene.chapterId);
    if (!chapter) throw new ConvexError("Chapter not found.");
    const st = await ctx.db.get(chapter.storyId);
    if (!st || st.authorId !== viewerId) {
      throw new ConvexError("Only the story author can edit this workspace.");
    }

    const existing = await ctx.db
      .query("events")
      .withIndex("by_scene", (q) => q.eq("sceneId", args.sceneId))
      .collect();
    const has = existing.some((e) => e.order === WORKSPACE_EVENT_ORDER);
    if (has) {
      return existing.find((e) => e.order === WORKSPACE_EVENT_ORDER)!._id;
    }

    const now = Date.now();
    return ctx.db.insert("events", {
      sceneId: args.sceneId,
      order: WORKSPACE_EVENT_ORDER,
      startTick: 0,
      duration: MIN_WORKSPACE_TIMELINE_TICKS,
      workspaceModelVersion: WORKSPACE_MODEL_VERSION,
      sceneEvents: [],
      objectPlacements: [],
      interactions: [],
      notepadText: "",
      workspacePlayheadTick: 0,
      createdAt: now,
    });
  },
});

export const saveSceneWorkspace = mutation({
  args: {
    sceneId: v.id("scenes"),
    sessionToken: v.string(),
    eventId: v.id("events"),
    notepadText: v.string(),
    workspacePlayheadTick: v.number(),
    objectPlacements: v.array(workspacePlacementValidator),
    sceneEvents: v.array(workspaceSceneEventValidator),
    /** Compiled reader-facing prose (workspace + optional AI); persisted for story reader. */
    proseText: v.optional(v.string()),
    proseGenerated: v.optional(v.boolean()),
    aiProseByEventId: v.optional(v.record(v.string(), v.string())),
    proseAiSourceSig: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const viewerId = await getViewerUserId(ctx, args.sessionToken);
    if (!viewerId) {
      throw new ConvexError("Sign in to save the workspace.");
    }
    const scene = await ctx.db.get(args.sceneId);
    if (!scene) throw new ConvexError("Scene not found.");
    const chapter = await ctx.db.get(scene.chapterId);
    if (!chapter) throw new ConvexError("Chapter not found.");
    const st = await ctx.db.get(chapter.storyId);
    if (!st || st.authorId !== viewerId) {
      throw new ConvexError("Only the story author can save this workspace.");
    }

    const ev = await ctx.db.get(args.eventId);
    if (!ev || ev.sceneId !== args.sceneId) {
      throw new ConvexError("Workspace event mismatch.");
    }

    try {
      assertSceneEventsNonOverlapping(args.sceneEvents);
    } catch (e) {
      throw new ConvexError(
        e instanceof Error ? e.message : "Invalid scene timeline."
      );
    }

    const storedInteractions = flattenSceneEventsForDb(args.sceneEvents);
    const { startTick, duration } = envelopeTicks(
      args.sceneEvents,
      MIN_WORKSPACE_TIMELINE_TICKS
    );

    await ctx.db.patch(args.eventId, {
      notepadText: args.notepadText,
      workspacePlayheadTick: args.workspacePlayheadTick,
      objectPlacements: args.objectPlacements,
      sceneEvents: args.sceneEvents,
      workspaceModelVersion: WORKSPACE_MODEL_VERSION,
      interactions: storedInteractions,
      startTick,
      duration,
      ...(args.proseText !== undefined ? { proseText: args.proseText } : {}),
      ...(args.proseGenerated !== undefined
        ? { proseGenerated: args.proseGenerated }
        : {}),
      ...(args.aiProseByEventId !== undefined
        ? { aiProseByEventId: args.aiProseByEventId }
        : {}),
      proseAiSourceSig: args.proseAiSourceSig,
    });
  },
});
