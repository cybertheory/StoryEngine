"use client";

import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type CanvasWorkspaceTab = "notepad" | "canvas";

type Props = {
  notepad: ReactNode;
  canvas: ReactNode;
  /** Controlled tab (both `tab` and `onTabChange` from parent). */
  tab?: CanvasWorkspaceTab;
  onTabChange?: (next: CanvasWorkspaceTab) => void;
};

export function CanvasWorkspacePanel({
  notepad,
  canvas,
  tab: tabProp,
  onTabChange,
}: Props) {
  const [internalTab, setInternalTab] = useState<CanvasWorkspaceTab>("notepad");
  const controlled = tabProp !== undefined;
  const tab = controlled ? tabProp : internalTab;
  const setTab = (next: CanvasWorkspaceTab) => {
    if (!controlled) setInternalTab(next);
    onTabChange?.(next);
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <div
        role="tablist"
        className="flex shrink-0 gap-0 border-b border-foreground/10 bg-muted/20 px-2"
      >
        <Tooltip>
          <TooltipTrigger
            render={(tp) => (
              <button
                type="button"
                role="tab"
                aria-selected={tab === "notepad"}
                {...tp}
                className={cn(
                  "border-b-2 px-3 py-2 text-[10px] font-mono-face uppercase tracking-wider transition-colors",
                  tab === "notepad"
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground/80",
                  tp.className
                )}
                onClick={(e) => {
                  tp.onClick?.(e);
                  setTab("notepad");
                }}
              >
                Notepad
              </button>
            )}
          />
          <TooltipContent side="bottom">Scene notes and Tab autocomplete</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={(tp) => (
              <button
                type="button"
                role="tab"
                aria-selected={tab === "canvas"}
                {...tp}
                className={cn(
                  "border-b-2 px-3 py-2 text-[10px] font-mono-face uppercase tracking-wider transition-colors",
                  tab === "canvas"
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground/80",
                  tp.className
                )}
                onClick={(e) => {
                  tp.onClick?.(e);
                  setTab("canvas");
                }}
              >
                Canvas
              </button>
            )}
          />
          <TooltipContent side="bottom">
            Visual tokens and interaction links
          </TooltipContent>
        </Tooltip>
      </div>
      <div
        role="tabpanel"
        className={cn(
          "min-h-0 min-w-0 flex-1 overflow-hidden",
          tab !== "notepad" && "hidden"
        )}
      >
        {notepad}
      </div>
      <div
        role="tabpanel"
        className={cn(
          "min-h-0 min-w-0 flex-1 overflow-hidden",
          tab !== "canvas" && "hidden"
        )}
      >
        {canvas}
      </div>
    </div>
  );
}
