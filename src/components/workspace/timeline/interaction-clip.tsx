"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type DragMode = "move" | "resize-left" | "resize-right";

export function InteractionClip({
  keyframeId,
  label,
  startTick,
  duration,
  tickWidth,
  totalTicks,
  minDuration = 3,
  /** Horizontal nudge so source/target rows don’t stack the same clip on one vertical line. */
  displayOffsetPx = 0,
  /** Vertical stack when several beats overlap on the same object row. */
  laneIndex = 0,
  laneStridePx = 20,
  onUpdate,
}: {
  keyframeId: string;
  label: string;
  startTick: number;
  duration: number;
  tickWidth: number;
  totalTicks: number;
  minDuration?: number;
  displayOffsetPx?: number;
  laneIndex?: number;
  laneStridePx?: number;
  onUpdate: (id: string, nextStart: number, nextDuration: number) => void;
}) {
  const [drag, setDrag] = useState<{
    mode: DragMode;
    startClientX: number;
    origStart: number;
    origDur: number;
  } | null>(null);

  const [preview, setPreview] = useState<{
    start: number;
    dur: number;
  } | null>(null);

  const latest = useRef({ start: startTick, dur: duration });
  useEffect(() => {
    if (!drag) latest.current = { start: startTick, dur: duration };
  }, [startTick, duration, drag]);

  const clamp = useCallback(
    (s: number, d: number) => {
      let ns = Math.max(0, Math.round(s));
      let nd = Math.max(minDuration, Math.round(d));
      if (ns + nd > totalTicks) {
        nd = Math.max(minDuration, totalTicks - ns);
        ns = Math.min(ns, Math.max(0, totalTicks - nd));
      }
      return { start: ns, dur: nd };
    },
    [minDuration, totalTicks]
  );

  useEffect(() => {
    if (!drag) return;

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - drag.startClientX;
      const dTicks = dx / tickWidth;
      const { origStart, origDur, mode } = drag;
      let s = origStart;
      let d = origDur;

      if (mode === "move") {
        s = origStart + dTicks;
      } else if (mode === "resize-left") {
        s = origStart + dTicks;
        d = origDur - dTicks;
      } else {
        d = origDur + dTicks;
      }

      if (s < 0) {
        d += s;
        s = 0;
      }
      d = Math.max(minDuration, d);
      if (s + d > totalTicks) {
        if (mode === "resize-left" || mode === "move") {
          s = Math.max(0, totalTicks - d);
        } else {
          d = totalTicks - s;
        }
      }
      latest.current = { start: s, dur: d };
      setPreview({ start: s, dur: d });
    };

    const onUp = () => {
      const { start: s, dur: d } = latest.current;
      const c = clamp(s, d);
      onUpdate(keyframeId, c.start, c.dur);
      setPreview(null);
      setDrag(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag, tickWidth, minDuration, totalTicks, clamp, onUpdate, keyframeId]);

  const startPointer = (
    e: React.PointerEvent,
    mode: DragMode
  ) => {
    e.stopPropagation();
    e.preventDefault();
    latest.current = { start: startTick, dur: duration };
    setPreview({ start: startTick, dur: duration });
    setDrag({
      mode,
      startClientX: e.clientX,
      origStart: startTick,
      origDur: duration,
    });
  };

  const s = preview?.start ?? startTick;
  const d = preview?.dur ?? duration;
  const widthPx = Math.max(d * tickWidth, 10);
  const leftPx = s * tickWidth + displayOffsetPx;
  const topPx = 2 + laneIndex * laneStridePx;

  return (
    <div
      className="absolute z-[5] flex h-[18px] items-stretch border border-foreground/30 bg-violet-500/25 hover:bg-violet-500/35 hover:border-foreground/50 select-none"
      style={{ left: leftPx, width: widthPx, top: topPx }}
      title={`${label} · ticks ${s}–${s + d}`}
      onClick={(e) => e.stopPropagation()}
    >
      <Tooltip>
        <TooltipTrigger
          render={(tp) => (
            <button
              type="button"
              aria-label="Resize start"
              {...tp}
              className={cn(
                "w-1.5 shrink-0 cursor-ew-resize bg-foreground/10 hover:bg-foreground/25 border-r border-foreground/15",
                tp.className
              )}
              onPointerDown={(e) => {
                tp.onPointerDown?.(e);
                startPointer(e, "resize-left");
              }}
            />
          )}
        />
        <TooltipContent side="top">Drag to move beat start</TooltipContent>
      </Tooltip>
      <div
        className="min-w-0 flex-1 cursor-grab active:cursor-grabbing px-1 flex items-center"
        onPointerDown={(e) => startPointer(e, "move")}
      >
        <span className="text-[8px] font-mono-face text-foreground/80 truncate pointer-events-none">
          {label}
        </span>
      </div>
      <Tooltip>
        <TooltipTrigger
          render={(tp) => (
            <button
              type="button"
              aria-label="Resize end"
              {...tp}
              className={cn(
                "w-1.5 shrink-0 cursor-ew-resize bg-foreground/10 hover:bg-foreground/25 border-l border-foreground/15",
                tp.className
              )}
              onPointerDown={(e) => {
                tp.onPointerDown?.(e);
                startPointer(e, "resize-right");
              }}
            />
          )}
        />
        <TooltipContent side="top">Drag to change beat length</TooltipContent>
      </Tooltip>
    </div>
  );
}
