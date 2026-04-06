import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

const SYSTEM_CLERK_ID = "system:fandom-scraper";

function slugFromWikiUrl(url: string): string | null {
  const m = url.match(/^(?:https?:\/\/)?([a-z0-9-]+)\.fandom\.com/i);
  return m ? m[1].toLowerCase() : null;
}

export const getIndexerContext = internalQuery({
  args: {},
  handler: async (ctx) => {
    const imports = await ctx.db.query("fandomImports").collect();
    const wikiIds = new Set<string>();
    const slugs = new Set<string>();
    const names: string[] = [];

    for (const imp of imports) {
      if (imp.status === "failed") continue;
      wikiIds.add(imp.wikiId);
      const slug = slugFromWikiUrl(imp.wikiUrl);
      if (slug) slugs.add(slug);
      names.push(imp.wikiName);
    }

    return {
      wikiIds: [...wikiIds],
      indexedSlugs: [...slugs],
      wikiNamesSample: names.slice(-80),
    };
  },
});

export const hasActivePipeline = internalQuery({
  args: {},
  handler: async (ctx) => {
    for (const status of [
      "pending",
      "discovering",
      "processing",
      "linking",
    ] as const) {
      const row = await ctx.db
        .query("fandomImports")
        .withIndex("by_status", (q) => q.eq("status", status))
        .first();
      if (row) return true;
    }
    return false;
  },
});

export const ensureSystemUser = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", SYSTEM_CLERK_ID))
      .unique();
    if (existing) return existing._id;

    return ctx.db.insert("users", {
      clerkId: SYSTEM_CLERK_ID,
      name: "Fandom indexer",
      createdAt: Date.now(),
    });
  },
});
