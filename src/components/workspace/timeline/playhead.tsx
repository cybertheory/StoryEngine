"use client";

import { useCallback } from "react";

interface PlayheadProps {
  tick: number;
  tickWidth: number;
  /** Convert viewport clientX to timeline tick (parent has timeline layout + totalTicks). */
  clientXToTick: (clientX: number) => number;
  onScrubTick: (tick: number) => void;
  /** Pause playback when user grabs the playhead. */
  onScrubInteraction?: () => void;
  /** Offset from top of timeline rail so the line starts below ruler + event row. */
  topPx?: number;
}

export function Playhead({
  tick,
  tickWidth,
  clientXToTick,
  onScrubTick,
  onScrubInteraction,
  topPx = 0,
}: PlayheadProps) {
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();
      onScrubInteraction?.();
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      onScrubTick(clientXToTick(e.clientX));

      const onMove = (ev: PointerEvent) => {
        onScrubTick(clientXToTick(ev.clientX));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          /* released */
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [clientXToTick, onScrubInteraction, onScrubTick]
  );

  const leftPx = tick * tickWidth;

  return (
    <div
      className="absolute bottom-0 z-20 flex justify-center pointer-events-none -translate-x-1/2"
      style={{ left: leftPx, top: topPx }}
    >
      <button
        type="button"
        aria-label="Drag playhead"
        className="pointer-events-auto -mx-2 w-4 cursor-ew-resize bg-transparent border-0 p-0 flex flex-col items-center touch-none"
        onPointerDown={onPointerDown}
      >
        <span className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] border-t-foreground shrink-0" />
        <span className="flex-1 w-px min-h-[4px] bg-foreground" />
      </button>
    </div>
  );
}
