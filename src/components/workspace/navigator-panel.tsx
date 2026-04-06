"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { WorkspaceTooltipButton } from "@/components/workspace/workspace-tooltip-button";
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Film,
  Plus,
  Search,
  GripVertical,
  ExternalLink,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { objectPreviewPath } from "@/lib/routes";
import {
  numberedChapterLabel,
  numberedSceneLabel,
} from "@/lib/story-structure-labels";

interface StoryObject {
  _id: string;
  name: string;
  kind: string;
  description: string;
  imageUrl?: string;
  tags?: string[];
}

interface Chapter {
  _id: string;
  title: string;
  order: number;
  scenes: Scene[];
}

interface Scene {
  _id: string;
  title: string;
  order: number;
  chapterTimelineStart?: number;
  chapterTimelineDuration?: number;
}

interface NavigatorPanelProps {
  chapters: Chapter[];
  objects: StoryObject[];
  /** When set, each object row gets a link to its public preview page. */
  universeSlug?: string;
  activeSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
  /** Select chapter for chapter-level timeline (expands chapter). Omit to keep legacy row = toggle only. */
  onSelectChapter?: (chapterId: string) => void;
  /** When set, chapter row is highlighted as the one shown in Chapter scenes timeline. */
  highlightedTimelineChapterId?: string | null;
  /** With no active scene, this chapter uses the same solid selection style as a scene row. */
  selectedChapterOnlyId?: string | null;
  onAddChapter: () => void | Promise<void>;
  onAddScene: (chapterId: string) => void;
  onDragObjectStart: (obj: StoryObject) => void;
  /** When true, show add/rename controls (story author + signed in). */
  canEditStructure?: boolean;
  onRenameChapter?: (chapterId: string, title: string) => void | Promise<void>;
  onRenameScene?: (sceneId: string, title: string) => void | Promise<void>;
  /** When true and `onAddUniverseObject` is set, show add control in Universe Objects. */
  canAddUniverseObjects?: boolean;
  onAddUniverseObject?: () => void;
  /** Non-owners see this hint to fork before adding objects (e.g. `/create/universe?fork=…` or sign-in URL). */
  forkUniverseHref?: string;
}

const KIND_GROUPS = [
  { kind: "character", label: "Characters" },
  { kind: "place", label: "Places" },
  { kind: "item", label: "Items" },
  { kind: "faction", label: "Factions" },
  { kind: "lore", label: "Lore" },
];

