"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
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

const KIND_OPTIONS = [
  { value: "character" as const, label: "Character" },
  { value: "place" as const, label: "Place" },
  { value: "item" as const, label: "Item" },
  { value: "faction" as const, label: "Faction" },
  { value: "lore" as const, label: "Lore" },
];

type AuthorKind = (typeof KIND_OPTIONS)[number]["value"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionToken: string;
  universeId: Id<"universes">;
  /** Called after a successful create (Convex queries refresh automatically). */
  onCreated?: () => void;
};

export function AddUniverseObjectDialog({
  open,
  onOpenChange,
  sessionToken,
  universeId,
  onCreated,
}: Props) {
  const createObject = useMutation(api.objects.createForUniverseOwner);
  const [kind, setKind] = useState<AuthorKind>("character");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setKind("character");
      setName("");
      setDescription("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);
    try {
      await createObject({
        sessionToken,
        universeId,
        kind,
        name,
        description: description.trim(),
      });
      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create object.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-none" showCloseButton>
        <DialogHeader>
          <DialogTitle className="font-display text-base">
            Add object
          </DialogTitle>
          <DialogDescription className="text-xs font-body text-muted-foreground">
            New entity in this universe. You can place it on the canvas from the
            story workspace once it exists.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <label
              htmlFor="add-object-kind"
              className="text-[10px] font-mono-face uppercase tracking-wider text-muted-foreground"
            >
              Kind
            </label>
            <select
              id="add-object-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as AuthorKind)}
              className="h-9 w-full border border-foreground/20 bg-background px-2 text-xs font-mono-face outline-none focus-visible:ring-1 focus-visible:ring-foreground/30"
            >
              {KIND_OPTIONS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label
              htmlFor="add-object-name"
              className="text-[10px] font-mono-face uppercase tracking-wider text-muted-foreground"
            >
              Name
            </label>
            <Input
              id="add-object-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mira Vance"
              className="h-9 text-xs font-mono-face"
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <label
              htmlFor="add-object-desc"
              className="text-[10px] font-mono-face uppercase tracking-wider text-muted-foreground"
            >
              Description
            </label>
            <textarea
              id="add-object-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short bio, place details, or notes…"
              rows={4}
              className="w-full resize-y border border-foreground/20 bg-background px-2 py-1.5 text-xs font-body leading-relaxed outline-none focus-visible:ring-1 focus-visible:ring-foreground/30"
            />
          </div>
          {error ? (
            <p className="text-xs text-destructive font-body">{error}</p>
          ) : null}
        </div>

        <DialogFooter className="border-t-0 bg-transparent p-0 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="font-mono-face text-xs"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="font-mono-face text-xs"
            disabled={saving || !name.trim()}
            onClick={() => void handleSubmit()}
          >
            {saving ? "Adding…" : "Add object"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
