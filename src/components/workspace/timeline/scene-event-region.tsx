"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * One narrative scene-event band on the dedicated **events** row (not full track height).
 * Drag moves the whole event; click selects it for prose emphasis.
 */
export function SceneEventRegion({
  eventId,
  label,
  startTick,
  duration,
  tickWidth,
  totalTicks,
  selected,
  onSelect,
  onTranslate,
}: {
  eventId: string;
  /** Short label, e.g. "E1". */
  label: string;
  startTick: number;
  duration: number;
  tickWidth: number;
  totalTicks: number;
  selected: boolean;
  onSelect: (eventId: string) => void;
  onTranslate: (eventId: string, deltaTicks: number) => void;
}) {
  const [drag, setDrag] = useState<{
    startClientX: number;
    origStart: number;
    pointerId: number;
  } | null>(null);
  const [previewDelta, setPreviewDelta] = useState(0);
  const previewDeltaRef = useRef(0);
  const latest = useRef({ start: startTick, dur: duration });
  useEffect(() => {
    if (!drag) latest.current = { start: startTick, dur: duration };
  }, [startTick, duration, drag]);

  const clampStart = useCallback(
    (s: number) => {
      const d = latest.current.dur;
      let ns = Math.max(0, Math.round(s));
      if (ns + d > totalTicks) {
        ns = Math.max(0, totalTicks - d);
      }
      return ns;
    },
    [totalTicks]
  );

  useEffect(() => {
    if (!drag) return;
    previewDeltaRef.current = 0;
    setPreviewDelta(0);

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      const dTicks = Math.round((e.clientX - drag.startClientX) / tickWidth);
      previewDeltaRef.current = dTicks;
      setPreviewDelta(dTicks);
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      const dTicks = previewDeltaRef.current;
      const moved = Math.abs(e.clientX - drag.startClientX) > 4;
      setDrag(null);
      setPreviewDelta(0);
      previewDeltaRef.current = 0;
      if (moved && dTicks !== 0) {
        onTranslate(eventId, dTicks);
      } else if (!moved) {
        onSelect(eventId);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag, eventId, onTranslate, onSelect, tickWidth]);

  const displayStart = drag
    ? clampStart(drag.origStart + previewDelta)
    : startTick;

  const left = displayStart * tickWidth;
  const width = Math.max(4, duration * tickWidth);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDrag({
        startClientX: e.clientX,
        origStart: startTick,
        pointerId: e.pointerId,
      });
    },
    [startTick]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Scene event ${label}, ticks ${displayStart}–${displayStart + duration}. Click to select, drag to move.`}
      className={cn(
        "absolute top-0.5 z-[3] flex h-6 items-center justify-center rounded-sm border px-1 text-[8px] font-mono-face font-medium transition-colors",
        selected
          ? "border-primary bg-primary/20 text-foreground ring-2 ring-primary/40"
          : "border-primary/35 bg-primary/[0.09] text-foreground/80 hover:bg-primary/[0.14]",
        drag ? "cursor-grabbing" : "cursor-grab"
      )}
      style={{ left, width, minWidth: 16 }}
      title={`${label} · ticks ${displayStart}–${displayStart + duration} · drag to move all beats in this event`}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(eventId);
        }
      }}
    >
      <span className="truncate pointer-events-none">{label}</span>
    </div>
  );
}
