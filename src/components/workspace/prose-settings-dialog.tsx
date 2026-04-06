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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEFAULT_TONE = "creative writing";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tone: string;
  onSaveTone: (tone: string) => void;
};

export function ProseSettingsDialog({
  open,
  onOpenChange,
  tone,
  onSaveTone,
}: Props) {
  const [draft, setDraft] = useState(tone);

  useEffect(() => {
    if (open) setDraft(tone);
  }, [open, tone]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md rounded-none"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="font-display text-base">
            Prose generation
          </DialogTitle>
          <DialogDescription className="text-xs font-body text-muted-foreground">
            Each beat is sent to the model with both entities’ bios and the
            interaction. Describe the voice you want (genre, mood, register).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-1">
          <label
            htmlFor="prose-tone"
            className="text-[10px] font-mono-face uppercase tracking-wider text-muted-foreground block"
          >
            Tone
          </label>
          <Input
            id="prose-tone"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={DEFAULT_TONE}
            className="font-body text-sm rounded-none"
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-none font-mono-face text-[10px] uppercase tracking-wider"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="rounded-none font-mono-face text-[10px] uppercase tracking-wider"
            onClick={() => {
              const next = draft.trim() || DEFAULT_TONE;
              onSaveTone(next);
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const PROSE_TONE_STORAGE_KEY = "storyobject-prose-tone";
export const PROSE_TONE_DEFAULT = DEFAULT_TONE;
