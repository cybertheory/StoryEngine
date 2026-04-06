"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { memo } from "react";

interface InteractionEdgeData {
  label: string;
  style: "solid" | "dashed" | "wavy" | "dotted";
  meaning?: string;
  [key: string]: unknown;
}

const STYLE_MAP: Record<string, string> = {
  solid: "2",
  dashed: "6 4",
  dotted: "2 4",
  wavy: "2",
};

export const InteractionEdge = memo(function InteractionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const d = data as InteractionEdgeData;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const markerId = `so-arrow-${id}`;
  const headFill = selected ? "#0a0a0a" : "#0a0a0a99";

  return (
    <>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 12 12"
          refX={10}
          refY={6}
          orient="auto"
          markerWidth={9}
          markerHeight={9}
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0.5 1.5 L 10 6 L 0.5 10.5 Z" fill={headFill} />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={`url(#${markerId})`}
        style={{
          stroke: selected ? "#0a0a0a" : "#0a0a0a80",
          strokeWidth: selected ? 2 : 1.5,
          strokeDasharray: STYLE_MAP[d?.style ?? "solid"],
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          title={d?.meaning ? d.meaning : undefined}
          className={`max-w-[140px] truncate px-1.5 py-0.5 text-[9px] font-mono-face border bg-background transition-colors ${
            selected
              ? "border-foreground text-foreground"
              : "border-foreground/30 text-muted-foreground"
          }`}
        >
          {d?.label ?? "interaction"}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});
