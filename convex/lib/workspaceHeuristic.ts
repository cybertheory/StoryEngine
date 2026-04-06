/**
 * Pure command → patches logic for the workbench (no Convex `api` import).
 * Keep in sync with client heuristics in `src/lib/notepad-highlight.ts` where noted.
 */

export type WorkspaceCommandPatch = {
  addPlacements?: { objectId: string; x: number; y: number }[];
  addKeyframes?: {
    sourceObjectId: string;
    targetObjectId: string;
    label: string;
    style?: "solid" | "dashed" | "wavy" | "dotted";
    duration?: number;
    /** Paragraph index (`\n\n` separated scene events). */
    eventIndex: number;
    /** Line within that paragraph (single `\n`). */
    lineIndexInEvent: number;
    /** @deprecated Global line index (pre–scene-events); optional for older clients. */
    lineIndex?: number;
  }[];
};

function normalize(cmd: string) {
  return cmd.toLowerCase().trim().replace(/\s+/g, " ");
}

function objectsMentionedInCommand(
  cmd: string,
  rows: { _id: string; name: string }[]
) {
  const n = normalize(cmd);
  const hits = rows.filter((o) => n.includes(o.name.toLowerCase()));
  hits.sort((a, b) => b.name.length - a.name.length);
  return hits;
}