export function NavigatorPanel({
  chapters,
  objects,
  universeSlug,
  activeSceneId,
  onSelectScene,
  onSelectChapter,
  highlightedTimelineChapterId,
  selectedChapterOnlyId,
  onAddChapter,
  onAddScene,
  onDragObjectStart,
  canEditStructure = false,
  onRenameChapter,
  onRenameScene,
  canAddUniverseObjects = false,
  onAddUniverseObject,
  forkUniverseHref,
}: NavigatorPanelProps) {
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    new Set(chapters.map((c) => c._id))
  );
  const [objectSearch, setObjectSearch] = useState("");
  const [expandedKinds, setExpandedKinds] = useState<Set<string>>(
    new Set(["character", "place", "item"])
  );
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [chapterTitleDraft, setChapterTitleDraft] = useState("");
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [sceneTitleDraft, setSceneTitleDraft] = useState("");

  useEffect(() => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      for (const c of chapters) {
        if (!prev.has(c._id)) next.add(c._id);
      }
      return next;
    });
  }, [chapters]);

  function toggleChapter(id: string) {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleKind(kind: string) {
    setExpandedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  const filteredObjects = objectSearch.trim()
    ? objects.filter((o) =>
        o.name.toLowerCase().includes(objectSearch.toLowerCase())
      )
    : objects;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      {/* Story Structure */}
      <div className="p-3 border-b border-foreground/10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="section-label">Story</h3>
          {canEditStructure ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title="Add chapter"
              onClick={() => void onAddChapter()}
            >
              <Plus className="h-3 w-3" />
              <span className="sr-only">Add chapter</span>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden workspace-scrollbar">
        <div className="p-2">
          {/* Chapter/Scene tree */}
          <div className="space-y-0.5 mb-4">
            {chapters.map((chapter, chapterIndex) => (
              <div key={chapter._id}>
                <div
                  className={cn(
                    "group flex items-center gap-0.5 py-1 px-1.5 transition-colors",
                    selectedChapterOnlyId === chapter._id
                      ? "bg-foreground text-background"
                      : highlightedTimelineChapterId === chapter._id
                        ? "bg-foreground/10"
                        : "hover:bg-muted/50"
                  )}
                >
                  <button
                    type="button"
                    aria-expanded={expandedChapters.has(chapter._id)}
                    aria-label={
                      expandedChapters.has(chapter._id)
                        ? "Collapse chapter"
                        : "Expand chapter"
                    }
                    onClick={() => toggleChapter(chapter._id)}
                    className={cn(
                      "flex h-7 w-6 shrink-0 items-center justify-center rounded-sm hover:bg-muted/80",
                      selectedChapterOnlyId === chapter._id
                        ? "text-background hover:bg-background/15 hover:text-background"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {expandedChapters.has(chapter._id) ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onSelectChapter) {
                        onSelectChapter(chapter._id);
                        setExpandedChapters((prev) => {
                          const next = new Set(prev);
                          next.add(chapter._id);
                          return next;
                        });
                      } else {
                        toggleChapter(chapter._id);
                      }
                    }}
                    className="flex min-w-0 flex-1 items-center gap-1.5 py-0.5 text-left"
                  >
                    <FolderOpen
                      className={cn(
                        "h-3 w-3 shrink-0",
                        selectedChapterOnlyId === chapter._id
                          ? "text-background"
                          : "text-muted-foreground"
                      )}
                    />
                    {editingChapterId === chapter._id ? (
                      <Input
                        value={chapterTitleDraft}
                        onChange={(e) => setChapterTitleDraft(e.target.value)}
                        className="h-6 text-xs font-mono-face"
                        autoFocus
                        onBlur={async () => {
                          const t = chapterTitleDraft.trim();
                          setEditingChapterId(null);
                          if (!t) return;
                          if (
                            onRenameChapter &&
                            t !== chapter.title.trim()
                          ) {
                            await onRenameChapter(chapter._id, t);
                          }
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter") {
                            (e.target as HTMLInputElement).blur();
                          }
                          if (e.key === "Escape") {
                            setEditingChapterId(null);
                            setChapterTitleDraft(chapter.title);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="truncate text-xs font-mono-face">
                        {numberedChapterLabel(
                          chapterIndex + 1,
                          chapter.title
                        )}
                      </span>
                    )}
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {canEditStructure &&
                    onRenameChapter &&
                    editingChapterId !== chapter._id ? (
                      <WorkspaceTooltipButton
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-6 w-6 opacity-0 group-hover:opacity-100",
                          selectedChapterOnlyId === chapter._id &&
                            "text-background hover:text-background hover:bg-background/15 opacity-100"
                        )}
                        tooltip="Rename chapter"
                        tooltipSide="bottom"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingChapterId(chapter._id);
                          setChapterTitleDraft(chapter.title);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </WorkspaceTooltipButton>
                    ) : null}
                  </div>
                </div>
                {expandedChapters.has(chapter._id) && (
                  <div className="ml-4 space-y-0.5">
                    {chapter.scenes.map((scene, sceneIndex) => (
                      <div
                        key={scene._id}
                        className={`group/scene flex items-center gap-0.5 py-1 px-1.5 transition-colors ${
                          activeSceneId === scene._id
                            ? "bg-foreground text-background"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectScene(scene._id)}
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                        >
                          <Film className="h-3 w-3 shrink-0" />
                          {editingSceneId === scene._id ? (
                            <Input
                              value={sceneTitleDraft}
                              onChange={(e) => setSceneTitleDraft(e.target.value)}
                              className="h-6 text-xs font-mono-face"
                              autoFocus
                              onBlur={async () => {
                                const t = sceneTitleDraft.trim();
                                setEditingSceneId(null);
                                if (!t) return;
                                if (
                                  onRenameScene &&
                                  t !== scene.title.trim()
                                ) {
                                  await onRenameScene(scene._id, t);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  (e.target as HTMLInputElement).blur();
                                }
                                if (e.key === "Escape") {
                                  setEditingSceneId(null);
                                  setSceneTitleDraft(scene.title);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className="truncate text-xs font-mono-face">
                              {numberedSceneLabel(
                                sceneIndex + 1,
                                scene.title
                              )}
                            </span>
                          )}
                        </button>
                        {canEditStructure &&
                        onRenameScene &&
                        editingSceneId !== scene._id ? (
                          <WorkspaceTooltipButton
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={`h-6 w-6 shrink-0 opacity-0 group-hover/scene:opacity-100 ${
                              activeSceneId === scene._id
                                ? "text-background hover:text-background hover:bg-background/15"
                                : ""
                            }`}
                            tooltip="Rename scene"
                            tooltipSide="bottom"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditingSceneId(scene._id);
                              setSceneTitleDraft(scene.title);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </WorkspaceTooltipButton>
                        ) : null}
                      </div>
                    ))}
                    {canEditStructure ? (
                      <button
                        type="button"
                        onClick={() => onAddScene(chapter._id)}
                        className="flex w-full items-center gap-1.5 py-1 px-1.5 text-muted-foreground transition-colors hover:bg-muted/50"
                      >
                        <Plus className="h-3 w-3" />
                        <span className="text-[10px] font-mono-face">
                          Add Scene
                        </span>
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
            {chapters.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-4 text-center font-body">
                No chapters yet.
              </p>
            )}
          </div>

          <Separator className="bg-foreground/10 my-2" />

          {/* Universe Objects */}
          <div className="mb-2">
            <div className="mb-2 flex items-center justify-between gap-1 px-1.5">
              <h3 className="section-label mb-0">Universe Objects</h3>
              {canAddUniverseObjects && onAddUniverseObject ? (
                <WorkspaceTooltipButton
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  tooltip="Add object to this universe"
                  tooltipSide="bottom"
                  onClick={() => onAddUniverseObject()}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="sr-only">Add object</span>
                </WorkspaceTooltipButton>
              ) : null}
            </div>
            {forkUniverseHref && !canAddUniverseObjects ? (
              <p className="mb-2 px-1.5 text-[9px] font-mono-face leading-snug text-muted-foreground">
                <Link
                  href={forkUniverseHref}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Fork this universe
                </Link>{" "}
                to add or change objects.
              </p>
            ) : null}
            <div className="px-1.5 mb-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  value={objectSearch}
                  onChange={(e) => setObjectSearch(e.target.value)}
                  placeholder="Search objects..."
                  className="pl-7 h-7 text-xs font-mono-face border-foreground/20"
                />
              </div>
            </div>

            {KIND_GROUPS.map(({ kind, label }) => {
              const items = filteredObjects.filter((o) => o.kind === kind);
              if (items.length === 0) return null;
              return (
                <div key={kind} className="mb-1">
                  <button
                    onClick={() => toggleKind(kind)}
                    className="w-full flex items-center gap-1.5 py-1 px-1.5 hover:bg-muted/50 transition-colors"
                  >
                    {expandedKinds.has(kind) ? (
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="text-[10px] font-mono-face tracking-wider uppercase text-muted-foreground">
                      {label}
                    </span>
                    <span className="text-[10px] font-mono-face text-muted-foreground/50 ml-auto">
                      {items.length}
                    </span>
                  </button>
                  {expandedKinds.has(kind) && (
                    <div className="ml-3 space-y-0.5">
                      {items.map((obj) => (
                        <div
                          key={obj._id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              "application/storyobject",
                              JSON.stringify(obj)
                            );
                            e.dataTransfer.effectAllowed = "copy";
                            onDragObjectStart(obj);
                          }}
                          className="flex items-center gap-2 py-1 px-1.5 hover:bg-muted/50 cursor-grab active:cursor-grabbing transition-colors"
                        >
                          <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                          {obj.imageUrl ? (
                            <img
                              src={obj.imageUrl}
                              alt={obj.name}
                              className="w-6 h-6 object-cover border border-foreground/10 shrink-0"
                            />
                          ) : (
                            <div className="w-6 h-6 bg-muted border border-foreground/10 flex items-center justify-center shrink-0">
                              <span className="text-[8px] font-mono-face font-bold text-muted-foreground/40">
                                {obj.name[0]}
                              </span>
                            </div>
                          )}
                          <span className="text-xs font-body truncate flex-1 min-w-0">
                            {obj.name}
                          </span>
                          {universeSlug && (
                            <Link
                              href={objectPreviewPath(universeSlug, obj._id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open object preview"
                              className="shrink-0 p-0.5 rounded-none text-muted-foreground hover:text-foreground border border-transparent hover:border-foreground/20"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3" aria-hidden />
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
