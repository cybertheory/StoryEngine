"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type DragMode = "move" | "resize-left" | "resize-right";

/**
 * Draggable scene block on the chapter timeline. Overlap with other scenes is allowed.
 */
export function ChapterSceneTimelineClip({
  sceneId,
  label,
  startTick,
  duration,
  tickWidth,
  minDuration = 3,
  readOnly,
  onUpdate,
}: {
  sceneId: string;
  label: string;
  startTick: number;
  duration: number;
  tickWidth: number;
  minDuration?: number;
  readOnly?: boolean;
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
      const ns = Math.max(0, Math.round(s));
      const nd = Math.max(minDuration, Math.round(d));
      return { start: ns, dur: nd };
    },
    [minDuration]
  );

  useEffect(() => {
    if (!drag || readOnly) return;

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
      const c = clamp(s, d);
      latest.current = { start: c.start, dur: c.dur };
      setPreview({ start: c.start, dur: c.dur });
    };

    const onUp = () => {
      const { start: s, dur: d } = latest.current;
      const c = clamp(s, d);
      onUpdate(sceneId, c.start, c.dur);
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
  }, [drag, tickWidth, minDuration, clamp, onUpdate, sceneId, readOnly]);

  const startPointer = (e: React.PointerEvent, mode: DragMode) => {
    if (readOnly) return;
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
  const leftPx = s * tickWidth;

  return (
    <div
      className="absolute top-1 z-[5] flex h-7 items-stretch border border-foreground/30 bg-emerald-500/20 hover:bg-emerald-500/30 hover:border-foreground/50 select-none"
      style={{ left: leftPx, width: widthPx }}
      title={`${label} · ticks ${s}–${s + d}`}
      onClick={(e) => e.stopPropagation()}
    >
      {!readOnly ? (
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
          <TooltipContent side="top">Drag to move scene start</TooltipContent>
        </Tooltip>
      ) : null}
      <div
        className={`min-w-0 flex-1 px-1 flex items-center ${readOnly ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
        onPointerDown={(e) => startPointer(e, "move")}
      >
        <span className="text-[8px] font-mono-face text-foreground/90 truncate pointer-events-none">
          {label}
        </span>
      </div>
      {!readOnly ? (
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
          <TooltipContent side="top">Drag to change scene length</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