/** Order named objects by first appearance in the original command (for source → target). */
function orderNamedByAppearance(
  command: string,
  named: { _id: string; name: string }[]
) {
  const lower = command.toLowerCase();
  return [...named].sort((a, b) => {
    const ia = lower.indexOf(a.name.toLowerCase());
    const ib = lower.indexOf(b.name.toLowerCase());
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

/** Non-empty lines; if there are no newlines, one segment is the trimmed command. */
function commandLines(raw: string): string[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length > 0) return lines;
  const t = raw.trim();
  return t ? [t] : [];
}

/**
 * Split notepad into paragraphs (`\n\n`+). Each paragraph is one scene timeline event.
 * Lines within a paragraph are interactions (single `\n`).
 */
function commandEventParagraphs(raw: string): string[][] {
  const parts = raw.split(/\n\n+/);
  const out: string[][] = [];
  for (const part of parts) {
    const lines = commandLines(part.replace(/\r/g, ""));
    if (lines.length > 0) out.push(lines);
  }
  if (out.length === 0) {
    const fallback = commandLines(raw.replace(/\r/g, ""));
    if (fallback.length > 0) return [fallback];
  }
  return out;
}

/** Cap beats per interpret call (arbitrary notepad length still works up to this many lines). */
const MAX_INTERACTION_LINES_PER_COMMAND = 120;

/**
 * Text between the first two named objects in reading order → action label.
 * Used when no canned verb matches so lines like "Ashenmere kills Thorne" still work.
 */
function inferLabelBetweenNames(
  line: string,
  a: { name: string },
  b: { name: string }
): string | null {
  const lower = line.toLowerCase();
  const ai = lower.indexOf(a.name.toLowerCase());
  const bi = lower.indexOf(b.name.toLowerCase());
  if (ai === -1 || bi === -1) return null;
  const between =
    ai <= bi
      ? line.slice(ai + a.name.length, bi)
      : line.slice(bi + b.name.length, ai);
  const cleaned = between
    .trim()
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[^\p{L}\p{N}\s]+$/u, "")
    .trim();
  if (cleaned.length < 2 || cleaned.length > 32) return null;
  return cleaned.toLowerCase();
}

/**
 * One keyframe per line: prefer a known verb; otherwise infer action from text between names.
 * Phrasal verbs must be listed explicitly (e.g. "runs away from").
 */
const INTERACTION_VERB_RE =
  /\b(interacts?\s+with|talks?\s+to|confronts?|fights?|kisses?|loves?|kills?|murders?|attacks?|warns?|helps?|saves?|chases?|follows?|avoids?|gives\s+to|stares?\s+at|hands?\s+to|runs?\s+away\s+from)\b/i;

/** After a clause, the usual “who …” subject is the prior clause’s second party (target). */
function lineChainCarryTargetName(
  line: string,
  objects: { _id: string; name: string }[]
): string {
  const named = objectsMentionedInCommand(line, objects);
  if (named.length < 2) {
    return named.length === 1 ? named[0].name : "";
  }
  const ord = orderNamedByAppearance(line, named);
  return ord[1].name;
}

/**
 * "A kisses B who then kills C who also loves A" → synthetic lines:
 * "A kisses B", "B kills C", "C loves A" (names from universe).
 * All map to the same notepad row; the client places every beat on that line’s tick.
 */
function expandChainedInteractionFragments(
  line: string,
  objects: { _id: string; name: string }[]
): string[] {
  const parts = line.split(/\bwho\s+then\b|\bwho\s+also\b|\band\s+then\b/gi);
  if (parts.length <= 1) {
    const t = line.trim();
    return t ? [t] : [];
  }

  const out: string[] = [];
  let carry = "";
  for (let i = 0; i < parts.length; i++) {
    let piece = parts[i].trim();
    if (!piece) continue;
    if (i > 0 && carry) {
      piece = `${carry} ${piece}`.replace(/\s+/g, " ").trim();
    }
    out.push(piece);
    carry = lineChainCarryTargetName(piece, objects);
  }
  return out;
}

type HeuristicKeyframeCore = Omit<
  NonNullable<WorkspaceCommandPatch["addKeyframes"]>[0],
  "eventIndex" | "lineIndexInEvent" | "lineIndex"
>;

/**
 * One named object + trailing action text → edge to the Ambient anchor (solo beat).
 * Example: "@Thorne Blackwood rides off into the sunset"
 */
function trySoloActionKeyframe(
  line: string,
  objects: { _id: string; name: string }[],
  ambientObjectId: string | null
): HeuristicKeyframeCore | null {
  if (!ambientObjectId) return null;

  const namedRaw = objectsMentionedInCommand(line, objects).filter(
    (o) => o._id !== ambientObjectId
  );
  if (namedRaw.length !== 1) return null;

  const a = namedRaw[0]!;
  const lowerLine = line.toLowerCase();
  const nameLower = a.name.toLowerCase();
  const idx = lowerLine.indexOf(nameLower);
  if (idx === -1) return null;

  let tail = line
    .slice(idx + a.name.length)
    .replace(/^[\s@,.;:!-]+/u, "")
    .trim();
  tail = tail.replace(/^(the|a|an)\s+/i, "").trim();
  if (tail.length < 2) return null;

  let label =
    tail
      .replace(/\s*\.\.\.*$/u, "")
      .split(/[.!?\n]/)[0]
      ?.trim()
      .toLowerCase() ?? "";
  if (label.length < 2) return null;
  if (label.length > 32) {
    label = label.slice(0, 32).replace(/\s+\S*$/u, "").trim();
  }
  if (label.length < 2) return null;

  return {
    sourceObjectId: a._id,
    targetObjectId: ambientObjectId,
    label,
    style: "dashed",
    duration: 16,
  };
}

function tryKeyframeFromVerbLine(
  line: string,
  objects: { _id: string; name: string }[]
): HeuristicKeyframeCore | null {
  const namedRaw = objectsMentionedInCommand(line, objects);
  if (namedRaw.length < 2) return null;
  const ordered = orderNamedByAppearance(line, namedRaw);
  const a = ordered[0];
  const b = ordered[1];
  if (a._id === b._id) return null;

  const verbMatch = line.match(INTERACTION_VERB_RE);
  let label: string | null = null;
  if (verbMatch) {
    const rawVerb = verbMatch[0].replace(/\s+/g, " ").trim();
    label =
      rawVerb.length > 0 && rawVerb.length <= 28
        ? rawVerb.toLowerCase()
        : "interacts with";
  } else {
    label = inferLabelBetweenNames(line, a, b);
  }
  if (!label) return null;

  return {
    sourceObjectId: a._id,
    targetObjectId: b._id,
    label,
    style: "solid",
    duration: 16,
  };
}

function collectVerbInteractionKeyframes(
  command: string,
  objects: { _id: string; name: string }[],
  ambientObjectId: string | null
): NonNullable<WorkspaceCommandPatch["addKeyframes"]> {
  const paragraphs = commandEventParagraphs(command);
  const out: NonNullable<WorkspaceCommandPatch["addKeyframes"]> = [];
  const seen = new Set<string>();
  let globalLine = 0;

  for (let eventIndex = 0; eventIndex < paragraphs.length; eventIndex++) {
    const lines = paragraphs[eventIndex]!;
    for (let lineIndexInEvent = 0; lineIndexInEvent < lines.length; lineIndexInEvent++) {
      if (out.length >= MAX_INTERACTION_LINES_PER_COMMAND) break;
      const line = lines[lineIndexInEvent]!;
      const fragments = expandChainedInteractionFragments(line, objects);
      for (const frag of fragments) {
        if (out.length >= MAX_INTERACTION_LINES_PER_COMMAND) break;
        const kf =
          tryKeyframeFromVerbLine(frag, objects) ??
          trySoloActionKeyframe(frag, objects, ambientObjectId);
        if (!kf) continue;

        const dedupeKey = `${eventIndex}|${lineIndexInEvent}|${kf.sourceObjectId}|${kf.targetObjectId}|${kf.label}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        out.push({
          ...kf,
          eventIndex,
          lineIndexInEvent,
          lineIndex: globalLine,
        });
      }
      globalLine += 1;
    }
  }
  return out;
}

/**
 * Full beat list for notepad → timeline/canvas/prose (no populate/place commands).
 * Verb lines first; if none, lines with beat/interaction keywords.
 */
export function keyframesFromNotepadScript(
  command: string,
  objects: { _id: string; name: string }[],
  ambientObjectId?: string | null
): NonNullable<WorkspaceCommandPatch["addKeyframes"]> {
  const ambient = ambientObjectId ?? null;
  const verb = collectVerbInteractionKeyframes(command, objects, ambient);
  if (verb.length > 0) return verb;
  return collectBeatKeywordKeyframes(command, objects, ambient);
}

function collectBeatKeywordKeyframes(
  command: string,
  objects: { _id: string; name: string }[],
  ambientObjectId: string | null
): NonNullable<WorkspaceCommandPatch["addKeyframes"]> {
  const paragraphs = commandEventParagraphs(command);
  const out: NonNullable<WorkspaceCommandPatch["addKeyframes"]> = [];
  const seen = new Set<string>();
  let globalLine = 0;

  for (let eventIndex = 0; eventIndex < paragraphs.length; eventIndex++) {
    const lines = paragraphs[eventIndex]!;
    for (let lineIndexInEvent = 0; lineIndexInEvent < lines.length; lineIndexInEvent++) {
      if (out.length >= MAX_INTERACTION_LINES_PER_COMMAND) break;
      const line = lines[lineIndexInEvent]!;
      const cmdLine = normalize(line);
      if (!/\b(interaction|relationship|beat|keyframe)\b/.test(cmdLine)) {
        globalLine += 1;
        continue;
      }
      const namedRaw = objectsMentionedInCommand(line, objects).filter(
        (o) => !ambientObjectId || o._id !== ambientObjectId
      );
      if (namedRaw.length >= 2) {
        const ordered = orderNamedByAppearance(line, namedRaw);
        const a = ordered[0];
        const b = ordered[1];
        if (a._id !== b._id) {
          const label = inferLabelBetweenNames(line, a, b) ?? "interacts with";
          const dedupeKey = `${eventIndex}|${lineIndexInEvent}|${a._id}|${b._id}|${label}`;
          if (!seen.has(dedupeKey)) {
            seen.add(dedupeKey);
            out.push({
              sourceObjectId: a._id,
              targetObjectId: b._id,
              label,
              style: "solid",
              duration: 16,
              eventIndex,
              lineIndexInEvent,
              lineIndex: globalLine,
            });
          }
        }
      } else if (namedRaw.length === 1 && ambientObjectId) {
        const solo = trySoloActionKeyframe(line, objects, ambientObjectId);
        if (solo) {
          const dedupeKey = `${eventIndex}|${lineIndexInEvent}|${solo.sourceObjectId}|${solo.targetObjectId}|${solo.label}`;
          if (!seen.has(dedupeKey)) {
            seen.add(dedupeKey);
            out.push({
              ...solo,
              eventIndex,
              lineIndexInEvent,
              lineIndex: globalLine,
            });
          }
        }
      }
      globalLine += 1;
    }
  }
  return out;
}

export function interpretHeuristic(
  command: string,
  objects: { _id: string; name: string }[],
  placed: Set<string>,
  currentTick: number,
  ambientObjectId?: string | null
): { message: string; patches: WorkspaceCommandPatch } {
  const cmd = normalize(command);
  if (!cmd) {
    return {
      message:
        "Describe what you want on the canvas or timeline — e.g. populate the scene, or Alice interacts with Bob.",
      patches: {},
    };
  }

  const patches: WorkspaceCommandPatch = {};

  if (
    /\b(populate|fill\s+(the\s+)?scene|layout\s+everyone|grid\s+(of\s+)?characters)\b/.test(
      cmd
    ) ||
    (/\b(everyone|all)\b/.test(cmd) &&
      /\b(canvas|scene|stage)\b/.test(cmd))
  ) {
    const addPlacements: WorkspaceCommandPatch["addPlacements"] = [];
    const cols = 4;
    const cellW = 160;
    const cellH = 130;
    const startX = 60;
    const startY = 70;
    const ambient = ambientObjectId ?? null;
    let i = 0;
    for (const o of objects) {
      if (ambient && o._id === ambient) continue;
      if (placed.has(o._id)) continue;
      if (i >= 16) break;
      const col = i % cols;
      const row = Math.floor(i / cols);
      addPlacements.push({
        objectId: o._id,
        x: startX + col * cellW,
        y: startY + row * cellH,
      });
      i++;
    }
    patches.addPlacements = addPlacements;
    return {
      message:
        addPlacements.length > 0
          ? `Placed ${addPlacements.length} universe objects on the canvas in a grid (skipped ones already placed).`
          : "Every object from the universe is already on the canvas.",
      patches,
    };
  }

  const verbKeyframes = collectVerbInteractionKeyframes(
    command,
    objects,
    ambientObjectId ?? null
  );
  if (verbKeyframes.length > 0) {
    patches.addKeyframes = verbKeyframes;
    const summary =
      verbKeyframes.length === 1
        ? (() => {
            const k = verbKeyframes[0];
            const sa =
              objects.find((o) => o._id === k.sourceObjectId)?.name ?? "?";
            const ta =
              objects.find((o) => o._id === k.targetObjectId)?.name ?? "?";
            return `${sa} — ${k.label} — ${ta}`;
          })()
        : `${verbKeyframes.length} beats`;
    return {
      message: `Added interaction keyframe(s) at tick ${currentTick}: ${summary}.`,
      patches,
    };
  }

  const beatKeyframes = collectBeatKeywordKeyframes(
    command,
    objects,
    ambientObjectId ?? null
  );
  if (beatKeyframes.length > 0) {
    patches.addKeyframes = beatKeyframes;
    return {
      message: `Keyframe(s) at tick ${currentTick}: ${beatKeyframes.length} beat(s) from lines with interaction keywords.`,
      patches,
    };
  }

  const namedRaw = objectsMentionedInCommand(command, objects);

  if (/\b(place|add|put|drop)\b/.test(cmd) && namedRaw.length >= 1) {
    const addPlacements: WorkspaceCommandPatch["addPlacements"] = [];
    let offset = 0;
    for (const o of orderNamedByAppearance(command, namedRaw).slice(0, 6)) {
      if (ambientObjectId && o._id === ambientObjectId) continue;
      if (placed.has(o._id)) continue;
      addPlacements.push({
        objectId: o._id,
        x: 120 + offset * 100,
        y: 140,
      });
      offset++;
    }
    if (addPlacements.length > 0) {
      patches.addPlacements = addPlacements;
      return {
        message: `Placed ${addPlacements.length} object(s) on the canvas.`,
        patches,
      };
    }
    return {
      message: "Those objects are already on the canvas.",
      patches: {},
    };
  }

  return {
    message:
      "Try commands like: “Populate the scene”, “Place Alice”, or “Alice talks to Bob”. Use exact names from your universe.",
    patches: {},
  };
}
