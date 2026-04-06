/**
 * Anthropic Messages API helper for Convex actions.
 * Set `ANTHROPIC_API_KEY` via `npx convex env set ANTHROPIC_API_KEY <key>`.
 * Optional: `ANTHROPIC_MODEL`, `PROSE_ANTHROPIC_MODEL`, `NOTEPAD_AUTOCOMPLETE_MODEL` (full snapshot IDs recommended).
 * Defaults use dated IDs from https://docs.anthropic.com/en/docs/about-claude/models
 */

const ANTHROPIC_VERSION = "2023-06-01";
const MESSAGES_URL = "https://api.anthropic.com/v1/messages";

/** Fast / cheap: notepad, Fandom extraction, slug proposal. */
export const DEFAULT_ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-4-5-20251001";

/** Optional override for notepad Tab autocomplete only (defaults to Haiku). */
export function getNotepadAutocompleteModel(): string {
  return (
    process.env.NOTEPAD_AUTOCOMPLETE_MODEL?.trim() ||
    process.env.ANTHROPIC_MODEL?.trim() ||
    "claude-haiku-4-5-20251001"
  );
}

/** Creative beat prose (override with `PROSE_ANTHROPIC_MODEL`). */
export const DEFAULT_PROSE_ANTHROPIC_MODEL =
  process.env.PROSE_ANTHROPIC_MODEL?.trim() ||
  process.env.ANTHROPIC_MODEL?.trim() ||
  "claude-sonnet-4-5-20250929";

export function getAnthropicApiKey(): string | undefined {
  const k = process.env.ANTHROPIC_API_KEY?.trim();
  return k || undefined;
}

type AnthropicResponse = {
  content?: { type: string; text?: string }[];
  error?: { message?: string };
};

export type AnthropicResult =
  | { ok: true; text: string }
  | { ok: false; status: number; message: string };

/**
 * Single turn: system prompt + user message → assistant text (first text block).
 */
export async function anthropicMessages(params: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
}): Promise<AnthropicResult> {
  const resp = await fetch(MESSAGES_URL, {
    method: "POST",
    headers: {
      "x-api-key": params.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens,
      temperature:
        params.temperature !== undefined ? params.temperature : 1,
      system: params.system,
      messages: [{ role: "user", content: params.user }],
    }),
  });

  const raw = await resp.text();
  if (!resp.ok) {
    return {
      ok: false,
      status: resp.status,
      message: raw.slice(0, 500),
    };
  }

  let data: AnthropicResponse;
  try {
    data = JSON.parse(raw) as AnthropicResponse;
  } catch {
    return { ok: false, status: 500, message: "Invalid JSON from Anthropic" };
  }

  let text = "";
  for (const b of data.content ?? []) {
    if (b.type === "text" && typeof b.text === "string") {
      text += (text ? "\n" : "") + b.text;
    }
  }
  text = text.trim();

  if (!text && data.error?.message) {
    return { ok: false, status: 502, message: data.error.message };
  }

  return { ok: true, text };
}

/** If the model wrapped JSON in ``` fences, unwrap before `JSON.parse`. */
export function unwrapJsonFromMarkdown(text: string): string {
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return m ? m[1].trim() : t;
}
