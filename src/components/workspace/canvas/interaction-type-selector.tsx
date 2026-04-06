"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Sparkles, ArrowLeft } from "lucide-react";
import { COMMON_INTERACTION_LABELS } from "@/lib/common-interactions";
import {
  loadCustomInteractions,
  saveCustomInteraction,
  type SavedCustomInteraction,
} from "@/lib/custom-interactions-storage";
import {
  autogenerateInteractionMeaning,
  type InteractionMeaningContext,
} from "@/lib/autogenerate-interaction-meaning";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { WorkspaceTooltipButton } from "@/components/workspace/workspace-tooltip-button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type InteractionPick = {
  label: string;
  interactionMeaning?: string;
};

type StoryObjectLite = {
  _id: string;
  name: string;
  kind: string;
  imageUrl?: string;
};

type Props = {
  value: InteractionPick;
  onChange: (next: InteractionPick) => void;
  userStorageKey: string;
  meaningContextBase: Omit<InteractionMeaningContext, "interactionLabel">;
  className?: string;
};

function normalizeLabel(s: string) {
  return s.trim().toLowerCase();
}

function isKnownLabel(
  q: string,
  custom: SavedCustomInteraction[]
): boolean {
  const n = normalizeLabel(q);
  if (!n) return true;
  if (COMMON_INTERACTION_LABELS.some((l) => normalizeLabel(l) === n))
    return true;
  return custom.some((c) => normalizeLabel(c.label) === n);
}

