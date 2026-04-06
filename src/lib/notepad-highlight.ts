export type MentionKind = "resolved" | "prefix" | "orphan";

export type MentionSegment =
  | { type: "text"; value: string }
  | { type: "mention"; value: string; kind: MentionKind };

function classifyMentionBody(body: string, names: string[]): MentionKind {
  const t = body.trimEnd().toLowerCase();
  if (!t) return "orphan";
  const nlow = names.map((n) => n.toLowerCase());
  if (nlow.includes(t)) return "resolved";
  if (nlow.some((n) => n.startsWith(t))) return "prefix";
  return "orphan";
}

type MentionTokenScan =
  | { type: "bare_at" }
  | { type: "token"; endExclusive: number; body: string };

/** Scan one @… token: `rest` is the substring immediately after `@`. */
function scanMentionToken(rest: string, names: string[]): MentionTokenScan {
  const n = names.filter((nm) => nm.trim().length > 0);
  let j = 0;
  while (j < rest.length && /\s/.test(rest[j])) j++;

  if (j >= rest.length || rest[j] === "\n") {
    return { type: "bare_at" };
  }

  let endExclusive = j;
  while (endExclusive < rest.length) {
    const c = rest[endExclusive];
    if (c === "\n" || c === "@") break;
    if (!/[\p{L}\p{N}\s'’.\-]/u.test(c)) break;
    const trial = rest.slice(j, endExclusive + 1).trimEnd();
    if (trial.length === 0) {
      endExclusive++;
      continue;
    }
    const ok = n.some((nm) =>
      nm.toLowerCase().startsWith(trial.toLowerCase())
    );
    if (!ok) break;
    endExclusive++;
  }

  if (endExclusive === j) {
    let k = j;
    while (k < rest.length && /[\p{L}\p{N}'’.\-]/u.test(rest[k])) k++;
    endExclusive = k > j ? k : Math.min(j + 1, rest.length);
  }

  const body = rest.slice(j, endExclusive).trimEnd();
  return { type: "token", endExclusive, body };
}

/**
 * Whether the @-menu should be open: cursor must sit inside the scanned mention
 * token only (not in prose after it), using the same bounds as highlighting.
 */
export function activeMentionAtCursor(
  text: string,
  cursor: number,
  objectNames: string[]
): { start: number; query: string } | null {
  const before = text.slice(0, cursor);
  const at = before.lastIndexOf("@");
  if (at === -1) return null;
  const afterAt = before.slice(at + 1);
  if (/\n/.test(afterAt)) return null;

  const names = objectNames.filter((n) => n.trim().length > 0);
  const scan = scanMentionToken(afterAt, names);
  if (scan.type === "bare_at") {
    return { start: at, query: "" };
  }
  const { endExclusive, body } = scan;
  if (/[^\s]/.test(afterAt.slice(endExclusive))) {
    return null;
  }
  const resolved = names.some(
    (nm) => nm.toLowerCase() === body.toLowerCase()
  );
  if (resolved) {
    return null;
  }
  return { start: at, query: body };
}

/**
 * Split notepad into text + @mentions. Each mention stops as soon as the typed
 * string is no longer a prefix of any universe object — so plain words like
 * "kisses" are never swallowed into the previous @mention.
 */
export function segmentNotepadForHighlight(
  text: string,
  objectNames: string[]
): MentionSegment[] {
  const names = objectNames.filter((n) => n.trim().length > 0);
  const segments: MentionSegment[] = [];
  let i = 0;

  while (i < text.length) {
    if (text[i] !== "@") {
      const start = i;
      while (i < text.length && text[i] !== "@") i++;
      segments.push({ type: "text", value: text.slice(start, i) });
      continue;
    }

    const at = i;
    const rest = text.slice(at + 1);
    const scan = scanMentionToken(rest, names);

    if (scan.type === "bare_at") {
      segments.push({ type: "text", value: "@" });
      i = at + 1;
      continue;
    }

    const { endExclusive, body } = scan;
    const kind = classifyMentionBody(body, names);
    const raw = text.slice(at, at + 1 + endExclusive);
    segments.push({ type: "mention", value: raw, kind });
    i = at + 1 + endExclusive;
  }

  return segments;
}

export type NotepadPlaybackPiece =
  | { type: "text"; value: string; playback: boolean }
  | { type: "mention"; value: string; kind: MentionKind; playback: boolean };

/**
 * Same segmentation as {@link segmentNotepadForHighlight}, with each piece tagged
 * when it lies in `[playback.start, playback.end)` (for timeline / notepad sync).
 */
export function segmentNotepadWithPlayback(
  text: string,
  objectNames: string[],
  playback: { start: number; end: number } | null
): NotepadPlaybackPiece[] {
  const base = segmentNotepadForHighlight(text, objectNames);
  if (!playback || playback.start >= playback.end) {
    return base.map((s) =>
      s.type === "text"
        ? { type: "text", value: s.value, playback: false }
        : { type: "mention", value: s.value, kind: s.kind, playback: false }
    );
  }
  const p0 = playback.start;
  const p1 = playback.end;
  const out: NotepadPlaybackPiece[] = [];
  let pos = 0;
  for (const seg of base) {
    const slice = seg.value;
    const n = slice.length;
    const a = pos;
    const b = pos + n;
    if (seg.type === "text") {
      let i = 0;
      while (i < n) {
        const abs = a + i;
        const inside = abs >= p0 && abs < p1;
        let j = i + 1;
        while (j < n) {
          const absJ = a + j;
          const ins = absJ >= p0 && absJ < p1;
          if (ins !== inside) break;
          j++;
        }
        out.push({
          type: "text",
          value: slice.slice(i, j),
          playback: inside,
        });
        i = j;
      }
    } else {
      const overlaps = Math.max(p0, a) < Math.min(p1, b);
      out.push({
        type: "mention",
        value: seg.value,
        kind: seg.kind,
        playback: overlaps,
      });
    }
    pos = b;
  }
  return out;
}

export type NotepadDualPlaybackPiece =
  | { type: "text"; value: string; playback: "none" | "event" | "line" }
  | {
      type: "mention";
      value: string;
      kind: MentionKind;
      playback: "none" | "event" | "line";
    };

function charRangeForHeuristicLineInSlice(
  slice: string,
  heuristicLineIndex: number
): { start: number; end: number } | null {
  if (heuristicLineIndex < 0) return null;
  const lines = slice.split(/\r?\n/);
  let hi = 0;
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();
    const lineStart = offset;
    const lineEnd = offset + line.length;
    offset = lineEnd + 1;
    if (trimmed.length === 0) continue;
    if (hi === heuristicLineIndex) {
      return { start: lineStart, end: lineEnd };
    }
    hi++;
  }
  return null;
}

/** Paragraphs split by `\n\n`+; only non-empty (trimmed) bodies, matching workspace heuristic. */
export function notepadNonEmptyParagraphRanges(
  raw: string
): { start: number; end: number }[] {
  const re = /\n\n+/g;
  const chunks: { start: number; end: number }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    chunks.push({ start: last, end: m.index });
    last = re.lastIndex;
  }
  chunks.push({ start: last, end: raw.length });
  return chunks.filter(
    (c) => raw.slice(c.start, c.end).replace(/\r/g, "").trim().length > 0
  );
}

export function notepadStructuredPlaybackRanges(
  raw: string,
  eventIndex: number,
  lineIndexInEvent: number
): {
  event: { start: number; end: number };
  line: { start: number; end: number } | null;
} | null {
  const paras = notepadNonEmptyParagraphRanges(raw);
  if (eventIndex < 0 || eventIndex >= paras.length) return null;
  const { start: p0, end: p1 } = paras[eventIndex]!;
  const paraText = raw.slice(p0, p1);
  const lineLocal = charRangeForHeuristicLineInSlice(
    paraText,
    lineIndexInEvent
  );
  const event = { start: p0, end: p1 };
  const line = lineLocal
    ? { start: p0 + lineLocal.start, end: p0 + lineLocal.end }
    : null;
  return { event, line };
}

/**
 * Stronger highlight for the active interaction line; paler tint for the whole event paragraph.
 */
export function segmentNotepadWithDualPlayback(
  text: string,
  objectNames: string[],
  eventRange: { start: number; end: number } | null,
  lineRange: { start: number; end: number } | null
): NotepadDualPlaybackPiece[] {
  const base = segmentNotepadForHighlight(text, objectNames);
  const tierAt = (abs: number, a: number, b: number) =>
    abs >= a && abs < b ? true : false;

  const e0 = eventRange?.start ?? -1;
  const e1 = eventRange?.end ?? -1;
  const l0 = lineRange?.start ?? -1;
  const l1 = lineRange?.end ?? -1;
  const hasEvent = eventRange && e0 < e1;
  const hasLine = lineRange && l0 < l1;

  const playbackForAbs = (abs: number): "none" | "event" | "line" => {
    if (hasLine && tierAt(abs, l0, l1)) return "line";
    if (hasEvent && tierAt(abs, e0, e1)) return "event";
    return "none";
  };

  const out: NotepadDualPlaybackPiece[] = [];
  let pos = 0;
  for (const seg of base) {
    const slice = seg.value;
    const n = slice.length;
    const a = pos;
    const b = pos + n;
    if (seg.type === "text") {
      let i = 0;
      while (i < n) {
        const abs = a + i;
        const tier = playbackForAbs(abs);
        let j = i + 1;
        while (j < n) {
          if (playbackForAbs(a + j) !== tier) break;
          j++;
        }
        out.push({
          type: "text",
          value: slice.slice(i, j),
          playback: tier,
        });
        i = j;
      }
    } else {
      let tier: "none" | "event" | "line" = "none";
      if (hasLine && Math.max(l0, a) < Math.min(l1, b)) tier = "line";
      else if (hasEvent && Math.max(e0, a) < Math.min(e1, b)) tier = "event";
      out.push({
        type: "mention",
        value: seg.value,
        kind: seg.kind,
        playback: tier,
      });
    }
    pos = b;
  }
  return out;
}

/** Fragments for rendering highlight layer with an inline ghost completion at `cursor`. */
export type NotepadGhostSlice =
  | {
      type: "fragment";
      piece: NotepadDualPlaybackPiece;
      start: number;
      end: number;
    }
  | { type: "ghost"; text: string };

/**
 * Split dual-playback pieces so an inline ghost can be drawn at `cursor` (0…textLength).
 * When the cursor lies inside a mention, the ghost is omitted for that span (mention UI handles typing).
 */
export function dualPlaybackPiecesWithGhost(
  pieces: NotepadDualPlaybackPiece[],
  cursor: number,
  ghost: string
): NotepadGhostSlice[] {
  if (!ghost) {
    return pieces.map((piece) => ({
      type: "fragment" as const,
      piece,
      start: 0,
      end: piece.value.length,
    }));
  }

  const out: NotepadGhostSlice[] = [];
  let pos = 0;
  let ghostDone = false;

  const pushGhost = () => {
    if (ghostDone) return;
    out.push({ type: "ghost", text: ghost });
    ghostDone = true;
  };

  for (const piece of pieces) {
    const n = piece.value.length;
    const end = pos + n;

    if (!ghostDone && cursor < end) {
      if (piece.type === "mention") {
        out.push({ type: "fragment", piece, start: 0, end: n });
        ghostDone = true;
        pos = end;
        continue;
      }
      if (cursor > pos) {
        const local = cursor - pos;
        out.push({ type: "fragment", piece, start: 0, end: local });
        pushGhost();
        out.push({ type: "fragment", piece, start: local, end: n });
      } else {
        pushGhost();
        out.push({ type: "fragment", piece, start: 0, end: n });
      }
      pos = end;
      continue;
    }

    out.push({ type: "fragment", piece, start: 0, end: n });
    if (!ghostDone && cursor === end) {
      pushGhost();
    }
    pos = end;
  }

  if (!ghostDone) {
    pushGhost();
  }

  return out;
}

/**
 * Map a heuristic line index (non-empty trimmed rows, same as workspace heuristic)
 * to inclusive start and exclusive end character offsets in the raw notepad.
 */
export function notepadCharRangeForHeuristicLine(
  raw: string,
  heuristicLineIndex: number
): { start: number; end: number } | null {
  if (heuristicLineIndex < 0) return null;
  const lines = raw.split(/\r?\n/);
  let hi = 0;
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineStart = offset;
    const lineEnd = offset + line.length;
    offset = lineEnd + 1;
    if (trimmed.length === 0) continue;
    if (hi === heuristicLineIndex) {
      return { start: lineStart, end: lineEnd };
    }
    hi++;
  }
  return null;
}

/**
 * For display: one highlight chip for the whole @mention token (including spaces).
 * Bounds come from {@link scanMentionToken} / {@link segmentNotepadForHighlight}, so
 * multi-word universe names like `@Lysara Ashveil` stay a single resolved mention — no
 * extra hidden markup is required for highlighting.
 */
export function splitMentionEmphasis(mentionWithAt: string): {
  emphasized: string;
  rest: string;
} {
  if (!mentionWithAt.startsWith("@")) {
    return { emphasized: mentionWithAt, rest: "" };
  }
  return { emphasized: mentionWithAt, rest: "" };
}

/** Strip @ for workspace heuristic; needs object names for correct mention bounds. */
export function notepadTextForHeuristic(
  text: string,
  objectNames: string[]
): string {
  return segmentNotepadForHighlight(text, objectNames)
    .map((s) => (s.type === "text" ? s.value : s.value.slice(1)))
    .join("");
}

function normalizeCmd(cmd: string) {
  return cmd.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Mirrors convex/lib/workspaceHeuristic + workbenchInterpret: interaction verbs or
 * beat keywords, with at least two distinct universe names present in the text.
 */
export function notepadLooksLikeInteractionBeat(
  strippedCmd: string,
  objectNames: string[]
): boolean {
  const names = objectNames.filter((n) => n.trim().length > 0);
  if (names.length < 2) return false;
  const cmd = strippedCmd.trim();
  if (cmd.length < 8) return false;
  const n = normalizeCmd(cmd);
  const mentioned = [
    ...new Set(
      names.filter((name) => n.includes(name.toLowerCase()))
    ),
  ];
  if (mentioned.length < 2) return false;

  const hasVerb =
    /\b(interacts?\s+with|talks?\s+to|confronts?|fights?|kisses?|loves?|kills?|murders?|attacks?|warns?|helps?|saves?|chases?|follows?|avoids?|gives\s+to|stares?\s+at|hands?\s+to|runs?\s+away\s+from)\b/i.test(
      cmd
    );
  const hasChain =
    /\bwho\s+then\b|\bwho\s+also\b|\band\s+then\b/i.test(cmd);
  const hasBeatKeywords =
    /\b(interaction|relationship|beat|keyframe)\b/i.test(cmd);

  return hasVerb || hasChain || hasBeatKeywords;
}
