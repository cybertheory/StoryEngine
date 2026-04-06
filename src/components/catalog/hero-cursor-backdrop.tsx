"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type RefObject,
} from "react";

const GRID_STEP = 48;
const LINE_SAMPLE = 6;
const TRAIL_MAX = 56;
const BLOB_RADIUS = 140;
const DEFORM_RADIUS = 380;
const DEFORM_STRENGTH = 42;

function deform(
  px: number,
  py: number,
  cx: number,
  cy: number
): { x: number; y: number } {
  const dx = px - cx;
  const dy = py - cy;
  const dist2 = dx * dx + dy * dy + 120;
  const t = Math.exp(-dist2 / (DEFORM_RADIUS * DEFORM_RADIUS));
  const mag = DEFORM_STRENGTH * t;
  const d = Math.sqrt(dist2);
  return {
    x: px + (dx / d) * mag,
    y: py + (dy / d) * mag,
  };
}

type HeroCursorBackdropProps = {
  containerRef: RefObject<HTMLElement | null>;
};

export function HeroCursorBackdrop({ containerRef }: HeroCursorBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const cursorRef = useRef({ x: 0, y: 0 });
  const insideRef = useRef(false);
  const reducedRef = useRef(false);
  const rafRef = useRef(0);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w < 1 || h < 1) return;

    const reduced = reducedRef.current;
    const cx = cursorRef.current.x;
    const cy = cursorRef.current.y;

    const push = (px: number, py: number) =>
      reduced ? { x: px, y: py } : deform(px, py, cx, cy);

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255,255,255,0.085)";
    ctx.lineWidth = 1;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (let gx = 0; gx <= w + GRID_STEP; gx += GRID_STEP) {
      ctx.beginPath();
      for (let y = 0; y <= h; y += LINE_SAMPLE) {
        const p = push(gx, y);
        if (y === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    for (let gy = 0; gy <= h + GRID_STEP; gy += GRID_STEP) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += LINE_SAMPLE) {
        const p = push(x, gy);
        if (x === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    if (!reduced) {
      const trail = trailRef.current;
      for (let i = 0; i < trail.length; i++) {
        const p = trail[i];
        const u = (i + 1) / trail.length;
        const r = 6 + u * 52;
        const alphaCore = 0.06 + u * 0.14;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgba(255,255,255,${alphaCore * 0.85})`);
        g.addColorStop(0.35, `rgba(255,255,255,${alphaCore * 0.35})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (insideRef.current) {
        const br = BLOB_RADIUS;
        const blob = ctx.createRadialGradient(cx, cy, 0, cx, cy, br);
        blob.addColorStop(0, "rgba(255,255,255,0.38)");
        blob.addColorStop(0.25, "rgba(255,255,255,0.12)");
        blob.addColorStop(0.55, "rgba(255,255,255,0.03)");
        blob.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = blob;
        ctx.beginPath();
        ctx.arc(cx, cy, br, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;

    const syncSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawFrame();
    };

    const restartMotion = () => {
      cancelAnimationFrame(rafRef.current);
      if (reducedRef.current) {
        drawFrame();
        return;
      }
      const tick = () => {
        drawFrame();
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    const onMq = () => {
      reducedRef.current = mq.matches;
      restartMotion();
    };
    mq.addEventListener("change", onMq);

    const setFromEvent = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      cursorRef.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
      trailRef.current.push({ ...cursorRef.current });
      if (trailRef.current.length > TRAIL_MAX) {
        trailRef.current.shift();
      }
    };

    const onMove = (e: MouseEvent) => {
      if (reducedRef.current) return;
      insideRef.current = true;
      setFromEvent(e.clientX, e.clientY);
    };

    const onLeave = () => {
      insideRef.current = false;
      trailRef.current = [];
    };

    const onEnter = (e: MouseEvent) => {
      if (reducedRef.current) return;
      insideRef.current = true;
      setFromEvent(e.clientX, e.clientY);
    };

    const onTouch = (e: TouchEvent) => {
      if (reducedRef.current || e.touches.length === 0) return;
      const t = e.touches[0];
      insideRef.current = true;
      setFromEvent(t.clientX, t.clientY);
    };

    const onTouchEnd = () => {
      insideRef.current = false;
      trailRef.current = [];
    };

    syncSize();
    const rect = container.getBoundingClientRect();
    cursorRef.current = {
      x: rect.width / 2,
      y: rect.height / 2,
    };

    const ro = new ResizeObserver(syncSize);
    ro.observe(container);

    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseenter", onEnter);
    container.addEventListener("mouseleave", onLeave);
    container.addEventListener("touchmove", onTouch, { passive: true });
    container.addEventListener("touchstart", onTouch, { passive: true });
    container.addEventListener("touchend", onTouchEnd);
    container.addEventListener("touchcancel", onTouchEnd);

    restartMotion();

    return () => {
      cancelAnimationFrame(rafRef.current);
      mq.removeEventListener("change", onMq);
      ro.disconnect();
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseenter", onEnter);
      container.removeEventListener("mouseleave", onLeave);
      container.removeEventListener("touchmove", onTouch);
      container.removeEventListener("touchstart", onTouch);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [containerRef, drawFrame]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-0 block h-full w-full"
      aria-hidden
    />
  );
}
