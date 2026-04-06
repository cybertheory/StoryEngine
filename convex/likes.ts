import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const isLiked = query({
  args: {
    userId: v.id("users"),
    targetType: v.union(v.literal("universe"), v.literal("story")),
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    const like = await ctx.db
      .query("likes")
      .withIndex("by_user_target", (q) =>
        q
          .eq("userId", args.userId)
          .eq("targetType", args.targetType)
          .eq("targetId", args.targetId)
      )
      .unique();
    return !!like;
  },
});

export const toggle = mutation({
  args: {
    userId: v.id("users"),
    targetType: v.union(v.literal("universe"), v.literal("story")),
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("likes")
      .withIndex("by_user_target", (q) =>
        q
          .eq("userId", args.userId)
          .eq("targetType", args.targetType)
          .eq("targetId", args.targetId)
      )
      .unique();

    const delta = existing ? -1 : 1;

    if (existing) {
      await ctx.db.delete(existing._id);
    } else {
      await ctx.db.insert("likes", {
        ...args,
        createdAt: Date.now(),
      });
    }

    if (args.targetType === "universe") {
      const universe = await ctx.db
        .query("universes")
        .filter((q) => q.eq(q.field("_id"), args.targetId))
        .first();
      if (universe) {
        await ctx.db.patch(universe._id, {
          likeCount: Math.max(0, universe.likeCount + delta),
        });
      }
    } else {
      const story = await ctx.db
        .query("stories")
        .filter((q) => q.eq(q.field("_id"), args.targetId))
        .first();
      if (story) {
        await ctx.db.patch(story._id, {
          likeCount: Math.max(0, story.likeCount + delta),
        });
      }
    }

    return !existing;
  },
});
