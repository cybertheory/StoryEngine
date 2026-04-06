import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  anthropicMessages,
  getAnthropicApiKey,
  getNotepadAutocompleteModel,
} from "./lib/anthropic";

const MAX_BEFORE = 6000;
const MAX_COMPLETION_CHARS = 220;

/** Breaks TS circular inference between this action and `api` (notepadAssist ↔ api). */
export type NotepadTabCompletionResult =
  | { ok: false; message: string; completion: string }
  | { ok: true; message: string; completion: string };

function normalizeCompletion(before: string, raw: string): string {
  let t = raw.trim();
  if (!t) return "";
  // Drop accidental full-line echo
  const lastLine = before.split(/\n/).pop() ?? "";
  if (t === lastLine.trim()) return "";
  // If model repeated the tail of `before`, strip overlap
  const tail = before.slice(-Math.min(80, before.length));
  if (tail.length >= 8 && t.toLowerCase().startsWith(tail.trimEnd().toLowerCase())) {
    t = t.slice(tail.trimEnd().length).trimStart();
  }
  if (t.length > MAX_COMPLETION_CHARS) {
    t = t.slice(0, MAX_COMPLETION_CHARS).trimEnd();
  }
  return t;
}

/**
 * Tab-style inline continuation for the story notepad (author-only).
 * Uses a fast Anthropic model; universe object manifest is bounded for scale.
 */
export const tabCompletion = action({
  args: {
    sessionToken: v.string(),
    storyId: v.id("stories"),
    textBeforeCursor: v.string(),
    priorContext: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<NotepadTabCompletionResult> => {
    const gate = await ctx.runQuery(api.stories.workspaceAgentGate, {
      storyId: args.storyId,
      sessionToken: args.sessionToken,
    });
    if (!gate.ok) {
      return { ok: false, message: gate.message, completion: "" };
    }

    const universeId: Id<"universes"> = gate.universeId;

    const universe = await ctx.runQuery(api.universes.getById, {
      id: universeId,
      sessionToken: args.sessionToken,
    });
    if (!universe) {
      return { ok: false, message: "Universe not found.", completion: "" };
    }

    const manifest = await ctx.runQuery(api.objects.manifestForNotepadAssist, {
      universeId,
      sessionToken: args.sessionToken,
    });
    if (!manifest) {
      return { ok: false, message: "Universe not found.", completion: "" };
    }

    const key = getAnthropicApiKey();
    if (!key) {
      return {
        ok: false,
        message:
          "Set ANTHROPIC_API_KEY for this Convex deployment to enable notepad autocomplete.",
        completion: "",
      };
    }

    const exactNames = manifest.objects.map((o) => o.name).join("\n");

    const schemaBlock: string = [
      "Universe manifest (objects the writer may reference):",
      "",
      `Universe: ${universe.name}`,
      universe.description.replace(/\s+/g, " ").slice(0, 600),
      universe.tags.length ? `Universe tags: ${universe.tags.join(", ")}` : "",
      "",
      "Object kinds: character | place | item | faction | lore | event_type",
      manifest.capped
        ? `Objects (first ${manifest.objects.length} by name; universe has more — prefer listed names):`
        : "Objects:",
      ...manifest.objects.map(
        (o) => `- [${o.kind}] ${o.name}: ${o.blurb}`
      ),
      "",
      "EXACT @ NAMES (copy spelling exactly when mentioning an object):",
      exactNames,
    ].join("\n");

    const prior = (args.priorContext ?? "").slice(-2000);
    const before = args.textBeforeCursor.slice(-MAX_BEFORE);

    const system: string = `${schemaBlock}

You are an inline autocomplete for fiction scene notes in a visual story workspace. The notepad drives a timeline and canvas.

Fiction & disbelief (critical):
- This is make-believe. Your job is to continue the author's draft, not to correct them.
- Suspend disbelief: do not object that an object "is a place" or "is an item" if the story treats it like a character, target, or victim. Metaphor, personification, magic, and impossible beats are allowed.
- Never refuse, lecture, ask for clarification, or apologize for "logical" conflicts with the manifest kinds (character vs place vs item). The manifest is reference only for names and @ markup — not physics or ontology.
- Do not break the fourth wall; write as continuation of the scene, not as an editor.

Markup rules (critical):
- When you refer to an object from the manifest, use @ followed by the EXACT name as listed (e.g. @Jane Doe if the name has a space). No markdown links.
- Do not use @ for people or things that are not in the manifest unless the user already introduced them in the notes.
- Plain prose does not need markup.

Output rules:
- Return ONLY the characters to insert at the cursor (no quotes, no labels, no JSON).
- Do not repeat any text from the end of the user's draft.
- Continue in the same voice and tense; prefer concrete beats, dialogue, or sensory detail.
- No meta commentary ("I need to clarify", "Did you mean", "as a place it can't…") — only in-world continuation.
- Keep it short: at most ~2 sentences or ~120 words, stopping at a natural phrase boundary when possible.`;

    const user = prior
      ? `[Earlier notes in this scene]\n${prior}\n\n[Continue immediately after the following — do not repeat it]\n${before}`
      : `[Continue immediately after the following — do not repeat it]\n${before}`;

    const result = await anthropicMessages({
      apiKey: key,
      model: getNotepadAutocompleteModel(),
      system,
      user,
      maxTokens: 200,
      temperature: 0.55,
    });

    if (!result.ok) {
      return {
        ok: false,
        message: `Anthropic error ${result.status}: ${result.message.slice(0, 240)}`,
        completion: "",
      };
    }

    const completion = normalizeCompletion(before, result.text);
    return { ok: true, message: "", completion };
  },
});
