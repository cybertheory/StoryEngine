"use client";

import { useEffect, useState } from "react";
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
  type InteractionPick,
} from "@/components/workspace/canvas/interaction-type-selector";
import type { InteractionMeaningContext } from "@/lib/autogenerate-interaction-meaning";
import { beatSummaryLine } from "@/lib/derive-beat-prose";

type Obj = { _id: string; name: string; tags?: string[] };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beat: {
    id: string;
    label: string;
    interactionMeaning?: string;
    sourceObjectId: string;
    targetObjectId: string;
  } | null;
  objects: Obj[];
  userStorageKey: string;
  meaningContextBase: Omit<InteractionMeaningContext, "interactionLabel">;
  onSave: (beatId: string, pick: InteractionPick) => void;
};

export function InteractionBeatEditorDialog({
  open,
  onOpenChange,
  beat,
  objects,
  userStorageKey,
  meaningContextBase,
  onSave,
}: Props) {
  const [pick, setPick] = useState<InteractionPick>({ label: "interacts with" });

  useEffect(() => {
    if (!open || !beat) return;
    setPick({
      label: beat.label,
      interactionMeaning: beat.interactionMeaning,
    });
  }, [open, beat]);

  const summary =
    beat &&
    beatSummaryLine(
      {
        sourceObjectId: beat.sourceObjectId,
        targetObjectId: beat.targetObjectId,
        label: pick.label,
      },
      objects
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-none sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle className="font-display text-base">
            Edit interaction
          </DialogTitle>
          <DialogDescription className="text-xs font-body text-muted-foreground">
            Changing the type updates the beat line everywhere (edge label, prose,
            and scene preview). Direction is unchanged:{" "}
            {summary ? (
              <span className="text-foreground/85">{summary}</span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        {beat ? (
          <InteractionTypeSelector
            value={pick}
            onChange={setPick}
            userStorageKey={userStorageKey}
            meaningContextBase={meaningContextBase}
          />
        ) : null}
        <DialogFooter className="gap-2 sm:flex-row sm:justify-end">
          <WorkspaceTooltipButton
            type="button"
            variant="outline"
            className="rounded-none font-mono-face text-[11px] uppercase"
            tooltip="Discard changes"
            tooltipSide="top"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </WorkspaceTooltipButton>
          <WorkspaceTooltipButton
            type="button"
            className="rounded-none font-mono-face text-[11px] uppercase"
            disabled={!beat || !pick.label.trim()}
            tooltip="Update this beat’s type and prose everywhere"
            tooltipSide="top"
            onClick={() => {
              if (!beat) return;
              onSave(beat.id, {
                label: pick.label.trim(),
                interactionMeaning: pick.interactionMeaning?.trim() || undefined,
              });
              onOpenChange(false);
            }}
          >
            Apply
          </WorkspaceTooltipButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
