"use client";

import { GripVertical } from "lucide-react";
import {
  Group,
  Panel,
  Separator,
  type GroupProps,
  type SeparatorProps,
} from "react-resizable-panels";
import { cn } from "@/lib/utils";

function ResizablePanelGroup({
  className,
  ...props
}: GroupProps) {
  return (
    <Group
      className={cn(
        "flex h-full w-full",
        className
      )}
      {...props}
    />
  );
}

const ResizablePanel = Panel;

function ResizableHandle({
  withHandle,
  className,
  forVerticalGroup,
  ...props
}: SeparatorProps & {
  withHandle?: boolean;
  /**
   * Parent `Group` uses `orientation="vertical"` (panels stacked). Separator is a horizontal bar;
   * use tall hit target. Omit when parent is `orientation="horizontal"` (side‑by‑side panels).
   */
  forVerticalGroup?: boolean;
}) {
  return (
    <Separator
      className={cn(
        "relative z-10 flex items-center justify-center bg-foreground/15 transition-colors hover:bg-foreground/30 touch-none select-none",
        forVerticalGroup
          ? "h-3 w-full shrink-0 cursor-row-resize"
          : "w-3 shrink-0 self-stretch cursor-col-resize",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div
          className={cn(
            "pointer-events-none flex items-center justify-center rounded-sm border border-foreground/25 bg-background shadow-sm",
            forVerticalGroup ? "px-2 py-0.5" : "h-8 w-4"
          )}
        >
          <GripVertical
            className={cn(
              "text-muted-foreground",
              forVerticalGroup ? "h-4 w-4 rotate-90" : "h-4 w-3"
            )}
          />
        </div>
      )}
    </Separator>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
