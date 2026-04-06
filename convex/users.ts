import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

function stripSecrets(user: Doc<"users"> | null) {
  if (!user) return null;
  const { passwordHash: _p, ...rest } = user;
  return rest;
}

export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const u = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    return stripSecrets(u);
  },
});

export const getById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const u = await ctx.db.get(args.id);
    return stripSecrets(u);
  },
});

export const upsert = mutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    username: v.optional(v.string()),
    avatar: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        username: args.username,
        avatar: args.avatar,
      });
      return existing._id;
    }

    return ctx.db.insert("users", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const updateProfile = mutation({
  args: {
    id: v.id("users"),
    name: v.optional(v.string()),
    bio: v.optional(v.string()),
    username: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});
