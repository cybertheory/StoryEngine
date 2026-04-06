"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  activeMentionAtCursor,
  dualPlaybackPiecesWithGhost,
  segmentNotepadWithDualPlayback,
  splitMentionEmphasis,
  type NotepadDualPlaybackPiece,
  type NotepadGhostSlice,
} from "@/lib/notepad-highlight";
import { cn } from "@/lib/utils";

/** Must match textarea exactly so the caret lines up with the highlight layer (no extra padding / font-weight in overlay only). */
const NOTEPAD_MIRROR_TEXT =
  "box-border overflow-auto workspace-scrollbar px-4 py-4 font-body text-xl font-normal leading-relaxed tracking-tight whitespace-pre-wrap break-words";

type Obj = {
  _id: string;
  name: string;
  kind: string;
  imageUrl?: string;
};

type Props = {
  value: string;
  onChange: (next: string) => void;
  objects: Obj[];
  storyId: Id<"stories">;
  sessionToken: string | null;
  canUseWorkbench: boolean;
  className?: string;
  /**
   * When this changes (e.g. scene or workspace bundle), Tab-autocomplete waits for a new
   * user keystroke/paste before fetching — avoids suggestions on load for existing notes.
   */
  autocompleteResetKey: string;
  /** Pale highlight for the whole scene-event paragraph during timeline playback. */
  playbackEventRange?: { start: number; end: number } | null;
  /** Stronger highlight for the active interaction line. */
  playbackLineRange?: { start: number; end: number } | null;
};

const AUTOCOMPLETE_DEBOUNCE_MS = 420;

