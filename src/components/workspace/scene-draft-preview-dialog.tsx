"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftText: string;
};

export function SceneDraftPreviewDialog({
  open,
  onOpenChange,
  draftText,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(85vh,720px)] max-w-lg rounded-none sm:max-w-lg"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="font-display text-base">
            Scene draft preview
          </DialogTitle>
          <DialogDescription className="text-xs font-body text-muted-foreground">
            Compiled from your interaction beats. This is not saved; edit beats on
            the canvas or timeline, then preview again.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(55vh,480px)] min-h-[8rem] overflow-y-auto rounded-none border border-foreground/15 workspace-scrollbar">
          <pre className="whitespace-pre-wrap break-words p-3 text-xs font-body leading-relaxed text-foreground/90">
            {draftText}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
