/**
 * Map notepad-derived keyframes (with optional lineIndex per Enter-separated row)
 * onto timeline ticks: one start tick per line; chained clauses on the same line
 * share that tick. A new line (after Enter) starts after a gap.
 */

/** Extra ticks after each notepad line’s beats before the next line’s tick. */
export const NOTEPAD_LINE_GAP_TICKS = 24;

/** Padding between narrative scene events on the interaction timeline (from `\n\n`). */
export const NOTEPAD_EVENT_PAD_TICKS = 32;

/**
 * Assign start ticks: every beat on the same `lineIndex` gets the same value;
 * the next line’s group starts at previous + `lineGapTicks`.
 */
export function startTicksForNotepadKeyframes(
  frames: ReadonlyArray<{ lineIndex?: number }>,
  lineGapTicks: number = NOTEPAD_LINE_GAP_TICKS
): number[] {
  const n = frames.length;
  if (n === 0) return [];

  const hasLineMeta = frames.some(
    (f) => f.lineIndex !== undefined && f.lineIndex !== null
  );
  if (!hasLineMeta) {
    return frames.map((_, i) => i * lineGapTicks);
  }

  const starts = new Array<number>(n);
  let i = 0;
  let blockStart = 0;

  while (i < n) {
    const lineKey = frames[i].lineIndex ?? 0;
    let j = i + 1;
    while (j < n && (frames[j].lineIndex ?? 0) === lineKey) {
      j++;
    }
    const count = j - i;
    for (let k = 0; k < count; k++) {
      starts[i + k] = blockStart;
    }
    blockStart += lineGapTicks;
    i = j;
  }

  return starts;
}

/**
 * Like `startTicksForNotepadKeyframes`, but lines are scoped per `eventIndex`
 * (paragraph from `\n\n`). Events are laid out sequentially on the tick axis.
 */
export function startTicksForStructuredNotepad(
  frames: ReadonlyArray<{ eventIndex: number; lineIndexInEvent: number }>,
  lineGapTicks: number = NOTEPAD_LINE_GAP_TICKS,
  eventPadTicks: number = NOTEPAD_EVENT_PAD_TICKS
): number[] {
  const n = frames.length;
  if (n === 0) return [];
  const result = new Array<number>(n).fill(0);
  const maxEvent = Math.max(...frames.map((f) => f.eventIndex));

  let eventCursor = 0;
  for (let e = 0; e <= maxEvent; e++) {
    const lineSet = new Set<number>();
    for (let i = 0; i < n; i++) {
      if (frames[i].eventIndex === e) {
        lineSet.add(frames[i].lineIndexInEvent);
      }
    }
    const sortedLines = [...lineSet].sort((a, b) => a - b);
    let lineCursor = 0;
    for (const line of sortedLines) {
      for (let i = 0; i < n; i++) {
        if (
          frames[i].eventIndex === e &&
          frames[i].lineIndexInEvent === line
        ) {
          result[i] = eventCursor + lineCursor;
        }
      }
      lineCursor += lineGapTicks;
    }
    eventCursor += lineCursor + eventPadTicks;
  }
  return result;
}
