import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  anthropicMessages,
  DEFAULT_PROSE_ANTHROPIC_MODEL,
  getAnthropicApiKey,
} from "./lib/anthropic";
import { STORYOBJECT_SCENE_ANCHOR_TAG } from "./lib/sceneAnchorConstants";

function objectIsSceneAnchor(o: Doc<"objects">): boolean {
  return o.tags.includes(STORYOBJECT_SCENE_ANCHOR_TAG);
}

const MAX_BEATS_PER_CALL = 36;
const OBJECT_BLURB = 720;

export type BeatProseResult = { beatId: string; prose: string };

export type GenerateBeatProsesResult =
  | { ok: false; message: string; results: [] }
  | { ok: true; message: string; results: BeatProseResult[] };

/**
 * Renders each interaction beat as creative prose using object bios + the beat.
 * All beats are sent to Anthropic in parallel (one request per beat). Author-only.
 */
export const generateBeatProses = action({
  args: {
    sessionToken: v.string(),
    storyId: v.id("stories"),
    tone: v.string(),
    beats: v.array(
      v.object({
        beatId: v.string(),
        sourceObjectId: v.id("objects"),
        targetObjectId: v.id("objects"),
        label: v.string(),
        interactionMeaning: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args): Promise<GenerateBeatProsesResult> => {
    const gate = await ctx.runQuery(api.stories.workspaceAgentGate, {
      storyId: args.storyId,
      sessionToken: args.sessionToken,
    });
    if (!gate.ok) {
      return { ok: false, message: gate.message, results: [] };
    }

    const apiKey = getAnthropicApiKey();
    if (!apiKey) {
      return {
        ok: false,
        message:
          "Set ANTHROPIC_API_KEY for this Convex deployment to enable AI prose (e.g. `npx convex env set ANTHROPIC_API_KEY <key>`).",
        results: [],
      };
    }

    const anthropicKey: string = apiKey;

    const story = await ctx.runQuery(api.stories.getById, {
      id: args.storyId,
      sessionToken: args.sessionToken,
    });
    if (!story) {
      return { ok: false, message: "Story not found.", results: [] };
    }

    const universeId: Id<"universes"> = gate.universeId;
    const universe = await ctx.runQuery(api.universes.getById, {
      id: universeId,
      sessionToken: args.sessionToken,
    });
    if (!universe) {
      return { ok: false, message: "Universe not found.", results: [] };
    }

    const objectRows = await ctx.runQuery(api.objects.listByUniverse, {
      universeId,
      sessionToken: args.sessionToken,
    });
    const byId = new Map<string, Doc<"objects">>(
      objectRows.map((o) => [o._id as string, o])
    );

    const trimmedBeats = args.beats.slice(0, MAX_BEATS_PER_CALL);
    const tone =
      args.tone.trim().slice(0, 200) || "creative literary fiction";

    const storyTitle = story.title.replace(/\s+/g, " ").trim() || "Untitled";
    const universeName = universe.name;
    const universeBlurb = universe.description.replace(/\s+/g, " ").slice(0, 500);

    const proseModel = DEFAULT_PROSE_ANTHROPIC_MODEL;

    async function one(beat: (typeof trimmedBeats)[0]): Promise<BeatProseResult> {
      const src = byId.get(beat.sourceObjectId as string);
      const tgt = byId.get(beat.targetObjectId as string);
      if (!src || !tgt) {
        return { beatId: beat.beatId, prose: "" };
      }

      const system = `You are a fiction writer. Write ONE short passage (2–6 sentences) that dramatizes a single story moment.

Author’s tone / style: ${tone}

Rules:
- Use the entity details given; stay faithful to names, kinds, and descriptions.
- Render the interaction as lived scene (action, sensation, dialogue, interior thought) — not a dry summary like "X verb Y."
- Do not add a title, heading, or bullet list. Plain prose paragraphs only.
- Do not introduce major new named characters.
- Output English prose only.`;

      const meaning = beat.interactionMeaning?.trim();
      const tgtAnchor = objectIsSceneAnchor(tgt);
      const user = tgtAnchor
        ? `Context
Story: ${storyTitle}
World: ${universeName}
${universeBlurb ? `World notes: ${universeBlurb}` : ""}

── Focus character / entity ──
Kind: ${src.kind}
Name: ${src.name}
Description: ${src.description.replace(/\s+/g, " ").slice(0, OBJECT_BLURB)}
Tags: ${src.tags.length ? src.tags.join(", ") : "none"}

── Beat to render ──
Solo action (no other object in this beat — dramatize only what ${src.name} does): ${beat.label}
${meaning ? `Author note (honor this intent): ${meaning.slice(0, 600)}` : ""}

Write the passage now.`
        : `Context
Story: ${storyTitle}
World: ${universeName}
${universeBlurb ? `World notes: ${universeBlurb}` : ""}

── Entity A (initiates / source of the interaction) ──
Kind: ${src.kind}
Name: ${src.name}
Description: ${src.description.replace(/\s+/g, " ").slice(0, OBJECT_BLURB)}
Tags: ${src.tags.length ? src.tags.join(", ") : "none"}

── Entity B (target of the interaction) ──
Kind: ${tgt.kind}
Name: ${tgt.name}
Description: ${tgt.description.replace(/\s+/g, " ").slice(0, OBJECT_BLURB)}
Tags: ${tgt.tags.length ? tgt.tags.join(", ") : "none"}

── Beat to render ──
Interaction type (label): ${beat.label}
${meaning ? `Author note (honor this intent): ${meaning.slice(0, 600)}` : ""}

Write the passage now.`;

      try {
        const result = await anthropicMessages({
          apiKey: anthropicKey,
          model: proseModel,
          system,
          user,
          maxTokens: 512,
          temperature: 0.72,
        });

        if (!result.ok) {
          console.error(
            "[generateBeatProses] Anthropic",
            beat.beatId,
            result.status,
            result.message.slice(0, 200)
          );
          return { beatId: beat.beatId, prose: "" };
        }

        const prose = result.text.trim();
        return { beatId: beat.beatId, prose };
      } catch (e) {
        console.error("[generateBeatProses]", beat.beatId, e);
        return { beatId: beat.beatId, prose: "" };
      }
    }

    const results = await Promise.all(trimmedBeats.map((b) => one(b)));

    const okCount = results.filter((r) => r.prose.length > 0).length;
    return {
      ok: true,
      message:
        okCount === results.length
          ? `Rendered ${okCount} beat(s).`
          : `Rendered ${okCount} of ${results.length} beat(s); some fell back to template.`,
      results,
    };
  },
});

const MAX_EVENTS_PER_CALL = 24;

export type EventProseResult = { eventId: string; prose: string };

export type GenerateEventProsesResult =
  | { ok: false; message: string; results: [] }
  | { ok: true; message: string; results: EventProseResult[] };

/**
 * One AI passage per scene timeline event (all interactions in that moment together).
 */
export const generateEventProses = action({
  args: {
    sessionToken: v.string(),
    storyId: v.id("stories"),
    tone: v.string(),
    events: v.array(
      v.object({
        eventId: v.string(),
        beats: v.array(
          v.object({
            sourceObjectId: v.id("objects"),
            targetObjectId: v.id("objects"),
            label: v.string(),
            interactionMeaning: v.optional(v.string()),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args): Promise<GenerateEventProsesResult> => {
    const gate = await ctx.runQuery(api.stories.workspaceAgentGate, {
      storyId: args.storyId,
      sessionToken: args.sessionToken,
    });
    if (!gate.ok) {
      return { ok: false, message: gate.message, results: [] };
    }

    const apiKey = getAnthropicApiKey();
    if (!apiKey) {
      return {
        ok: false,
        message:
          "Set ANTHROPIC_API_KEY for this Convex deployment to enable AI prose (e.g. `npx convex env set ANTHROPIC_API_KEY <key>`).",
        results: [],
      };
    }

    const anthropicKey: string = apiKey;

    const story = await ctx.runQuery(api.stories.getById, {
      id: args.storyId,
      sessionToken: args.sessionToken,
    });
    if (!story) {
      return { ok: false, message: "Story not found.", results: [] };
    }

    const universeId: Id<"universes"> = gate.universeId;
    const universe = await ctx.runQuery(api.universes.getById, {
      id: universeId,
      sessionToken: args.sessionToken,
    });
    if (!universe) {
      return { ok: false, message: "Universe not found.", results: [] };
    }

    const objectRows = await ctx.runQuery(api.objects.listByUniverse, {
      universeId,
      sessionToken: args.sessionToken,
    });
    const byId = new Map<string, Doc<"objects">>(
      objectRows.map((o) => [o._id as string, o])
    );

    const trimmed = args.events.slice(0, MAX_EVENTS_PER_CALL);
    const tone =
      args.tone.trim().slice(0, 200) || "creative literary fiction";

    const storyTitle = story.title.replace(/\s+/g, " ").trim() || "Untitled";
    const universeName = universe.name;
    const universeBlurb = universe.description.replace(/\s+/g, " ").slice(0, 500);

    const proseModel = DEFAULT_PROSE_ANTHROPIC_MODEL;

    async function oneEvent(ev: (typeof trimmed)[0]): Promise<EventProseResult> {
      if (ev.beats.length === 0) {
        return { eventId: ev.eventId, prose: "" };
      }

      const beatBlocks: string[] = [];
      for (let i = 0; i < ev.beats.length; i++) {
        const beat = ev.beats[i]!;
        const src = byId.get(beat.sourceObjectId as string);
        const tgt = byId.get(beat.targetObjectId as string);
        if (!src || !tgt) continue;
        const meaning = beat.interactionMeaning?.trim();
        const tgtAnchor = objectIsSceneAnchor(tgt);
        beatBlocks.push(
          tgtAnchor
            ? `— Moment ${i + 1} —\n${src.name} (${src.kind}) — solo: ${beat.label}${
                meaning ? `\nAuthor note: ${meaning.slice(0, 400)}` : ""
              }\n${src.name}: ${src.description.replace(/\s+/g, " ").slice(0, OBJECT_BLURB)}`
            : `— Moment ${i + 1} —\n${src.name} (${src.kind}) → ${beat.label} → ${tgt.name} (${tgt.kind})${
                meaning ? `\nAuthor note: ${meaning.slice(0, 400)}` : ""
              }\n${src.name}: ${src.description.replace(/\s+/g, " ").slice(0, OBJECT_BLURB)}\n${tgt.name}: ${tgt.description.replace(/\s+/g, " ").slice(0, OBJECT_BLURB)}`
        );
      }
      if (beatBlocks.length === 0) {
        return { eventId: ev.eventId, prose: "" };
      }

      const system = `You are a fiction writer. Write ONE cohesive short passage (3–8 sentences) that dramatizes a single story beat composed of multiple simultaneous or tightly chained interactions.

Author’s tone / style: ${tone}

Rules:
- Weave every moment below into one flowing scene (not a list of separate mini-scenes).
- Use entity details faithfully; render as lived scene — action, sensation, dialogue, thought — not dry summaries.
- No title, heading, or bullets. Plain prose only.
- Do not introduce major new named characters.
- Output English prose only.`;

      const user = `Context
Story: ${storyTitle}
World: ${universeName}
${universeBlurb ? `World notes: ${universeBlurb}` : ""}

── Interactions in this beat (render together) ──
${beatBlocks.join("\n\n")}

Write the passage now.`;

      try {
        const result = await anthropicMessages({
          apiKey: anthropicKey,
          model: proseModel,
          system,
          user,
          maxTokens: 768,
          temperature: 0.72,
        });

        if (!result.ok) {
          console.error(
            "[generateEventProses] Anthropic",
            ev.eventId,
            result.status,
            result.message.slice(0, 200)
          );
          return { eventId: ev.eventId, prose: "" };
        }

        return { eventId: ev.eventId, prose: result.text.trim() };
      } catch (e) {
        console.error("[generateEventProses]", ev.eventId, e);
        return { eventId: ev.eventId, prose: "" };
      }
    }

    const results = await Promise.all(trimmed.map((e) => oneEvent(e)));

    const okCount = results.filter((r) => r.prose.length > 0).length;
    return {
      ok: true,
      message:
        okCount === results.length
          ? `Rendered ${okCount} event passage(s).`
          : `Rendered ${okCount} of ${results.length} event passage(s).`,
      results,
    };
  },
});
