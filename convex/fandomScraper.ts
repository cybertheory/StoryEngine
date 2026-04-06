import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  anthropicMessages,
  DEFAULT_ANTHROPIC_MODEL,
  getAnthropicApiKey,
  unwrapJsonFromMarkdown,
} from "./lib/anthropic";

const USER_AGENT = "StoryObject/1.0 (Fandom Autonomous Scraper)";
const DEFAULT_MAX_PAGES = 200;

function normalizeSubdomainSlug(raw: string): string | null {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\.fandom\.com.*$/i, "")
    .replace(/[^a-z0-9-]/g, "");
  if (!s || s.length > 80) return null;
  return s;
}

type ScraperResult =
  | { ok: false; reason: string; slug?: string; message?: string }
  | {
      ok: true;
      importId: Id<"fandomImports">;
      slug: string;
      wikiName: string;
    };

export const scraperTick = internalAction({
  args: {},
  handler: async (ctx): Promise<ScraperResult> => {
    const anthropicKey = getAnthropicApiKey();
    const exaKey = process.env.EXA_API_KEY;
    if (!anthropicKey || !exaKey) {
      console.log(
        "[fandomScraper] skip: missing ANTHROPIC_API_KEY or EXA_API_KEY"
      );
      return { ok: false, reason: "missing_env" };
    }

    const busy = await ctx.runQuery(
      internal.fandomScraperInternal.hasActivePipeline,
      {}
    );
    if (busy) {
      return { ok: false, reason: "active_pipeline" };
    }

    const systemUserId = await ctx.runMutation(
      internal.fandomScraperInternal.ensureSystemUser,
      {}
    );
    const indexer = await ctx.runQuery(
      internal.fandomScraperInternal.getIndexerContext,
      {}
    );

    const blocked = new Set<string>(indexer.indexedSlugs);
    for (const id of indexer.wikiIds) {
      blocked.add(id.toLowerCase());
    }

    let slug: string | null = null;
    for (let attempt = 0; attempt < 3 && !slug; attempt++) {
      const proposed = await proposeWikiSlug(anthropicKey, indexer, attempt);
      const normalized = normalizeSubdomainSlug(proposed);
      if (!normalized || blocked.has(normalized)) continue;
      slug = normalized;
    }

    if (!slug) {
      return { ok: false, reason: "no_slug" };
    }

    const exaOk = await verifyFandomViaExa(exaKey, slug);
    if (!exaOk) {
      return { ok: false, reason: "exa_no_match", slug };
    }

    const site = await fetchFandomSiteinfo(slug);
    if (!site) {
      return { ok: false, reason: "siteinfo_failed", slug };
    }

    try {
      const importId: Id<"fandomImports"> = await ctx.runMutation(
        internal.fandomPipeline.createImportRecord,
        {
          wikiId: site.wikiId,
          wikiName: site.wikiName,
          wikiUrl: site.wikiUrl,
          wikiImageUrl: site.imageUrl,
          wikiDescription: `Imported from ${site.wikiName}`,
          createdBy: systemUserId,
          tags: ["fandom-auto"],
        }
      );

      await ctx.scheduler.runAfter(0, internal.fandomPipeline.discoverPages, {
        importId,
        maxPages: DEFAULT_MAX_PAGES,
      });

      return { ok: true, importId, slug, wikiName: site.wikiName };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, reason: "create_failed", slug, message };
    }
  },
});

async function proposeWikiSlug(
  apiKey: string,
  indexer: {
    indexedSlugs: string[];
    wikiNamesSample: string[];
    wikiIds: string[];
  },
  attempt: number
): Promise<string> {
  const avoidList = [...indexer.indexedSlugs, ...indexer.wikiIds].slice(0, 200);
  const nameHints = indexer.wikiNamesSample.slice(-40).join("; ");

  const system = `You help index Fandom.com wikis for a story-universe app.
Respond with ONLY valid JSON (no markdown, no code fences): {"slug":"subdomain"} where subdomain is the wiki subdomain only (e.g. "starwars" for starwars.fandom.com).
Rules:
- Lowercase letters, digits, single hyphens only. No path, no .com.
- Pick a popular English-language entertainment franchise that likely has an active Fandom wiki (games, TV, anime, movies, books).
- Do NOT suggest any slug in the avoid list.`;

  const user = `Already indexed (do not repeat): ${avoidList.join(", ") || "(none)"}
Sample names: ${nameHints || "(none)"}
Attempt: ${attempt + 1}. Suggest ONE new subdomain not in the avoid list.`;

  const result = await anthropicMessages({
    apiKey,
    model: DEFAULT_ANTHROPIC_MODEL,
    system,
    user,
    maxTokens: 120,
    temperature: 0.9,
  });

  if (!result.ok) {
    throw new Error(`Anthropic error ${result.status}: ${result.message}`);
  }

  const raw = unwrapJsonFromMarkdown(result.text);
  if (!raw) return "";

  try {
    const parsed = JSON.parse(raw) as { slug?: string };
    return typeof parsed.slug === "string" ? parsed.slug : "";
  } catch {
    return "";
  }
}

async function verifyFandomViaExa(apiKey: string, slug: string): Promise<boolean> {
  const resp = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query: `${slug}.fandom.com wiki`,
      type: "fast",
      numResults: 8,
      includeDomains: ["fandom.com"],
    }),
  });

  if (!resp.ok) {
    console.log("[fandomScraper] Exa error", resp.status, await resp.text());
    return false;
  }

  const data = (await resp.json()) as {
    results?: Array<{ url?: string }>;
  };
  const host = `${slug.toLowerCase()}.fandom.com`;
  for (const r of data.results || []) {
    const url = r.url;
    if (!url) continue;
    try {
      const u = new URL(url);
      if (u.hostname.toLowerCase() === host) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

async function fetchFandomSiteinfo(slug: string): Promise<{
  wikiId: string;
  wikiName: string;
  wikiUrl: string;
  imageUrl?: string;
} | null> {
  const siteUrl = `https://${slug}.fandom.com`;
  try {
    const resp = await fetch(
      `${siteUrl}/api.php?action=query&meta=siteinfo&siprop=general|statistics&format=json`,
      { headers: { "User-Agent": USER_AGENT } }
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      query?: {
        general?: {
          sitename?: string;
          servername?: string;
          wikiid?: string;
          lang?: string;
          logo?: string;
        };
      };
    };
    const g = data.query?.general;
    if (!g?.sitename) return null;
    const server = g.servername || `${slug}.fandom.com`;
    const wikiUrl = `https://${server.replace(/^https?:\/\//, "")}`;
    return {
      wikiId: g.wikiid || slug,
      wikiName: g.sitename,
      wikiUrl,
      imageUrl: g.logo || undefined,
    };
  } catch {
    return null;
  }
}
