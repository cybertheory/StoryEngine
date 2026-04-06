import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.optional(v.string()),
    /** bcrypt hash — never return to clients */
    passwordHash: v.optional(v.string()),
    name: v.string(),
    username: v.optional(v.string()),
    avatar: v.optional(v.string()),
    bio: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_username", ["username"])
    .index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index("by_token_hash", ["tokenHash"]),

  universes: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    coverImageId: v.optional(v.id("_storage")),
    coverUrl: v.optional(v.string()),
    creatorId: v.id("users"),
    tags: v.array(v.string()),
    visibility: v.union(
      v.literal("public"),
      v.literal("private"),
      v.literal("unlisted")
    ),
    forkedFromId: v.optional(v.id("universes")),
    objectCount: v.number(),
    storyCount: v.number(),
    forkCount: v.number(),
    likeCount: v.number(),
    featured: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_creator", ["creatorId"])
    .index("by_visibility", ["visibility"])
    .index("by_likes", ["likeCount"])
    .index("by_featured", ["featured"])
    .index("by_created", ["createdAt"])
    .searchIndex("search_universes", {
      searchField: "name",
      filterFields: ["visibility", "tags"],
    }),

  objects: defineTable({
    universeId: v.id("universes"),
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
    imageId: v.optional(v.id("_storage")),
    imageUrl: v.optional(v.string()),
    metadata: v.optional(v.any()),
    tags: v.array(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_universe", ["universeId"])
    .index("by_universe_name", ["universeId", "name"])
    .index("by_universe_kind", ["universeId", "kind"])
    .index("by_creator", ["createdBy"])
    .searchIndex("search_objects", {
      searchField: "name",
      filterFields: ["universeId", "kind"],
    }),

  relationships: defineTable({
    universeId: v.id("universes"),
    sourceId: v.id("objects"),
    targetId: v.id("objects"),
    label: v.string(),
    description: v.optional(v.string()),
    bidirectional: v.optional(v.boolean()),
  })
    .index("by_universe", ["universeId"])
    .index("by_source", ["sourceId"])
    .index("by_target", ["targetId"]),

  stories: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    coverImageId: v.optional(v.id("_storage")),
    coverUrl: v.optional(v.string()),
    universeId: v.id("universes"),
    authorId: v.id("users"),
    visibility: v.union(
      v.literal("public"),
      v.literal("private"),
      v.literal("unlisted")
    ),
    forkedFromId: v.optional(v.id("stories")),
    likeCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_universe", ["universeId"])
    .index("by_author", ["authorId"])
    .index("by_likes", ["likeCount"])
    .searchIndex("search_stories", {
      searchField: "title",
      filterFields: ["universeId", "visibility"],
    }),

  chapters: defineTable({
    storyId: v.id("stories"),
    title: v.string(),
    order: v.number(),
    createdAt: v.number(),
  }).index("by_story", ["storyId", "order"]),

  scenes: defineTable({
    chapterId: v.id("chapters"),
    title: v.string(),
    order: v.number(),
    /** Chapter-level timeline: start tick (parallel / overlap allowed). */
    chapterTimelineStart: v.optional(v.number()),
    chapterTimelineDuration: v.optional(v.number()),
    cameraX: v.number(),
    cameraY: v.number(),
    cameraZoom: v.number(),
    cameraWidth: v.number(),
    cameraHeight: v.number(),
    createdAt: v.number(),
  }).index("by_chapter", ["chapterId", "order"]),

  events: defineTable({
    sceneId: v.id("scenes"),
    order: v.number(),
    /** Bounding window for this event block (workspace uses min/max of beat ticks). */
    startTick: v.number(),
    duration: v.number(),
    /** 2 = canonical `sceneEvents`; `interactions` is a flattened mirror. */
    workspaceModelVersion: v.optional(v.number()),
    /** Narrative scene timeline: disjoint windows; each holds nested interactions + edges. */
    sceneEvents: v.optional(
      v.array(
        v.object({
          eventId: v.string(),
          startTick: v.number(),
          duration: v.number(),
          order: v.optional(v.number()),
          interactions: v.array(
            v.object({
              interactionId: v.string(),
              startTick: v.number(),
              duration: v.number(),
              timelineLane: v.optional(v.number()),
              lineIndexInEvent: v.optional(v.number()),
              linePlaybackStart: v.optional(v.number()),
              linePlaybackEnd: v.optional(v.number()),
              edges: v.array(
                v.object({
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
                })
              ),
            })
          ),
        })
      )
    ),
    objectPlacements: v.array(
      v.object({
        objectId: v.id("objects"),
        x: v.number(),
        y: v.number(),
        scale: v.optional(v.number()),
      })
    ),
    /** Flattened mirror of sceneEvents (one row per edge); legacy rows before v2. */
    interactions: v.array(
      v.object({
        beatId: v.optional(v.string()),
        sourceObjectId: v.id("objects"),
        targetObjectId: v.id("objects"),
        label: v.string(),
        style: v.union(
          v.literal("solid"),
          v.literal("dashed"),
          v.literal("wavy"),
          v.literal("dotted")
        ),
        startTick: v.optional(v.number()),
        duration: v.optional(v.number()),
        interactionMeaning: v.optional(v.string()),
        /** Legacy: global heuristic line index (pre–scene-events model). */
        lineIndex: v.optional(v.number()),
        linePlaybackStart: v.optional(v.number()),
        linePlaybackEnd: v.optional(v.number()),
        eventIndex: v.optional(v.number()),
        lineIndexInEvent: v.optional(v.number()),
        timelineLane: v.optional(v.number()),
      })
    ),
    /** Author scene notepad (source for interpret + same truth as beats below). */
    notepadText: v.optional(v.string()),
    workspacePlayheadTick: v.optional(v.number()),
    proseText: v.optional(v.string()),
    proseGenerated: v.optional(v.boolean()),
    /** AI passage per `sceneEvents[].eventId`; keyed by event id. */
    aiProseByEventId: v.optional(v.record(v.string(), v.string())),
    /** Fingerprint of notepad + placements + scene graph + tone when AI was last generated. */
    proseAiSourceSig: v.optional(v.union(v.string(), v.null())),
    createdAt: v.number(),
  }).index("by_scene", ["sceneId", "order"]),

  likes: defineTable({
    userId: v.id("users"),
    targetType: v.union(v.literal("universe"), v.literal("story")),
    targetId: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_target", ["targetType", "targetId"])
    .index("by_user_target", ["userId", "targetType", "targetId"]),

  tags: defineTable({
    name: v.string(),
    slug: v.string(),
    universeCount: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_count", ["universeCount"]),

  fandomImports: defineTable({
    wikiId: v.string(),
    wikiName: v.string(),
    wikiUrl: v.string(),
    wikiImageUrl: v.optional(v.string()),
    universeId: v.id("universes"),
    createdBy: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("discovering"),
      v.literal("processing"),
      v.literal("linking"),
      v.literal("completed"),
      v.literal("failed")
    ),
    totalPages: v.number(),
    processedPages: v.number(),
    failedPages: v.number(),
    objectsCreated: v.number(),
    relationshipsCreated: v.number(),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_universe", ["universeId"])
    .index("by_status", ["status"])
    .index("by_wiki", ["wikiId"])
    .index("by_created_by", ["createdBy"]),

  fandomPages: defineTable({
    importId: v.id("fandomImports"),
    universeId: v.id("universes"),
    pageId: v.number(),
    pageTitle: v.string(),
    category: v.optional(v.string()),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("skipped")
    ),
    objectId: v.optional(v.id("objects")),
    pendingRelationships: v.optional(
      v.array(
        v.object({
          targetName: v.string(),
          label: v.string(),
          bidirectional: v.optional(v.boolean()),
        })
      )
    ),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_import", ["importId"])
    .index("by_import_status", ["importId", "status"])
    .index("by_universe_title", ["universeId", "pageTitle"]),
});
