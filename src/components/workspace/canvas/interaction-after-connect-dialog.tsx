"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight, ArrowLeftRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WorkspaceTooltipButton } from "@/components/workspace/workspace-tooltip-button";
import {
  InteractionTypeSelector,
  objectById,
  type InteractionPick,
} from "./interaction-type-selector";
import type { InteractionMeaningContext } from "@/lib/autogenerate-interaction-meaning";

type StoryObjectLite = {
  _id: string;
  name: string;
  kind: string;
  description?: string;
  imageUrl?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Object id where the drag started (source handle). */
  sourceObjectId: string;
  /** Object id where the drag ended (target handle). */
  targetObjectId: string;
  objects: StoryObjectLite[];
  userStorageKey: string;
  meaningContextBase: Omit<InteractionMeaningContext, "interactionLabel">;
  onConfirm: (args: {
    sourceObjectId: string;
    targetObjectId: string;
    label: string;
    style: "solid" | "dashed" | "wavy" | "dotted";
    interactionMeaning?: string;
  }) => void;
};

function TokenCard({
  orderLabel,
  roleLabel,
  hint,
  obj,
}: {
  orderLabel: string;
  roleLabel: string;
  hint: string;
  obj: StoryObjectLite | undefined;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 border border-foreground/20 bg-muted/15 p-3">
      <div className="flex w-full flex-col items-center gap-0.5 text-center">
        <span className="text-[10px] font-mono-face tracking-widest text-foreground">
          {orderLabel}
        </span>
        <span className="text-[9px] font-mono-face uppercase tracking-wider text-muted-foreground">
          {roleLabel}
        </span>
        <span className="text-[9px] font-body leading-tight text-muted-foreground/90">
          {hint}
        </span>
      </div>
      <div className="w-full border border-foreground/10 bg-background">
        {obj?.imageUrl ? (
          <img
            src={obj.imageUrl}
            alt=""
            className="mx-auto h-20 w-full max-w-[120px] object-cover"
          />
        ) : (
          <div className="flex h-20 items-center justify-center bg-muted/40">
            <span className="text-lg font-display font-bold text-muted-foreground/40">
              {(obj?.name ?? "?").slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <p className="w-full truncate text-center text-xs font-display font-semibold">
        {obj?.name ?? "Unknown"}
      </p>
      <p className="text-[9px] font-mono-face uppercase tracking-wider text-muted-foreground">
        {obj?.kind ?? "—"}
      </p>
    </div>
  );
}

export function InteractionAfterConnectDialog({
  open,
  onOpenChange,
  sourceObjectId,
  targetObjectId,
  objects,
  userStorageKey,
  meaningContextBase,
  onConfirm,
}: Props) {
  const [dir, setDir] = useState({
    from: sourceObjectId,
    to: targetObjectId,
  });
  const [pick, setPick] = useState<InteractionPick>({
    label: "interacts with",
  });

  useEffect(() => {
    if (!open) return;
    setDir({ from: sourceObjectId, to: targetObjectId });
    setPick({ label: "interacts with" });
  }, [open, sourceObjectId, targetObjectId]);

  const fromObj = objectById(objects, dir.from);
  const toObj = objectById(objects, dir.to);

  function swapDirection() {
    setDir((d) => ({ from: d.to, to: d.from }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg rounded-none sm:max-w-lg"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="font-display text-base">
            New interaction
          </DialogTitle>
          <DialogDescription className="text-xs font-body text-muted-foreground">
            You dragged a link from{" "}
            <span className="text-foreground/80">start</span> to{" "}
            <span className="text-foreground/80">end</span>. The timeline and
            prose use this direction: the first character acts toward the second.
            Swap if you meant the opposite.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-stretch">
          <TokenCard
            orderLabel="1 · Start"
            roleLabel="Link origin"
            hint="You dragged from this token’s handle."
            obj={fromObj}
          />
          <div className="flex shrink-0 flex-row items-center justify-center gap-3 px-1 py-1 sm:w-[7rem] sm:flex-col sm:py-2">
            <ArrowDown
              className="h-7 w-7 text-foreground sm:hidden"
              strokeWidth={1.25}
              aria-hidden
            />
            <ArrowRight
              className="hidden h-9 w-9 text-foreground sm:block sm:h-10 sm:w-10"
              strokeWidth={1.25}
              aria-hidden
            />
            <div className="flex flex-col items-center gap-2">
              <p className="text-center text-[9px] font-mono-face uppercase tracking-wider text-muted-foreground">
                Direction
              </p>
              <WorkspaceTooltipButton
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 rounded-none text-[10px] font-mono-face uppercase"
                tooltip="Flip which token is start vs end for prose and timeline"
                tooltipSide="bottom"
                onClick={swapDirection}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Swap
              </WorkspaceTooltipButton>
            </div>
          </div>
          <TokenCard
            orderLabel="2 · End"
            roleLabel="Link target"
            hint="You dropped the link on this token."
            obj={toObj}
          />
        </div>

        <InteractionTypeSelector
          value={pick}
          onChange={setPick}
          userStorageKey={userStorageKey}
          meaningContextBase={meaningContextBase}
        />

        <DialogFooter className="gap-2 sm:flex-row sm:justify-end">
          <WorkspaceTooltipButton
            type="button"
            variant="outline"
            className="rounded-none font-mono-face text-[11px] uppercase"
            tooltip="Close without adding an interaction"
            tooltipSide="top"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </WorkspaceTooltipButton>
          <WorkspaceTooltipButton
            type="button"
            className="rounded-none font-mono-face text-[11px] uppercase"
            disabled={!pick.label.trim()}
            tooltip="Create the beat on the scene timeline and in prose"
            tooltipSide="top"
            onClick={() => {
              onConfirm({
                sourceObjectId: dir.from,
                targetObjectId: dir.to,
                label: pick.label.trim() || "interacts with",
                style: "solid",
                interactionMeaning: pick.interactionMeaning?.trim() || undefined,
              });
              onOpenChange(false);
            }}
          >
            Add to timeline
          </WorkspaceTooltipButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