export function StoryNotepad({
  value,
  onChange,
  objects,
  storyId,
  sessionToken,
  canUseWorkbench,
  className,
  autocompleteResetKey,
  playbackEventRange = null,
  playbackLineRange = null,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const hiRef = useRef<HTMLDivElement>(null);
  const tabCompletion = useAction(api.notepadAssist.tabCompletion);
  const autocompleteRunIdRef = useRef(0);
  /** AI ghost only after the user types/pastes in this editor session (per `autocompleteResetKey`). */
  const [typedSinceReset, setTypedSinceReset] = useState(false);

  const [mention, setMention] = useState<{
    start: number;
    query: string;
  } | null>(null);
  /** Keyboard selection row while @ menu is open (ArrowUp/Down do not move the caret). */
  const [mentionPickIndex, setMentionPickIndex] = useState(0);
  const mentionListRef = useRef<HTMLDivElement>(null);
  const [caret, setCaret] = useState(0);
  const [ghostText, setGhostText] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const names = useMemo(() => objects.map((o) => o.name), [objects]);

  const filteredObjects = useMemo(() => {
    if (!mention) return objects;
    const q = mention.query.toLowerCase().trim();
    if (!q) return objects.slice(0, 40);
    return objects
      .filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.kind.toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [mention, objects]);

  useEffect(() => {
    if (mention === null) return;
    setMentionPickIndex(0);
  }, [mention?.start]);

  useEffect(() => {
    if (!mention) return;
    setMentionPickIndex((i) => {
      if (filteredObjects.length === 0) return 0;
      return Math.min(i, filteredObjects.length - 1);
    });
  }, [mention, filteredObjects.length]);

  useEffect(() => {
    if (!mention || filteredObjects.length === 0) return;
    const row = mentionListRef.current?.querySelector<HTMLElement>(
      `[data-mention-index="${mentionPickIndex}"]`
    );
    row?.scrollIntoView({ block: "nearest" });
  }, [mention, mentionPickIndex, filteredObjects.length]);

  const highlightPieces = useMemo(
    () =>
      segmentNotepadWithDualPlayback(
        value,
        names,
        playbackEventRange ?? null,
        playbackLineRange ?? null
      ),
    [value, names, playbackEventRange, playbackLineRange]
  );

  const ghostSlices: NotepadGhostSlice[] = useMemo(() => {
    if (!ghostText || mention) {
      return highlightPieces.map((piece) => ({
        type: "fragment" as const,
        piece,
        start: 0,
        end: piece.value.length,
      }));
    }
    const c = Math.min(Math.max(0, caret), value.length);
    return dualPlaybackPiecesWithGhost(highlightPieces, c, ghostText);
  }, [highlightPieces, caret, ghostText, mention]);

  const playbackTierClass = (tier: "none" | "event" | "line") => {
    if (tier === "line") {
      return "rounded-[2px] bg-yellow-300/90 text-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:bg-yellow-400/35 dark:text-foreground dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]";
    }
    if (tier === "event") {
      return "rounded-[2px] bg-amber-200/45 text-foreground dark:bg-amber-500/18 dark:text-foreground";
    }
    return "";
  };

  const renderPieceFragment = (
    piece: NotepadDualPlaybackPiece,
    start: number,
    end: number,
    key: string
  ) => {
    const sub = piece.value.slice(start, end);
    if (sub.length === 0) return null;
    const pb =
      piece.playback !== "none" ? playbackTierClass(piece.playback) : "";
    if (piece.type === "text") {
      return (
        <span key={key} className={cn(pb || undefined)}>
          {sub}
        </span>
      );
    }
    const { emphasized, rest } = splitMentionEmphasis(sub);
    const inner =
      piece.kind === "resolved" ? (
        <>
          <span className="rounded-sm bg-amber-500/25 text-amber-950 dark:text-amber-100">
            {emphasized}
          </span>
          {rest ? <span className="text-foreground">{rest}</span> : null}
        </>
      ) : piece.kind === "prefix" ? (
        <>
          <span className="rounded-sm bg-foreground/10 text-foreground">
            {emphasized}
          </span>
          {rest ? (
            <span className="text-foreground/90">{rest}</span>
          ) : null}
        </>
      ) : (
        <>
          <span className="rounded-sm bg-muted/60 text-muted-foreground">
            {emphasized}
          </span>
          {rest ? (
            <span className="text-muted-foreground">{rest}</span>
          ) : null}
        </>
      );
    if (piece.playback !== "none") {
      return (
        <span key={key} className={pb}>
          {inner}
        </span>
      );
    }
    return <span key={key}>{inner}</span>;
  };

  const syncScroll = useCallback(() => {
    const ta = taRef.current;
    const hi = hiRef.current;
    if (ta && hi) {
      hi.scrollTop = ta.scrollTop;
      hi.scrollLeft = ta.scrollLeft;
    }
  }, []);

  const detectMention = useCallback(
    (text: string, cursor: number) => {
      const m = activeMentionAtCursor(text, cursor, names);
      setMention(m);
    },
    [names]
  );

  const insertMention = useCallback(
    (name: string) => {
      if (!mention || !taRef.current) return;
      const ta = taRef.current;
      const cur = ta.selectionStart;
      const before = value.slice(0, mention.start);
      const after = value.slice(cur);
      const insert = `@${name} `;
      const next = before + insert + after;
      onChange(next);
      setMention(null);
      setGhostText(null);
      requestAnimationFrame(() => {
        ta.focus();
        const pos = before.length + insert.length;
        ta.setSelectionRange(pos, pos);
        setCaret(pos);
      });
    },
    [mention, value, onChange]
  );

  const acceptGhost = useCallback(() => {
    if (!ghostText || mention) return;
    const ta = taRef.current;
    const cursor = Math.min(Math.max(0, caret), value.length);
    const next = value.slice(0, cursor) + ghostText + value.slice(cursor);
    setTypedSinceReset(true);
    onChange(next);
    setGhostText(null);
    setAiError(null);
    const end = cursor + ghostText.length;
    requestAnimationFrame(() => {
      if (ta) {
        ta.focus();
        ta.setSelectionRange(end, end);
        setCaret(end);
      }
    });
  }, [ghostText, mention, caret, value, onChange]);

  useEffect(() => {
    autocompleteRunIdRef.current += 1;
    setGhostText(null);
    setAiError(null);
    setTypedSinceReset(false);
  }, [autocompleteResetKey]);

  useEffect(() => {
    if (!sessionToken || !canUseWorkbench || mention) {
      autocompleteRunIdRef.current += 1;
      setGhostText(null);
      return;
    }

    if (!typedSinceReset) {
      setGhostText(null);
      return;
    }

    const before = value.slice(0, Math.min(Math.max(0, caret), value.length));
    if (!before.trim()) {
      setGhostText(null);
      return;
    }

    const myRun = ++autocompleteRunIdRef.current;
    const t = window.setTimeout(() => {
      void (async () => {
        if (myRun !== autocompleteRunIdRef.current) return;
        setAiError(null);
        try {
          const prior = value.slice(
            0,
            Math.max(0, Math.min(caret, value.length) - 1200)
          );
          const res = await tabCompletion({
            sessionToken,
            storyId,
            textBeforeCursor: before,
            priorContext:
              prior.length < before.length ? prior : undefined,
          });
          if (myRun !== autocompleteRunIdRef.current) return;
          if (!res.ok) {
            setGhostText(null);
            setAiError(res.message);
            return;
          }
          setGhostText(res.completion.trim() ? res.completion : null);
        } catch (e) {
          if (myRun !== autocompleteRunIdRef.current) return;
          setGhostText(null);
          setAiError(e instanceof Error ? e.message : "Autocomplete failed.");
        }
      })();
    }, AUTOCOMPLETE_DEBOUNCE_MS);

    return () => window.clearTimeout(t);
  }, [
    value,
    caret,
    mention,
    sessionToken,
    canUseWorkbench,
    storyId,
    tabCompletion,
    typedSinceReset,
  ]);

  useEffect(() => {
    syncScroll();
  }, [value, syncScroll]);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col bg-background",
        className
      )}
    >
      <div className="shrink-0 border-b border-foreground/10 px-3 py-1.5 flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-mono-face uppercase tracking-wider text-muted-foreground">
            Writer notepad
          </p>
          {ghostText ? (
            <p className="text-[10px] font-mono-face text-muted-foreground">
              Tab accept · Esc dismiss
            </p>
          ) : null}
        </div>
        <p className="text-[10px] font-mono-face leading-snug text-muted-foreground/90">
          <span className="text-foreground/70">Enter</span> — next interaction ·{" "}
          <span className="text-foreground/70">Blank line</span> — new timeline
          event.
        </p>
      </div>

      {aiError ? (
        <p className="shrink-0 px-3 py-1 text-[10px] font-mono-face text-destructive/90 border-b border-foreground/5">
          {aiError}
        </p>
      ) : null}

      <div className="relative min-h-0 flex-1 flex flex-col">
        {mention ? (
          <div className="shrink-0 z-20 border-b border-foreground/10 bg-popover p-2 shadow-sm">
            <p className="mb-1 text-[9px] font-mono-face uppercase tracking-wider text-muted-foreground">
              ↑↓ Enter · filter after @
              {mention.query ? ` (“${mention.query}”)` : ""}
            </p>
            <div
              ref={mentionListRef}
              className="max-h-[min(40vh,200px)] overflow-auto rounded-md border border-foreground/10 divide-y divide-foreground/5"
            >
              {filteredObjects.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground text-center">
                  No objects match.
                </p>
              ) : (
                filteredObjects.map((o, idx) => (
                  <button
                    key={o._id}
                    type="button"
                    data-mention-index={idx}
                    className={cn(
                      "flex w-full items-center gap-2 px-2 py-2 text-left text-sm hover:bg-muted/80",
                      idx === mentionPickIndex &&
                        "bg-muted/90 ring-1 ring-inset ring-foreground/15"
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setMentionPickIndex(idx)}
                    onClick={() => insertMention(o.name)}
                  >
                    {o.imageUrl ? (
                      <img
                        src={o.imageUrl}
                        alt=""
                        className="h-6 w-6 shrink-0 object-cover border border-foreground/10"
                      />
                    ) : (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-foreground/10 bg-muted text-[9px] font-mono-face">
                        {o.name[0]}
                      </div>
                    )}
                    <span className="min-w-0 truncate font-body">{o.name}</span>
                    <span className="ml-auto shrink-0 text-[9px] uppercase text-muted-foreground">
                      {o.kind}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            ref={hiRef}
            className={cn(
              "pointer-events-none absolute inset-0 text-foreground",
              NOTEPAD_MIRROR_TEXT
            )}
            aria-hidden
          >
            {ghostSlices.map((slice, i) => {
              if (slice.type === "ghost") {
                return (
                  <span
                    key={`g-${i}`}
                    className="text-foreground/28 select-none dark:text-foreground/35"
                  >
                    {slice.text}
                  </span>
                );
              }
              return renderPieceFragment(
                slice.piece,
                slice.start,
                slice.end,
                `f-${i}`
              );
            })}
            {value.endsWith("\n") ? <br /> : null}
          </div>
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => {
              setTypedSinceReset(true);
              onChange(e.target.value);
              const cur = e.target.selectionStart;
              setCaret(cur);
              detectMention(e.target.value, cur);
            }}
            onSelect={(e) => {
              const cur = e.currentTarget.selectionStart;
              setCaret(cur);
              detectMention(e.currentTarget.value, cur);
            }}
            onKeyUp={(e) => {
              if (
                mention &&
                filteredObjects.length > 0 &&
                (e.key === "ArrowDown" ||
                  e.key === "ArrowUp" ||
                  e.key === "Enter" ||
                  e.key === "Tab")
              ) {
                return;
              }
              const cur = e.currentTarget.selectionStart;
              setCaret(cur);
              detectMention(e.currentTarget.value, cur);
            }}
            onScroll={syncScroll}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                if (mention) {
                  e.preventDefault();
                  setMention(null);
                  return;
                }
                if (ghostText) {
                  e.preventDefault();
                  setGhostText(null);
                  setAiError(null);
                }
                return;
              }

              if (!mention || filteredObjects.length === 0) {
                if (
                  mention &&
                  filteredObjects.length === 0 &&
                  e.key === "Enter" &&
                  !e.shiftKey
                ) {
                  e.preventDefault();
                  setMention(null);
                }
                if (
                  e.key === "Tab" &&
                  !e.shiftKey &&
                  ghostText &&
                  !mention
                ) {
                  e.preventDefault();
                  acceptGhost();
                }
                return;
              }

              if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionPickIndex((i) =>
                  i + 1 >= filteredObjects.length ? 0 : i + 1
                );
                return;
              }

              if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionPickIndex((i) =>
                  i <= 0 ? filteredObjects.length - 1 : i - 1
                );
                return;
              }

              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const o = filteredObjects[mentionPickIndex];
                if (o) insertMention(o.name);
                return;
              }

              if (e.key === "Tab" && !e.shiftKey) {
                e.preventDefault();
                const o = filteredObjects[mentionPickIndex];
                if (o) insertMention(o.name);
                return;
              }
            }}
            spellCheck={false}
            className={cn(
              "relative z-[1] min-h-full w-full resize-none border-0 bg-transparent text-transparent caret-foreground outline-none ring-0 selection:bg-foreground/15 placeholder:text-muted-foreground/40",
              NOTEPAD_MIRROR_TEXT
            )}
            placeholder="Write beats — placements and timeline update after a short pause. Enter = new line (each line is a timeline block). Type @ to pick an object. Pause typing to see grey autocomplete — Tab to accept. Use @ExactName for universe objects."
          />
        </div>
      </div>
    </div>
  );
}
