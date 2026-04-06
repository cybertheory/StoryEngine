"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo } from "react";

interface ObjectTokenData {
  name: string;
  kind: string;
  imageUrl?: string;
  description: string;
  [key: string]: unknown;
}

const KIND_COLORS: Record<string, string> = {
  character: "border-l-foreground",
  place: "border-l-foreground/60",
  item: "border-l-foreground/40",
  faction: "border-l-foreground/80",
  lore: "border-l-foreground/30",
  event_type: "border-l-foreground/20",
};

export const ObjectTokenNode = memo(function ObjectTokenNode({
  data,
  selected,
}: NodeProps) {
  const d = data as ObjectTokenData;
  const borderClass = KIND_COLORS[d.kind] ?? "border-l-foreground/50";

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-foreground !border-background !border-2"
      />
      <div
        className={`bg-background border border-foreground/20 border-l-4 ${borderClass} shadow-sm min-w-[120px] max-w-[160px] transition-shadow ${
          selected ? "shadow-md ring-2 ring-foreground/30" : ""
        }`}
      >
        <div className="p-2">
          {d.imageUrl && (
            <img
              src={d.imageUrl}
              alt={d.name}
              className="w-full h-16 object-cover mb-1.5 border border-foreground/10"
            />
          )}
          <p className="text-xs font-display font-bold leading-tight truncate">
            {d.name}
          </p>
          <p className="text-[9px] font-mono-face tracking-wider uppercase text-muted-foreground mt-0.5">
            {d.kind}
          </p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-foreground !border-background !border-2"
      />
    </>
  );
});