/** Searchable list + inline custom interaction form (avoids nested modal stacking). */
export function InteractionTypeSelector({
  value,
  onChange,
  userStorageKey,
  meaningContextBase,
  className,
}: Props) {
  const [custom, setCustom] = useState<SavedCustomInteraction[]>([]);
  const [phase, setPhase] = useState<"browse" | "create">("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [draftLabel, setDraftLabel] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [autogenBusy, setAutogenBusy] = useState(false);

  const refreshCustom = useCallback(() => {
    setCustom(loadCustomInteractions(userStorageKey));
  }, [userStorageKey]);

  useEffect(() => {
    refreshCustom();
  }, [refreshCustom]);

  function pickCommon(label: string) {
    setPhase("browse");
    setSearchQuery("");
    onChange({ label, interactionMeaning: undefined });
  }

  function pickSaved(row: SavedCustomInteraction) {
    setPhase("browse");
    setSearchQuery("");
    const d = row.description.trim();
    onChange({
      label: row.label,
      interactionMeaning: d ? d : undefined,
    });
  }

  function openCreateFlow(prefillLabel?: string) {
    setDraftLabel((prefillLabel ?? searchQuery).trim());
    setDraftDesc("");
    setPhase("create");
  }

  function useTypedLabelOnce() {
    const label = searchQuery.trim();
    if (!label) return;
    setPhase("browse");
    setSearchQuery("");
    onChange({ label, interactionMeaning: undefined });
  }

  async function runAutogen() {
    const label = draftLabel.trim();
    if (!label) return;
    setAutogenBusy(true);
    try {
      const text = await autogenerateInteractionMeaning({
        ...meaningContextBase,
        interactionLabel: label,
      });
      setDraftDesc(text);
    } finally {
      setAutogenBusy(false);
    }
  }

  function saveCustom() {
    const label = draftLabel.trim();
    if (!label) return;
    const description = draftDesc.trim();
    saveCustomInteraction(userStorageKey, { label, description });
    refreshCustom();
    onChange({
      label,
      interactionMeaning: description ? description : undefined,
    });
    setPhase("browse");
    setSearchQuery("");
  }

  const trimmedSearch = searchQuery.trim();
  const showUseTyped =
    trimmedSearch.length > 0 && !isKnownLabel(trimmedSearch, custom);

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-[10px] font-mono-face uppercase tracking-wider text-muted-foreground">
        Interaction type
      </p>
      <p className="rounded-none border border-foreground/15 bg-muted/20 px-2 py-1.5 text-xs font-mono-face text-foreground">
        {value.label}
      </p>

      {phase === "create" ? (
        <div className="space-y-3 rounded-none border border-foreground/15 bg-background p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-display font-semibold text-foreground">
              Custom interaction
            </p>
            <WorkspaceTooltipButton
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 rounded-none text-[10px] font-mono-face uppercase"
              tooltip="Return to preset and custom interaction list"
              tooltipSide="bottom"
              onClick={() => setPhase("browse")}
            >
              <ArrowLeft className="h-3 w-3" />
              Back to list
            </WorkspaceTooltipButton>
          </div>
          <p className="text-[11px] font-body text-muted-foreground leading-snug">
            Name the beat and save it for next time. Optional notes explain
            intent for prose and previews — skip if the label is enough.
          </p>
          <div className="space-y-1">
            <label className="text-[10px] font-mono-face uppercase tracking-wider text-muted-foreground">
              Label
            </label>
            <Input
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              placeholder="e.g. trades secrets"
              className="rounded-none"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[10px] font-mono-face uppercase tracking-wider text-muted-foreground">
                Meaning / context (optional)
              </label>
              <WorkspaceTooltipButton
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 rounded-none text-[10px] font-mono-face uppercase"
                disabled={autogenBusy || !draftLabel.trim()}
                tooltip="Draft meaning notes from the label and scene context"
                tooltipSide="left"
                onClick={runAutogen}
              >
                {autogenBusy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Autogenerate
              </WorkspaceTooltipButton>
            </div>
            <textarea
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              rows={4}
              placeholder="Narrative intent, subtext, or how this beat should read…"
              className="flex min-h-20 w-full resize-none rounded-none border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <WorkspaceTooltipButton
              type="button"
              variant="outline"
              className="rounded-none font-mono-face text-[11px] uppercase"
              tooltip="Discard this custom interaction draft"
              tooltipSide="top"
              onClick={() => setPhase("browse")}
            >
              Cancel
            </WorkspaceTooltipButton>
            <WorkspaceTooltipButton
              type="button"
              className="rounded-none font-mono-face text-[11px] uppercase"
              disabled={!draftLabel.trim()}
              tooltip="Save to your list and apply to this beat"
              tooltipSide="top"
              onClick={saveCustom}
            >
              Save &amp; use
            </WorkspaceTooltipButton>
          </div>
        </div>
      ) : (
        <div className="max-h-[260px] overflow-hidden rounded-none border border-foreground/15 bg-background">
          <Command
            className="rounded-none border-0 bg-transparent shadow-none"
            shouldFilter
          >
            <CommandInput
              placeholder="Search interactions…"
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList className="max-h-[200px]">
              <CommandEmpty className="py-3 text-xs text-muted-foreground">
                No presets match. Use the actions below this list.
              </CommandEmpty>
              <CommandGroup heading="Common">
                {COMMON_INTERACTION_LABELS.map((label) => (
                  <CommandItem
                    key={label}
                    value={label}
                    keywords={[label]}
                    onSelect={() => pickCommon(label)}
                  >
                    {label}
                  </CommandItem>
                ))}
              </CommandGroup>
              {custom.length > 0 ? (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Your custom">
                    {custom.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={`${c.label} ${c.description}`}
                        keywords={[c.label, c.description]}
                        onSelect={() => pickSaved(c)}
                      >
                        <span className="truncate">{c.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              ) : null}
              <CommandSeparator />
              {showUseTyped ? (
                <CommandItem
                  value={`__use_typed__${trimmedSearch}`}
                  forceMount
                  keywords={[trimmedSearch, "use", "typed", "once"]}
                  onSelect={useTypedLabelOnce}
                >
                  Use &quot;{trimmedSearch}&quot; for this beat only
                </CommandItem>
              ) : null}
              <CommandItem
                value="__create_custom__"
                forceMount
                keywords={[
                  "create",
                  "custom",
                  "new",
                  "add",
                  "save",
                  trimmedSearch,
                ]}
                onSelect={() => openCreateFlow()}
              >
                <Plus className="h-3.5 w-3.5" />
                Create custom interaction…
              </CommandItem>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}

export function objectById(
  objects: StoryObjectLite[],
  id: string
): StoryObjectLite | undefined {
  return objects.find((o) => o._id === id);
}
