"use client";

import { WorkspaceTooltipButton } from "@/components/workspace/workspace-tooltip-button";
import { Separator } from "@/components/ui/separator";
import { Eye, Loader2, Pencil, Settings2 } from "lucide-react";

export type ProseEventItem = {
  id: string;
  sortIndex: number;
  startTick: number;
  summaryLines: string[];
  /** Template when AI is off or loading. */
  derivedProse: string;
  /** AI-rendered passage when available. */
  displayProse: string;
  /** Opens beat editor for the first interaction in this event. */
  firstInteractionId: string | null;
};

interface ProsePanelProps {
  items: ProseEventItem[];
  activeEventId: string | null;
  onPreviewScene: () => void;
  previewDisabled?: boolean;
  proseAiLoading?: boolean;
  onOpenProseSettings?: () => void;
  onEditInteraction?: (interactionId: string) => void;
}

export function ProsePanel({
  items,
  activeEventId,
  onPreviewScene,
  previewDisabled = false,
  proseAiLoading = false,
  onOpenProseSettings,
  onEditInteraction,
}: ProsePanelProps) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <div className="p-3 border-b border-foreground/10 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="section-label">Prose</h3>
          <div className="flex items-center gap-1 shrink-0">
            {onOpenProseSettings ? (
              <WorkspaceTooltipButton
                variant="outline"
                size="icon"
                className="h-6 w-6 rounded-none"
                tooltip="Prose tone & AI settings"
                tooltipSide="bottom"
                onClick={onOpenProseSettings}
              >
                <Settings2 className="h-3 w-3" />
              </WorkspaceTooltipButton>
            ) : null}
            <WorkspaceTooltipButton
              variant="outline"
              size="sm"
              className="h-6 text-[10px] font-mono-face tracking-wider uppercase gap-1 shrink-0"
              tooltip="Merge every event into one readable scene draft"
              tooltipSide="bottom"
              onClick={onPreviewScene}
              disabled={previewDisabled}
            >
              <Eye className="h-3 w-3" />
              Preview draft
            </WorkspaceTooltipButton>
          </div>
        </div>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden workspace-scrollbar">
        <div className="space-y-4 p-3">
          {items.length === 0 && (
            <div className="py-12 text-center">
              <Eye className="mx-auto h-8 w-8 text-muted-foreground/20 mb-3" />
              <p className="text-xs text-muted-foreground font-body px-2">
                Connect tokens on the canvas and confirm the dialog. Event prose
                appears here. Preview draft compiles every event in order.
              </p>
            </div>
          )}

          {items.map((item, i) => (
            <div
              key={item.id}
              className={`${
                activeEventId === item.id
                  ? "bg-muted/50 -mx-1 px-1 py-1"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between gap-1 mb-1.5">
                <div className="min-w-0">
                  <span className="text-[10px] font-mono-face tracking-wider uppercase text-muted-foreground block">
                    Event @ tick {item.startTick}
                  </span>
                  <ul className="mt-0.5 space-y-0.5 text-[11px] font-body text-foreground/70">
                    {item.summaryLines.map((line, li) => (
                      <li key={li} className="line-clamp-2 list-disc list-inside">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
                {onEditInteraction && item.firstInteractionId ? (
                  <WorkspaceTooltipButton
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0"
                    tooltip="Edit first interaction type and meaning"
                    tooltipSide="left"
                    onClick={() =>
                      onEditInteraction(item.firstInteractionId!)
                    }
                  >
                    <Pencil className="h-3 w-3" />
                  </WorkspaceTooltipButton>
                ) : null}
              </div>

              <div className="relative text-sm font-body leading-relaxed text-foreground/80 whitespace-pre-wrap">
                {proseAiLoading ? (
                  <span className="absolute inset-0 flex items-start gap-2 text-muted-foreground text-xs">
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin mt-0.5" />
                    Generating…
                  </span>
                ) : null}
                <span
                  className={
                    proseAiLoading ? "opacity-30 pointer-events-none" : undefined
                  }
                >
                  {item.displayProse}
                </span>
              </div>

              {i < items.length - 1 && (
                <Separator className="bg-foreground/10 mt-4" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
