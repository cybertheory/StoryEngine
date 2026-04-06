"use client";

import {
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery, useQueries, useMutation, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { WorkspaceLayout } from "@/components/workspace/workspace-layout";
import { NavigatorPanel } from "@/components/workspace/navigator-panel";
import { AddUniverseObjectDialog } from "@/components/universe/add-universe-object-dialog";
import { StoryCanvas } from "@/components/workspace/canvas/story-canvas";
import type { ActiveCanvasInteraction } from "@/components/workspace/canvas/story-canvas";
import {
  CanvasWorkspacePanel,
  type CanvasWorkspaceTab,
} from "@/components/workspace/canvas-workspace-panel";
import { StoryNotepad } from "@/components/workspace/story-notepad";
import {
  notepadStructuredPlaybackRanges,
  notepadTextForHeuristic,
} from "@/lib/notepad-highlight";
import {
  Timeline,
  type ChapterTimelinePayload,
  type TimelineVariant,
} from "@/components/workspace/timeline/timeline";
import {
  ProsePanel,
  type ProseEventItem,
} from "@/components/workspace/prose-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppSession } from "@/contexts/auth-context";
import Link from "next/link";
import { storyReaderPath } from "@/lib/routes";
import {
  numberedChapterLabel,
  numberedSceneLabel,
} from "@/lib/story-structure-labels";
import {
  beatSummaryLine,
  compileReaderSceneBody,
  compileSceneDraftFromEvents,
  deriveEventTemplateProse,
} from "@/lib/derive-beat-prose";
import { isStoryobjectSceneAnchor } from "@/lib/scene-anchor";
import {
  startTicksForStructuredNotepad,
} from "@/lib/notepad-timeline-ticks";
import {
  buildSceneEventsFromHeuristicKeyframes,
  mergePreservedSceneEventIds,
  sceneEventsStructureFingerprint,
} from "@/lib/notepad-scene-build";
import {
  sceneEventsFromDoc,
  flattenSceneEventsToKeyframes,
  appendInteractionEdge,
  updateInteractionTiming,
  translateSceneEvent,
  removeEdgeByCompositeId,
  patchInteractionEdgeFields,
  parseKeyframeCompositeId,
  type SceneTimelineEvent,
  type WorkspaceEventDoc,
} from "@/lib/workspace-model";

import { SceneDraftPreviewDialog } from "@/components/workspace/scene-draft-preview-dialog";
import {
  ProseSettingsDialog,
  PROSE_TONE_DEFAULT,
  PROSE_TONE_STORAGE_KEY,
} from "@/components/workspace/prose-settings-dialog";
import { InteractionBeatEditorDialog } from "@/components/workspace/interaction-beat-editor-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

function WorkspaceSceneEmptyState() {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <div
        role="tablist"
        aria-hidden
        className="flex shrink-0 gap-0 border-b border-foreground/10 bg-muted/20 px-2"
      >
        <span className="border-b-2 border-transparent px-3 py-2 text-[10px] font-mono-face uppercase tracking-wider text-muted-foreground">
          Notepad
        </span>
        <span className="border-b-2 border-transparent px-3 py-2 text-[10px] font-mono-face uppercase tracking-wider text-muted-foreground">
          Canvas
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 overflow-y-auto px-4 workspace-scrollbar">
        <p className="max-w-[18rem] text-center text-sm font-mono-face text-muted-foreground">
          Select a scene to get started
        </p>
        <p className="max-w-[20rem] text-center text-[10px] font-mono-face leading-snug text-muted-foreground/85">
          Notepad, canvas, and prose are per scene. Choose a scene under the
          chapter in the story tree.
        </p>
      </div>
    </div>
  );
}

function ProseSceneEmptyState() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="shrink-0 border-b border-foreground/10 p-3">
        <h3 className="section-label">Prose</h3>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 workspace-scrollbar">
        <p className="max-w-[17rem] text-center text-sm font-mono-face text-muted-foreground">
          Select a scene to get started
        </p>
      </div>
    </div>
  );
}

const MIN_TIMELINE_TICKS = 100;
const DEFAULT_KEYFRAME_DURATION = 16;
/** Pause after typing before re-parsing notepad → beats (full replace every time). */
const NOTEPAD_TO_WORKSPACE_DEBOUNCE_MS = 400;
/**
 * Bump when notepad→tick rules change; triggers a one-shot re-parse after workspace load (author).
 */
const NOTEPAD_TICK_LAYOUT_REVISION = 2;
/** Persist scene workspace (notepad + canvas + beats) after local edits. */
const SCENE_WORKSPACE_SAVE_DEBOUNCE_MS = 900;
/** Wait after beat/tone changes before parallel Anthropic prose generation. */
const PROSE_AI_DEBOUNCE_MS = 650;

/** Drop objects onto the canvas if they participate in interactions but have no node yet. */
function ensureObjectsOnCanvas(
  prev: { objectId: string; x: number; y: number; scale?: number }[],
  objectIds: string[]
) {
  const seen = new Set(prev.map((p) => p.objectId));
  const next = [...prev];
  let slot = next.length;
  for (const oid of objectIds) {
    if (seen.has(oid)) continue;
    seen.add(oid);
    next.push({
      objectId: oid,
      x: 72 + (slot % 5) * 128,
      y: 88 + Math.floor(slot / 5) * 100,
    });
    slot++;
  }
  return next;
}

export default function StoryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const storyId = id as Id<"stories">;
  const { token, userId } = useAppSession();

  const story = useQuery(api.stories.getById, {
    id: storyId,
    ...(token ? { sessionToken: token } : {}),
  });
  const chaptersData = useQuery(api.stories.listChapters, {
    storyId,
    ...(token ? { sessionToken: token } : {}),
  });

  const scenesQueryMap = useMemo(() => {
    if (chaptersData === undefined || chaptersData.length === 0) return {};
    return Object.fromEntries(
      chaptersData.map((ch) => [
        ch._id,
        {
          query: api.stories.listScenes,
          args: { chapterId: ch._id },
        },
      ])
    );
  }, [chaptersData]);

  const scenesByChapterId = useQueries(scenesQueryMap);

  const chaptersWithScenesData = useMemo(() => {
    if (chaptersData === undefined) return undefined;
    if (chaptersData.length === 0) return [];
    for (const ch of chaptersData) {
      if (scenesByChapterId[ch._id] === undefined) return undefined;
    }
    return chaptersData.map((ch) => {
      const raw = scenesByChapterId[ch._id];
      const scenes =
        raw instanceof Error
          ? []
          : [...raw].sort((a, b) => a.order - b.order);
      return { ...ch, scenes };
    });
  }, [chaptersData, scenesByChapterId]);

  const universe = useQuery(
    api.universes.getById,
    story
      ? {
          id: story.universeId,
          ...(token ? { sessionToken: token } : {}),
        }
      : "skip"
  );
  const objects = useQuery(
    api.objects.listByUniverse,
    story
      ? {
          universeId: story.universeId,
          ...(token ? { sessionToken: token } : {}),
        }
      : "skip"
  );

  const notepadObjectNames = useMemo(
    () =>
      (objects ?? [])
        .filter((o) => !isStoryobjectSceneAnchor(o))
        .map((o) => o.name),
    [objects]
  );

  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [timelineVariant, setTimelineVariant] =
    useState<TimelineVariant>("interactions");
  /** When set, Chapter scenes uses this chapter; otherwise the active scene's chapter. */
  const [timelineFocusChapterId, setTimelineFocusChapterId] = useState<
    string | null
  >(null);
  const [workspaceTab, setWorkspaceTab] =
    useState<CanvasWorkspaceTab>("notepad");
  /** Interaction timeline play button — notepad line highlight only while this is true. */
  const [timelineInteractionsPlaying, setTimelineInteractionsPlaying] =
    useState(false);
  const [addUniverseObjectOpen, setAddUniverseObjectOpen] = useState(false);
  const [currentTick, setCurrentTick] = useState(0);
  /** Timeline: selected narrative event band (prose highlight); null = follow playhead only. */
  const [selectedSceneEventId, setSelectedSceneEventId] = useState<
    string | null
  >(null);
  const [sceneDraftPreviewOpen, setSceneDraftPreviewOpen] = useState(false);
  const [sceneDraftText, setSceneDraftText] = useState("");
  const [editBeatId, setEditBeatId] = useState<string | null>(null);
  const [editingStoryTitle, setEditingStoryTitle] = useState(false);
  const [storyTitleDraft, setStoryTitleDraft] = useState("");
  const [editingBreadcrumbChapter, setEditingBreadcrumbChapter] =
    useState(false);
  const [editingBreadcrumbScene, setEditingBreadcrumbScene] = useState(false);
  const [breadcrumbChapterDraft, setBreadcrumbChapterDraft] = useState("");
  const [breadcrumbSceneDraft, setBreadcrumbSceneDraft] = useState("");

  const [localPlacements, setLocalPlacements] = useState<
    { objectId: string; x: number; y: number; scale?: number }[]
  >([]);
  const [sceneEvents, setSceneEvents] = useState<SceneTimelineEvent[]>([]);
  const [notepadText, setNotepadText] = useState("");
  const [proseSettingsOpen, setProseSettingsOpen] = useState(false);
  const [proseTone, setProseTone] = useState(PROSE_TONE_DEFAULT);
  const [aiProseByEventId, setAiProseByEventId] = useState<
    Record<string, string>
  >({});
  /** Matches `workspaceProseTriggerSig` (interaction model + tone) after last AI run / DB `proseAiSourceSig`. */
  const [proseAiSourceSig, setProseAiSourceSig] = useState<string | null>(null);
  const [proseAiLoading, setProseAiLoading] = useState(false);

  const createChapter = useMutation(api.stories.createChapter);
  const createScene = useMutation(api.stories.createScene);
  const ensureChapterSceneTimelineDefaults = useMutation(
    api.stories.ensureChapterSceneTimelineDefaults
  );
  const updateStory = useMutation(api.stories.update);
  const updateChapter = useMutation(api.stories.updateChapter);
  const updateScene = useMutation(api.stories.updateScene);
  const interpretWorkspaceCommand = useAction(
    api.workbenchInterpret.interpretCommand
  );
  const generateEventProses = useAction(api.proseGeneration.generateEventProses);
  const ensureSceneWorkspace = useMutation(api.stories.ensureSceneWorkspace);
  const saveSceneWorkspace = useMutation(api.stories.saveSceneWorkspace);
  const ensureAmbientAnchor = useMutation(api.objects.ensureAmbientAnchor);
  const isAuthor = useMemo(
    () =>
      Boolean(
        story !== undefined &&
          story !== null &&
          token &&
          userId !== null &&
          story.authorId === userId
      ),
    [story, token, userId]
  );

  const isUniverseOwner = useMemo(
    () =>
      Boolean(
        token &&
          userId &&
          universe &&
          String(universe.creatorId) === String(userId)
      ),
    [token, userId, universe]
  );

  const forkUniverseFlowHref = useMemo(() => {
    if (!universe?.slug) return undefined;
    const target = `/create/universe?fork=${encodeURIComponent(universe.slug)}`;
    return token
      ? target
      : `/sign-in?redirect=${encodeURIComponent(target)}`;
  }, [universe, token]);

  const workspaceEvent = useQuery(
    api.stories.getSceneWorkspace,
    activeSceneId && story
      ? {
          sceneId: activeSceneId as Id<"scenes">,
          sessionToken: token ?? undefined,
        }
      : "skip"
  );

  const currentTickRef = useRef(currentTick);
  currentTickRef.current = currentTick;
  const placementsRef = useRef(localPlacements);
  placementsRef.current = localPlacements;
  const sceneEventsRef = useRef(sceneEvents);
  sceneEventsRef.current = sceneEvents;
  const proseToneRef = useRef(proseTone);
  proseToneRef.current = proseTone;

  /**
   * Invalidates cached AI prose only when the interaction model or prose tone changes.
   * Notepad text (except via parsed graph), canvas layout, and playhead do not trigger regeneration.
   */
  const workspaceProseTriggerSig = useMemo(
    () => `${sceneEventsStructureFingerprint(sceneEvents)}##${proseTone}`,
    [sceneEvents, proseTone]
  );

  const workspaceProseTriggerSigRef = useRef(workspaceProseTriggerSig);
  workspaceProseTriggerSigRef.current = workspaceProseTriggerSig;

  const flatKeyframes = useMemo(
    () => flattenSceneEventsToKeyframes(sceneEvents),
    [sceneEvents]
  );

  const scaffoldRanRef = useRef(false);
  const workspaceHydrateKeyRef = useRef<string | null>(null);
  /** Avoid saveSceneWorkspace in the same cycle as hydrate (local state still stale). */
  const skipNextWorkspaceSaveRef = useRef(false);
  /** Drop stale interpret results when notepad or scene changes mid-flight. */
  const notepadSyncGenRef = useRef(0);
  /** Drop stale AI prose when scene or beat set changes mid-flight. */
  const proseGenGenRef = useRef(0);
  /** One-shot notepad→tick resync per scene event after layout rule changes. */
  const notepadTickLayoutResyncedRef = useRef<Set<string>>(new Set());
  /** When true, do not auto-pick the first scene (user focused a chapter without a scene). */
  const skipAutoSceneSelectionRef = useRef(false);

  useEffect(() => {
    try {
      const t = localStorage.getItem(PROSE_TONE_STORAGE_KEY)?.trim();
      if (t) setProseTone(t);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    scaffoldRanRef.current = false;
  }, [storyId]);

  useEffect(() => {
    if (!token || !story?.universeId) return;
    void ensureAmbientAnchor({
      sessionToken: token,
      universeId: story.universeId,
    }).catch(() => {});
  }, [token, story?.universeId, ensureAmbientAnchor]);

  useEffect(() => {
    setTimelineFocusChapterId(null);
    setTimelineVariant("interactions");
  }, [storyId]);

  useEffect(() => {
    setEditingBreadcrumbChapter(false);
    setEditingBreadcrumbScene(false);
  }, [activeSceneId]);

  useEffect(() => {
    if (!token || !story || userId === null || story.authorId !== userId) {
      return;
    }
    if (chaptersWithScenesData === undefined) return;
    if (scaffoldRanRef.current) return;

    const needsChapter =
      chaptersWithScenesData.length === 0;
    const chaptersMissingScene = chaptersWithScenesData.filter(
      (ch) => ch.scenes.length === 0
    );
    if (!needsChapter && chaptersMissingScene.length === 0) return;

    scaffoldRanRef.current = true;
    void (async () => {
      try {
        if (needsChapter) {
          const chapterId = await createChapter({
            sessionToken: token,
            storyId,
            title: "Chapter 1",
            order: 0,
          });
          await createScene({
            sessionToken: token,
            chapterId,
            title: "Scene 1",
            order: 0,
          });
        } else {
          for (const ch of chaptersMissingScene) {
            await createScene({
              sessionToken: token,
              chapterId: ch._id,
              title: "Scene 1",
              order: 0,
            });
          }
        }
      } catch {
        scaffoldRanRef.current = false;
      }
    })();
  }, [
    token,
    story,
    userId,
    storyId,
    chaptersWithScenesData,
    createChapter,
    createScene,
  ]);

  const handleSelectScene = useCallback((nextSceneId: string) => {
    if (nextSceneId === activeSceneId) return;
    skipAutoSceneSelectionRef.current = false;
    workspaceHydrateKeyRef.current = null;
    skipNextWorkspaceSaveRef.current = false;
    notepadSyncGenRef.current += 1;
    proseGenGenRef.current += 1;
    notepadTickLayoutResyncedRef.current.clear();
    setAiProseByEventId({});
    setLocalPlacements([]);
    setSceneEvents([]);
    setCurrentTick(0);
    setNotepadText("");
    setWorkspaceTab("notepad");
    setTimelineInteractionsPlaying(false);
    setTimelineFocusChapterId(null);
    setTimelineVariant("interactions");
    setSelectedSceneEventId(null);
    setActiveSceneId(nextSceneId);
  }, [activeSceneId]);

  const handleSelectChapter = useCallback((chapterId: string) => {
    skipAutoSceneSelectionRef.current = true;
    workspaceHydrateKeyRef.current = null;
    skipNextWorkspaceSaveRef.current = false;
    notepadSyncGenRef.current += 1;
    proseGenGenRef.current += 1;
    notepadTickLayoutResyncedRef.current.clear();
    setAiProseByEventId({});
    setLocalPlacements([]);
    setSceneEvents([]);
    setCurrentTick(0);
    setNotepadText("");
    setWorkspaceTab("notepad");
    setTimelineInteractionsPlaying(false);
    setSelectedSceneEventId(null);
    setActiveSceneId(null);
    setTimelineFocusChapterId(chapterId);
    setTimelineVariant("chapter-scenes");
  }, []);

  useLayoutEffect(() => {
    if (activeSceneId) return;
    if (skipAutoSceneSelectionRef.current) return;
    const first = chaptersWithScenesData?.[0]?.scenes[0];
    if (first) setActiveSceneId(first._id as string);
  }, [chaptersWithScenesData, activeSceneId]);

  const fullChapters = useMemo(() => {
    if (!chaptersWithScenesData) return [];
    return chaptersWithScenesData.map((c) => ({
      _id: c._id as string,
      title: c.title,
      order: c.order,
      scenes: c.scenes.map((s) => ({
        _id: s._id as string,
        title: s.title,
        order: s.order,
        chapterTimelineStart: s.chapterTimelineStart,
        chapterTimelineDuration: s.chapterTimelineDuration,
      })),
    }));
  }, [chaptersWithScenesData]);

  const activeSceneContext = useMemo(() => {
    for (let ci = 0; ci < fullChapters.length; ci++) {
      const ch = fullChapters[ci];
      for (let si = 0; si < ch.scenes.length; si++) {
        if (ch.scenes[si]._id === activeSceneId) {
          return {
            chapterIndex1: ci + 1,
            sceneIndex1: si + 1,
            chapterId: ch._id,
            sceneId: ch.scenes[si]._id,
            chapterTitle: ch.title,
            sceneTitle: ch.scenes[si].title,
          };
        }
      }
    }
    return null;
  }, [fullChapters, activeSceneId]);

  const effectiveTimelineChapterId =
    timelineFocusChapterId ?? activeSceneContext?.chapterId ?? null;

  const chapterTimelinePayload = useMemo((): ChapterTimelinePayload | null => {
    if (!effectiveTimelineChapterId) return null;
    const ci = fullChapters.findIndex(
      (c) => c._id === effectiveTimelineChapterId
    );
    if (ci < 0) return null;
    const ch = fullChapters[ci];
    return {
      chapterId: ch._id,
      chapterIndexLabel: ci + 1,
      chapterTitle: ch.title,
      scenes: ch.scenes,
    };
  }, [fullChapters, effectiveTimelineChapterId]);

  useEffect(() => {
    if (
      timelineVariant !== "chapter-scenes" ||
      !chapterTimelinePayload ||
      !token ||
      userId === null ||
      !story ||
      story.authorId !== userId
    ) {
      return;
    }
    const needsDefaults = chapterTimelinePayload.scenes.some(
      (s) =>
        s.chapterTimelineStart === undefined ||
        s.chapterTimelineDuration === undefined
    );
    if (!needsDefaults) return;
    void ensureChapterSceneTimelineDefaults({
      sessionToken: token,
      chapterId: chapterTimelinePayload.chapterId as Id<"chapters">,
    });
  }, [
    timelineVariant,
    chapterTimelinePayload,
    token,
    userId,
    story,
    ensureChapterSceneTimelineDefaults,
  ]);

  const sceneAnchorLabel = useMemo(() => {
    if (!activeSceneContext) return null;
    const c = activeSceneContext;
    return `${numberedChapterLabel(c.chapterIndex1, c.chapterTitle)} · ${numberedSceneLabel(c.sceneIndex1, c.sceneTitle)}`;
  }, [activeSceneContext]);

  /** Breadcrumb when a chapter is focused in the tree but no scene is selected. */
  const chapterOnlyNavigatorContext = useMemo(() => {
    if (activeSceneId || !timelineFocusChapterId) return null;
    const ci = fullChapters.findIndex((c) => c._id === timelineFocusChapterId);
    if (ci < 0) return null;
    const ch = fullChapters[ci];
    return {
      chapterIndex1: ci + 1,
      chapterTitle: ch.title,
    };
  }, [activeSceneId, timelineFocusChapterId, fullChapters]);

  const totalTicks = useMemo(() => {
    let extent = 0;
    for (const ev of sceneEvents) {
      extent = Math.max(extent, ev.startTick + ev.duration);
      for (const inter of ev.interactions) {
        extent = Math.max(extent, inter.startTick + inter.duration);
      }
    }
    return Math.max(MIN_TIMELINE_TICKS, Math.ceil(extent + 12));
  }, [sceneEvents]);

  const activeInteractions: ActiveCanvasInteraction[] = useMemo(() => {
    const ev = sceneEvents.find(
      (e) =>
        currentTick >= e.startTick && currentTick < e.startTick + e.duration
    );
    if (!ev) return [];
    const out: ActiveCanvasInteraction[] = [];
    for (const inter of ev.interactions) {
      if (
        currentTick < inter.startTick ||
        currentTick >= inter.startTick + inter.duration
      ) {
        continue;
      }
      for (const edge of inter.edges) {
        out.push({
          id: `${inter.interactionId}:${edge.edgeId}`,
          interactionId: inter.interactionId,
          sourceObjectId: edge.sourceObjectId,
          targetObjectId: edge.targetObjectId,
          label: edge.label,
          style: edge.style,
          interactionMeaning: edge.interactionMeaning,
        });
      }
    }
    return out;
  }, [currentTick, sceneEvents]);

  const canvasActiveInteractions: ActiveCanvasInteraction[] = useMemo(() => {
    if (workspaceTab !== "canvas") return [];
    return activeInteractions;
  }, [workspaceTab, activeInteractions]);

  const notepadDualPlayback = useMemo(() => {
    if (!timelineInteractionsPlaying) return null;
    if (workspaceTab !== "notepad") return null;
    const active = flatKeyframes.filter(
      (k) =>
        currentTick >= k.startTick &&
        currentTick < k.startTick + k.duration
    );
    if (active.length === 0) return null;
    active.sort(
      (a, b) =>
        a.startTick - b.startTick || String(a._id).localeCompare(String(b._id))
    );
    const k = active[0]!;
    const sortedEv = [...sceneEvents].sort(
      (a, b) =>
        a.startTick - b.startTick || (a.order ?? 0) - (b.order ?? 0)
    );
    const parent = sortedEv.find((e) => e.eventId === k.eventId);
    const ei = parent ? sortedEv.indexOf(parent) : -1;
    if (ei < 0) return null;
    const inter = parent?.interactions.find(
      (i) => i.interactionId === k.interactionId
    );
    const lineIdx = inter?.lineIndexInEvent ?? 0;
    return notepadStructuredPlaybackRanges(notepadText, ei, lineIdx);
  }, [
    timelineInteractionsPlaying,
    workspaceTab,
    currentTick,
    flatKeyframes,
    sceneEvents,
    notepadText,
  ]);

  const activeSceneTitle = useMemo(() => {
    for (const ch of fullChapters) {
      const sc = ch.scenes.find((s) => s._id === activeSceneId);
      if (sc) return sc.title;
    }
    return undefined;
  }, [fullChapters, activeSceneId]);

  const canvasSceneContext = useMemo(() => {
    const nameById = new Map<string, string>(
      (objects ?? []).map((o) => [String(o._id), o.name])
    );
    const onCanvasNames = localPlacements
      .map((p) => nameById.get(p.objectId))
      .filter((n): n is string => Boolean(n));
    return {
      universeName: universe?.name ?? "",
      storyTitle: story?.title ?? "",
      sceneTitle: activeSceneTitle,
      onCanvasNames,
    };
  }, [
    objects,
    localPlacements,
    universe?.name,
    story?.title,
    activeSceneTitle,
  ]);

  const activeEventId = useMemo(() => {
    const ev = sceneEvents.find(
      (e) =>
        currentTick >= e.startTick && currentTick < e.startTick + e.duration
    );
    return ev?.eventId ?? null;
  }, [currentTick, sceneEvents]);

  const trackObjects = useMemo(() => {
    const ids = new Set<string>();
    for (const p of localPlacements) ids.add(p.objectId);
    for (const k of flatKeyframes) {
      ids.add(k.sourceObjectId);
      ids.add(k.targetObjectId);
    }
    const list = (objects ?? []).filter((o) => ids.has(o._id));
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return list.map((o) => ({
      _id: o._id,
      name: o.name,
      kind: o.kind,
      imageUrl: o.imageUrl,
    }));
  }, [objects, localPlacements, flatKeyframes]);

  const proseItems: ProseEventItem[] = useMemo(() => {
    if (!objects) return [];
    const objs = objects.map((o) => ({
      _id: o._id,
      name: o.name,
      tags: o.tags,
    }));
    const sorted = [...sceneEvents].sort(
      (a, b) =>
        a.startTick - b.startTick || (a.order ?? 0) - (b.order ?? 0)
    );
    return sorted.map((ev, i) => {
      const beats: {
        sourceObjectId: string;
        targetObjectId: string;
        label: string;
        interactionMeaning?: string;
      }[] = [];
      const summaryLines: string[] = [];
      for (const inter of ev.interactions) {
        for (const e of inter.edges) {
          beats.push({
            sourceObjectId: e.sourceObjectId,
            targetObjectId: e.targetObjectId,
            label: e.label,
            interactionMeaning: e.interactionMeaning,
          });
          summaryLines.push(beatSummaryLine(e, objs));
        }
      }
      const derived = deriveEventTemplateProse(beats, objs);
      const ai = aiProseByEventId[ev.eventId]?.trim();
      const firstInter = ev.interactions[0];
      return {
        id: ev.eventId,
        sortIndex: i,
        startTick: ev.startTick,
        summaryLines,
        derivedProse: derived,
        displayProse: ai && ai.length > 0 ? ai : derived,
        firstInteractionId: firstInter?.interactionId ?? null,
      };
    });
  }, [sceneEvents, objects, aiProseByEventId]);

  useEffect(() => {
    if (!isAuthor || !token) {
      setProseAiLoading(false);
      if (!isAuthor) {
        setAiProseByEventId({});
        setProseAiSourceSig(null);
      }
      return;
    }
    if (sceneEvents.length === 0) {
      setProseAiLoading(false);
      setAiProseByEventId({});
      setProseAiSourceSig(null);
      return;
    }

    if (workspaceProseTriggerSig === proseAiSourceSig) {
      setProseAiLoading(false);
      return;
    }

    setProseAiLoading(true);
    const gen = (proseGenGenRef.current += 1);
    const scheduledSig = workspaceProseTriggerSig;

    const t = window.setTimeout(() => {
      void (async () => {
        if (scheduledSig !== workspaceProseTriggerSigRef.current) return;
        const evs = sceneEventsRef.current;
        const eventsPayload = evs
          .filter((e) => e.interactions.length > 0)
          .map((e) => ({
            eventId: e.eventId,
            beats: e.interactions.flatMap((inter) =>
              inter.edges.map((ed) => ({
                sourceObjectId: ed.sourceObjectId as Id<"objects">,
                targetObjectId: ed.targetObjectId as Id<"objects">,
                label: ed.label,
                interactionMeaning: ed.interactionMeaning,
              }))
            ),
          }))
          .filter((e) => e.beats.length > 0);
        try {
          const res = await generateEventProses({
            sessionToken: token,
            storyId,
            tone: proseToneRef.current,
            events: eventsPayload,
          });
          if (gen !== proseGenGenRef.current) return;
          if (scheduledSig !== workspaceProseTriggerSigRef.current) return;
          if (res.ok) {
            const next: Record<string, string> = {};
            for (const r of res.results) {
              const p = r.prose.trim();
              if (p) next[r.eventId] = p;
            }
            setAiProseByEventId(next);
          }
          // Advance even on API failure so we don’t retry in a tight loop; change notepad/canvas/timeline to try again.
          setProseAiSourceSig(scheduledSig);
        } catch {
          if (gen === proseGenGenRef.current) {
            setProseAiSourceSig(scheduledSig);
          }
        } finally {
          if (gen === proseGenGenRef.current) {
            setProseAiLoading(false);
          }
        }
      })();
    }, PROSE_AI_DEBOUNCE_MS);

    return () => window.clearTimeout(t);
  }, [
    workspaceProseTriggerSig,
    proseAiSourceSig,
    generateEventProses,
    isAuthor,
    storyId,
    token,
  ]);

  const beatForEditor = useMemo(() => {
    if (!editBeatId) return null;
    for (const ev of sceneEvents) {
      const inter = ev.interactions.find((x) => x.interactionId === editBeatId);
      if (!inter || inter.edges.length === 0) continue;
      const e0 = inter.edges[0]!;
      return {
        id: editBeatId,
        label: e0.label,
        interactionMeaning: e0.interactionMeaning,
        sourceObjectId: e0.sourceObjectId,
        targetObjectId: e0.targetObjectId,
      };
    }
    return null;
  }, [editBeatId, sceneEvents]);

  useEffect(() => {
    if (!editBeatId) return;
    const found = sceneEvents.some((ev) =>
      ev.interactions.some((i) => i.interactionId === editBeatId)
    );
    if (!found) setEditBeatId(null);
  }, [editBeatId, sceneEvents]);

  const handleAddChapter = useCallback(async () => {
    if (!story || !token || userId === null || story.authorId !== userId) return;
    const order = fullChapters.length;
    const chapterId = await createChapter({
      sessionToken: token,
      storyId,
      title: `Chapter ${order + 1}`,
      order,
    });
    const sceneId = await createScene({
      sessionToken: token,
      chapterId,
      title: "Scene 1",
      order: 0,
    });
    handleSelectScene(sceneId as string);
  }, [
    story,
    token,
    userId,
    fullChapters.length,
    createChapter,
    createScene,
    storyId,
    handleSelectScene,
  ]);

  const handleAddScene = useCallback(
    async (chapterId: string) => {
      if (!token) return;
      const chScenes =
        fullChapters.find((c) => c._id === chapterId)?.scenes ?? [];
      const order = chScenes.length;
      const sceneId = await createScene({
        sessionToken: token,
        chapterId: chapterId as Id<"chapters">,
        title: `Scene ${order + 1}`,
        order,
      });
      workspaceHydrateKeyRef.current = null;
      skipNextWorkspaceSaveRef.current = false;
      notepadSyncGenRef.current += 1;
      proseGenGenRef.current += 1;
      notepadTickLayoutResyncedRef.current.clear();
      setAiProseByEventId({});
      setLocalPlacements([]);
      setSceneEvents([]);
      setCurrentTick(0);
      setNotepadText("");
      setTimelineInteractionsPlaying(false);
      setActiveSceneId(sceneId as string);
    },
    [token, fullChapters, createScene]
  );

  const handleRenameChapter = useCallback(
    async (chapterId: string, title: string) => {
      if (!token) return;
      await updateChapter({
        sessionToken: token,
        id: chapterId as Id<"chapters">,
        title: title.trim(),
      });
    },
    [token, updateChapter]
  );

  const handleRenameScene = useCallback(
    async (sceneId: string, title: string) => {
      if (!token) return;
      await updateScene({
        sessionToken: token,
        id: sceneId as Id<"scenes">,
        title: title.trim(),
      });
    },
    [token, updateScene]
  );

  const commitBreadcrumbChapterFromDraft = useCallback(async () => {
    if (!activeSceneContext || !token) return;
    const t = breadcrumbChapterDraft.trim();
    setEditingBreadcrumbChapter(false);
    if (!t) {
      setBreadcrumbChapterDraft(activeSceneContext.chapterTitle);
      return;
    }
    if (t === activeSceneContext.chapterTitle.trim()) return;
    await handleRenameChapter(activeSceneContext.chapterId, t);
  }, [
    activeSceneContext,
    token,
    breadcrumbChapterDraft,
    handleRenameChapter,
  ]);

  const commitBreadcrumbSceneFromDraft = useCallback(async () => {
    if (!activeSceneContext || !token) return;
    const t = breadcrumbSceneDraft.trim();
    setEditingBreadcrumbScene(false);
    if (!t) {
      setBreadcrumbSceneDraft(activeSceneContext.sceneTitle);
      return;
    }
    if (t === activeSceneContext.sceneTitle.trim()) return;
    await handleRenameScene(activeSceneContext.sceneId, t);
  }, [
    activeSceneContext,
    token,
    breadcrumbSceneDraft,
    handleRenameScene,
  ]);

  const commitStoryTitleFromDraft = useCallback(async () => {
    if (!token || !story) return;
    const t = storyTitleDraft.trim();
    setEditingStoryTitle(false);
    if (!t) {
      setStoryTitleDraft(story.title);
      return;
    }
    if (t === story.title.trim()) return;
    await updateStory({
      sessionToken: token,
      id: storyId,
      title: t,
    });
  }, [token, story, storyTitleDraft, storyId, updateStory]);

  const handleChapterSceneTimelineCommit = useCallback(
    async (sceneId: string, start: number, duration: number) => {
      if (!token) return;
      await updateScene({
        sessionToken: token,
        id: sceneId as Id<"scenes">,
        chapterTimelineStart: start,
        chapterTimelineDuration: duration,
      });
    },
    [token, updateScene]
  );

  const handleSeek = useCallback(
    (tick: number) => {
      setCurrentTick(Math.max(0, Math.min(tick, totalTicks)));
    },
    [totalTicks]
  );

  const handleKeyframeUpdate = useCallback(
    (id: string, startTick: number, duration: number) => {
      const parsed = parseKeyframeCompositeId(id);
      if (!parsed) return;
      setSceneEvents((prev) =>
        updateInteractionTiming(
          prev,
          parsed.interactionId,
          startTick,
          duration
        )
      );
    },
    []
  );

  const handleSceneEventTranslate = useCallback(
    (eventId: string, deltaTicks: number) => {
      setSceneEvents((prev) => translateSceneEvent(prev, eventId, deltaTicks));
    },
    []
  );

  const handleCreateInteractionKeyframe = useCallback(
    (args: {
      sourceObjectId: string;
      targetObjectId: string;
      label: string;
      style: "solid" | "dashed" | "wavy" | "dotted";
      interactionMeaning?: string;
    }) => {
      setSceneEvents((prev) =>
        appendInteractionEdge(prev, {
          tick: currentTickRef.current,
          sourceObjectId: args.sourceObjectId,
          targetObjectId: args.targetObjectId,
          label: args.label,
          style: args.style,
          interactionMeaning: args.interactionMeaning,
          duration: DEFAULT_KEYFRAME_DURATION,
          mergeAtTick: true,
        })
      );
    },
    []
  );

  const handlePatchInteractionBeat = useCallback(
    (
      interactionId: string,
      pick: { label: string; interactionMeaning?: string }
    ) => {
      setSceneEvents((prev) =>
        patchInteractionEdgeFields(prev, interactionId, pick)
      );
    },
    []
  );

  const handlePreviewSceneDraft = useCallback(() => {
    if (!objects) return;
    const objs = objects.map((o) => ({
      _id: o._id,
      name: o.name,
      tags: o.tags,
    }));
    const sorted = [...sceneEvents].sort(
      (a, b) =>
        a.startTick - b.startTick || (a.order ?? 0) - (b.order ?? 0)
    );
    const groups = sorted.map((ev) => ({
      eventId: ev.eventId,
      startTick: ev.startTick,
      beats: ev.interactions.flatMap((inter) =>
        inter.edges.map((e) => ({
          _id: `${inter.interactionId}:${e.edgeId}`,
          sourceObjectId: e.sourceObjectId,
          targetObjectId: e.targetObjectId,
          label: e.label,
          interactionMeaning: e.interactionMeaning,
          startTick: inter.startTick,
          duration: inter.duration,
        }))
      ),
    }));
    setSceneDraftText(
      compileSceneDraftFromEvents(
        groups,
        objs,
        {
          sceneLabel: sceneAnchorLabel,
          storyTitle: story?.title ?? "Untitled",
          universeName: universe?.name ?? "",
        },
        aiProseByEventId
      )
    );
    setSceneDraftPreviewOpen(true);
  }, [
    aiProseByEventId,
    sceneEvents,
    objects,
    sceneAnchorLabel,
    story?.title,
    universe?.name,
  ]);

  const handleRemoveInteractionKeyframe = useCallback((keyframeId: string) => {
    setSceneEvents((prev) => removeEdgeByCompositeId(prev, keyframeId));
  }, []);

  const handlePlacementsChange = useCallback(
    (placements: { objectId: string; x: number; y: number }[]) => {
      setLocalPlacements(placements);
    },
    []
  );

  const applyNotepadToWorkspace = useCallback(async () => {
    if (!token || userId === null || !story || story.authorId !== userId) return;
    const gen = (notepadSyncGenRef.current += 1);
    const cmd = notepadTextForHeuristic(notepadText, notepadObjectNames).trim();

    if (!cmd) {
      setSceneEvents([]);
      return;
    }

    const tick = currentTickRef.current;
    const placedObjectIds = placementsRef.current.map((p) => p.objectId);
    const res = await interpretWorkspaceCommand({
      sessionToken: token,
      storyId,
      command: cmd.slice(0, 4000),
      clientContext: { currentTick: tick, placedObjectIds },
      syncBeatsFromNotepad: true,
    });

    if (gen !== notepadSyncGenRef.current) return;
    if (!res.ok) return;

    const addKf = res.patches?.addKeyframes ?? [];
    const kfIds: string[] = [];
    for (const kf of addKf) {
      kfIds.push(kf.sourceObjectId, kf.targetObjectId);
    }

    if (addKf.length > 0) {
      setLocalPlacements((prev) => ensureObjectsOnCanvas(prev, kfIds));
    }

    const startTicks = startTicksForStructuredNotepad(
      addKf.map((kf) => ({
        eventIndex: kf.eventIndex ?? 0,
        lineIndexInEvent: kf.lineIndexInEvent ?? kf.lineIndex ?? 0,
      }))
    );
    const built = buildSceneEventsFromHeuristicKeyframes(
      addKf.map((kf) => ({
        sourceObjectId: kf.sourceObjectId,
        targetObjectId: kf.targetObjectId,
        label: kf.label,
        style: (kf.style ?? "solid") as
          | "solid"
          | "dashed"
          | "wavy"
          | "dotted",
        duration: kf.duration,
        eventIndex: kf.eventIndex ?? 0,
        lineIndexInEvent: kf.lineIndexInEvent ?? kf.lineIndex ?? 0,
      })),
      startTicks,
      DEFAULT_KEYFRAME_DURATION
    );
    setSceneEvents((prev) => mergePreservedSceneEventIds(built, prev));
  }, [
    token,
    userId,
    story,
    notepadText,
    storyId,
    interpretWorkspaceCommand,
    notepadObjectNames,
  ]);

  useEffect(() => {
    if (!token || userId === null || !story || story.authorId !== userId) return;
    const t = window.setTimeout(() => {
      void applyNotepadToWorkspace();
    }, NOTEPAD_TO_WORKSPACE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [
    notepadText,
    token,
    userId,
    story,
    notepadObjectNames,
    applyNotepadToWorkspace,
  ]);

  useEffect(() => {
    if (!isAuthor || !token || userId === null || !story || story.authorId !== userId)
      return;
    if (!activeSceneId || workspaceEvent === undefined || !workspaceEvent?._id)
      return;
    const cmd = notepadTextForHeuristic(notepadText, notepadObjectNames).trim();
    if (!cmd) return;
    const k = `${activeSceneId}:${workspaceEvent._id}:v${NOTEPAD_TICK_LAYOUT_REVISION}`;
    if (notepadTickLayoutResyncedRef.current.has(k)) return;
    const t = window.setTimeout(() => {
      notepadTickLayoutResyncedRef.current.add(k);
      void applyNotepadToWorkspace();
    }, 1000);
    return () => window.clearTimeout(t);
  }, [
    isAuthor,
    token,
    userId,
    story,
    activeSceneId,
    workspaceEvent?._id,
    notepadText,
    notepadObjectNames,
    applyNotepadToWorkspace,
    NOTEPAD_TICK_LAYOUT_REVISION,
  ]);

  useEffect(() => {
    if (!isAuthor || !token || !activeSceneId) return;
    if (workspaceEvent !== null) return;
    if (workspaceEvent === undefined) return;
    void ensureSceneWorkspace({
      sceneId: activeSceneId as Id<"scenes">,
      sessionToken: token,
    });
  }, [isAuthor, token, activeSceneId, workspaceEvent, ensureSceneWorkspace]);

  useEffect(() => {
    if (!activeSceneId) return;
    if (workspaceEvent === undefined) return;
    const key = `${activeSceneId}:${workspaceEvent?._id ?? "none"}`;
    if (isAuthor) {
      if (workspaceHydrateKeyRef.current === key) return;
      workspaceHydrateKeyRef.current = key;
      skipNextWorkspaceSaveRef.current = true;
    }

    if (!workspaceEvent) {
      setLocalPlacements([]);
      setSceneEvents([]);
      setNotepadText("");
      setCurrentTick(0);
      setAiProseByEventId({});
      setProseAiSourceSig(null);
      return;
    }

    const doc: WorkspaceEventDoc = {
      startTick: workspaceEvent.startTick,
      duration: workspaceEvent.duration,
      interactions: workspaceEvent.interactions.map((row) => ({
        beatId: row.beatId,
        sourceObjectId: row.sourceObjectId as string,
        targetObjectId: row.targetObjectId as string,
        label: row.label,
        style: row.style,
        startTick: row.startTick,
        duration: row.duration,
        interactionMeaning: row.interactionMeaning,
        lineIndex: row.lineIndex,
        lineIndexInEvent: row.lineIndexInEvent,
        eventIndex: row.eventIndex,
      })),
      workspaceModelVersion: workspaceEvent.workspaceModelVersion,
      sceneEvents: workspaceEvent.sceneEvents as
        | SceneTimelineEvent[]
        | undefined,
    };
    const se = sceneEventsFromDoc(doc);

    const kfEndpoints: string[] = [];
    for (const k of flattenSceneEventsToKeyframes(se)) {
      kfEndpoints.push(k.sourceObjectId, k.targetObjectId);
    }

    setNotepadText(workspaceEvent.notepadText ?? "");
    setLocalPlacements(
      ensureObjectsOnCanvas(
        workspaceEvent.objectPlacements.map((p) => ({
          objectId: p.objectId as string,
          x: p.x,
          y: p.y,
          scale: p.scale,
        })),
        kfEndpoints
      )
    );
    setSceneEvents(se);
    setCurrentTick(workspaceEvent.workspacePlayheadTick ?? 0);
    setAiProseByEventId(workspaceEvent.aiProseByEventId ?? {});
    setProseAiSourceSig(workspaceEvent.proseAiSourceSig ?? null);
    setSelectedSceneEventId(null);
  }, [activeSceneId, workspaceEvent, isAuthor]);

  useEffect(() => {
    if (!isAuthor || !token || !activeSceneId || !workspaceEvent?._id) return;
    if (!objects) return;
    if (skipNextWorkspaceSaveRef.current) {
      skipNextWorkspaceSaveRef.current = false;
      return;
    }
    const eventId = workspaceEvent._id;
    const sceneId = activeSceneId as Id<"scenes">;
    const t = window.setTimeout(() => {
      const objs = objects.map((o) => ({
        _id: o._id,
        name: o.name,
        tags: o.tags,
      }));
      const { prose: readerProse, usedAi: readerProseUsedAi } =
        compileReaderSceneBody(sceneEvents, objs, aiProseByEventId);
      void saveSceneWorkspace({
        sceneId,
        sessionToken: token,
        eventId,
        notepadText,
        workspacePlayheadTick: currentTick,
        objectPlacements: localPlacements.map((p) => ({
          objectId: p.objectId as Id<"objects">,
          x: p.x,
          y: p.y,
          scale: p.scale,
        })),
        sceneEvents: sceneEvents.map((ev) => ({
          eventId: ev.eventId,
          startTick: ev.startTick,
          duration: ev.duration,
          order: ev.order,
          interactions: ev.interactions.map((inter) => ({
            interactionId: inter.interactionId,
            startTick: inter.startTick,
            duration: inter.duration,
            lineIndexInEvent: inter.lineIndexInEvent,
            linePlaybackStart: inter.linePlaybackStart,
            linePlaybackEnd: inter.linePlaybackEnd,
            edges: inter.edges.map((e) => ({
              edgeId: e.edgeId,
              sourceObjectId: e.sourceObjectId as Id<"objects">,
              targetObjectId: e.targetObjectId as Id<"objects">,
              label: e.label,
              style: e.style,
              interactionMeaning: e.interactionMeaning,
            })),
          })),
        })),
        proseText: readerProse,
        proseGenerated: readerProseUsedAi,
        aiProseByEventId,
        proseAiSourceSig,
      });
    }, SCENE_WORKSPACE_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [
    isAuthor,
    token,
    activeSceneId,
    workspaceEvent?._id,
    notepadText,
    currentTick,
    localPlacements,
    sceneEvents,
    objects,
    aiProseByEventId,
    proseAiSourceSig,
    saveSceneWorkspace,
  ]);

  if (
    story === undefined ||
    !objects ||
    !universe ||
    chaptersWithScenesData === undefined
  ) {
    return (
      <div className="h-dvh flex items-center justify-center">
        <div className="space-y-3 text-center">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (story === null) {
    return (
      <div className="h-dvh flex items-center justify-center px-4">
        <p className="font-display text-lg font-bold text-center">
          Story not found or you don&apos;t have access.
        </p>
      </div>
    );
  }

  const objectRows = objects.map((o) => ({
    _id: o._id,
    name: o.name,
    kind: o.kind,
    description: o.description,
    imageUrl: o.imageUrl,
    tags: o.tags,
  }));

  const navigatorObjectRows = objectRows.filter(
    (o) => !isStoryobjectSceneAnchor(o)
  );

  return (
    <>
      <div className="flex h-dvh min-h-0 min-w-0 flex-col">
        <div className="shrink-0 border-b border-foreground/10 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-face bg-background">
          <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
            <Link
              href={`/universe/${encodeURIComponent(universe.slug)}`}
              className="hover:text-foreground truncate shrink-0"
            >
              {universe.name}
            </Link>
            <span className="text-muted-foreground/40 shrink-0">/</span>
            {isAuthor ? (
              <div className="group/storytitle flex min-w-0 max-w-full items-center gap-0.5">
                {editingStoryTitle ? (
                  <Input
                    value={storyTitleDraft}
                    onChange={(e) => setStoryTitleDraft(e.target.value)}
                    className="h-6 max-w-[min(50vw,16rem)] text-xs font-mono-face"
                    autoFocus
                    aria-label="Story title"
                    onBlur={() => {
                      void commitStoryTitleFromDraft();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.target as HTMLInputElement).blur();
                      }
                      if (e.key === "Escape") {
                        setEditingStoryTitle(false);
                        setStoryTitleDraft(story.title);
                      }
                    }}
                  />
                ) : (
                  <>
                    <span className="truncate text-foreground">{story.title}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/storytitle:opacity-100"
                      title="Rename story"
                      onClick={() => {
                        setEditingStoryTitle(true);
                        setStoryTitleDraft(story.title);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                      <span className="sr-only">Rename story</span>
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <span className="truncate text-foreground">{story.title}</span>
            )}
            <span className="text-muted-foreground/50 shrink-0 hidden sm:inline">
              · workspace
            </span>
            {activeSceneContext ? (
              <>
                <span className="text-muted-foreground/40 shrink-0 hidden sm:inline">
                  ·
                </span>
                {isAuthor ? (
                  <div className="hidden min-w-0 max-w-[min(52vw,24rem)] items-center gap-1 sm:flex">
                    <div className="group/chaptercrumb flex min-w-0 max-w-[min(26vw,12rem)] items-center gap-0.5">
                      <span className="shrink-0 text-foreground/80">
                        {activeSceneContext.chapterIndex1}:
                      </span>
                      {editingBreadcrumbChapter ? (
                        <Input
                          value={breadcrumbChapterDraft}
                          onChange={(e) =>
                            setBreadcrumbChapterDraft(e.target.value)
                          }
                          className="h-6 min-w-0 flex-1 text-xs font-mono-face"
                          autoFocus
                          aria-label="Chapter title"
                          onBlur={() => {
                            void commitBreadcrumbChapterFromDraft();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            }
                            if (e.key === "Escape") {
                              setEditingBreadcrumbChapter(false);
                              setBreadcrumbChapterDraft(
                                activeSceneContext.chapterTitle
                              );
                            }
                          }}
                        />
                      ) : (
                        <>
                          <span className="min-w-0 truncate text-foreground/80">
                            {activeSceneContext.chapterTitle.trim() ||
                              `Chapter ${activeSceneContext.chapterIndex1}`}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-focus-within/chaptercrumb:opacity-100 group-hover/chaptercrumb:opacity-100"
                            title="Rename chapter"
                            onClick={() => {
                              setEditingBreadcrumbChapter(true);
                              setBreadcrumbChapterDraft(
                                activeSceneContext.chapterTitle
                              );
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                            <span className="sr-only">Rename chapter</span>
                          </Button>
                        </>
                      )}
                    </div>
                    <span className="shrink-0 text-muted-foreground/50">
                      ·
                    </span>
                    <div className="group/scenecrumb flex min-w-0 max-w-[min(26vw,12rem)] items-center gap-0.5">
                      <span className="shrink-0 text-foreground/80">
                        {activeSceneContext.sceneIndex1}:
                      </span>
                      {editingBreadcrumbScene ? (
                        <Input
                          value={breadcrumbSceneDraft}
                          onChange={(e) =>
                            setBreadcrumbSceneDraft(e.target.value)
                          }
                          className="h-6 min-w-0 flex-1 text-xs font-mono-face"
                          autoFocus
                          aria-label="Scene title"
                          onBlur={() => {
                            void commitBreadcrumbSceneFromDraft();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            }
                            if (e.key === "Escape") {
                              setEditingBreadcrumbScene(false);
                              setBreadcrumbSceneDraft(
                                activeSceneContext.sceneTitle
                              );
                            }
                          }}
                        />
                      ) : (
                        <>
                          <span className="min-w-0 truncate text-foreground/80">
                            {activeSceneContext.sceneTitle.trim() ||
                              `Scene ${activeSceneContext.sceneIndex1}`}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-focus-within/scenecrumb:opacity-100 group-hover/scenecrumb:opacity-100"
                            title="Rename scene"
                            onClick={() => {
                              setEditingBreadcrumbScene(true);
                              setBreadcrumbSceneDraft(
                                activeSceneContext.sceneTitle
                              );
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                            <span className="sr-only">Rename scene</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="hidden truncate text-foreground/80 sm:inline max-w-[min(40vw,20rem)]">
                    {sceneAnchorLabel}
                  </span>
                )}
              </>
            ) : chapterOnlyNavigatorContext ? (
              <>
                <span className="text-muted-foreground/40 shrink-0 hidden sm:inline">
                  ·
                </span>
                <span className="hidden min-w-0 max-w-[min(52vw,22rem)] truncate text-muted-foreground sm:inline">
                  {numberedChapterLabel(
                    chapterOnlyNavigatorContext.chapterIndex1,
                    chapterOnlyNavigatorContext.chapterTitle
                  )}
                  <span className="text-muted-foreground/65">
                    {" "}
                    — select a scene
                  </span>
                </span>
              </>
            ) : null}
          </div>
          <Link
            href={storyReaderPath(universe.slug, story._id)}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 underline underline-offset-2 hover:text-foreground text-muted-foreground"
          >
            Reader view
          </Link>
        </div>
        <div className="min-h-0 min-w-0 flex-1">
          <WorkspaceLayout
            navigator={
              <NavigatorPanel
                chapters={fullChapters}
                universeSlug={universe.slug}
                objects={navigatorObjectRows}
                activeSceneId={activeSceneId}
                onSelectScene={handleSelectScene}
                onSelectChapter={handleSelectChapter}
                highlightedTimelineChapterId={
                  timelineVariant === "chapter-scenes"
                    ? effectiveTimelineChapterId
                    : null
                }
                selectedChapterOnlyId={
                  !activeSceneId && timelineFocusChapterId
                    ? timelineFocusChapterId
                    : null
                }
                onAddChapter={handleAddChapter}
                onAddScene={handleAddScene}
                onDragObjectStart={() => {}}
                canEditStructure={isAuthor}
                onRenameChapter={handleRenameChapter}
                onRenameScene={handleRenameScene}
                canAddUniverseObjects={isUniverseOwner}
                onAddUniverseObject={
                  isUniverseOwner
                    ? () => setAddUniverseObjectOpen(true)
                    : undefined
                }
                forkUniverseHref={
                  !isUniverseOwner ? forkUniverseFlowHref : undefined
                }
              />
            }
            canvas={
              activeSceneId ? (
                <CanvasWorkspacePanel
                  tab={workspaceTab}
                  onTabChange={setWorkspaceTab}
                  notepad={
                    <StoryNotepad
                      value={notepadText}
                      onChange={setNotepadText}
                      objects={navigatorObjectRows}
                      storyId={storyId}
                      sessionToken={token ?? null}
                      canUseWorkbench={isAuthor}
                      autocompleteResetKey={`${String(activeSceneId ?? "")}:${String(workspaceEvent?._id ?? "")}`}
                      playbackEventRange={
                        notepadDualPlayback?.event ?? null
                      }
                      playbackLineRange={notepadDualPlayback?.line ?? null}
                    />
                  }
                  canvas={
                    <StoryCanvas
                      placements={localPlacements}
                      activeInteractions={canvasActiveInteractions}
                      objects={objectRows}
                      onPlacementsChange={handlePlacementsChange}
                      onCreateInteractionKeyframe={
                        handleCreateInteractionKeyframe
                      }
                      onRemoveInteractionKeyframe={
                        handleRemoveInteractionKeyframe
                      }
                      customInteractionsUserKey={userId ?? "anon"}
                      sceneContext={canvasSceneContext}
                    />
                  }
                />
              ) : (
                <WorkspaceSceneEmptyState />
              )
            }
            prose={
              activeSceneId ? (
                <ProsePanel
                  items={proseItems}
                  activeEventId={selectedSceneEventId ?? activeEventId}
                  onPreviewScene={handlePreviewSceneDraft}
                  proseAiLoading={isAuthor && proseAiLoading}
                  onOpenProseSettings={
                    isAuthor ? () => setProseSettingsOpen(true) : undefined
                  }
                  onEditInteraction={
                    isAuthor ? (id) => setEditBeatId(id) : undefined
                  }
                />
              ) : (
                <ProseSceneEmptyState />
              )
            }
            timeline={
              <Timeline
                variant={timelineVariant}
                onVariantChange={setTimelineVariant}
                keyframes={flatKeyframes}
                sceneEvents={
                  timelineVariant === "interactions" && isAuthor
                    ? sceneEvents.map((e) => ({
                        eventId: e.eventId,
                        startTick: e.startTick,
                        duration: e.duration,
                        order: e.order,
                      }))
                    : []
                }
                onSceneEventTranslate={
                  isAuthor ? handleSceneEventTranslate : undefined
                }
                selectedSceneEventId={selectedSceneEventId}
                onSelectSceneEvent={
                  isAuthor ? (id) => setSelectedSceneEventId(id) : undefined
                }
                trackObjects={trackObjects}
                currentTick={currentTick}
                totalTicks={totalTicks}
                onSeek={handleSeek}
                onKeyframeUpdate={handleKeyframeUpdate}
                chapterTimeline={chapterTimelinePayload}
                onSceneTimelineCommit={handleChapterSceneTimelineCommit}
                readOnlyChapterTimeline={!isAuthor}
                onPlayingChange={setTimelineInteractionsPlaying}
              />
            }
          />
        </div>
      </div>

      <SceneDraftPreviewDialog
        open={sceneDraftPreviewOpen}
        onOpenChange={setSceneDraftPreviewOpen}
        draftText={sceneDraftText}
      />

      <ProseSettingsDialog
        open={proseSettingsOpen}
        onOpenChange={setProseSettingsOpen}
        tone={proseTone}
        onSaveTone={(t) => {
          try {
            localStorage.setItem(PROSE_TONE_STORAGE_KEY, t);
          } catch {
            /* ignore */
          }
          setProseTone(t);
        }}
      />

      <InteractionBeatEditorDialog
        open={editBeatId !== null && beatForEditor !== null}
        onOpenChange={(open) => {
          if (!open) setEditBeatId(null);
        }}
        beat={beatForEditor}
        objects={objects.map((o) => ({
          _id: o._id,
          name: o.name,
          tags: o.tags,
        }))}
        userStorageKey={userId ?? "anon"}
        meaningContextBase={canvasSceneContext}
        onSave={(beatId, pick) => {
          handlePatchInteractionBeat(beatId, {
            label: pick.label,
            interactionMeaning: pick.interactionMeaning,
          });
        }}
      />

      {token && isUniverseOwner && universe ? (
        <AddUniverseObjectDialog
          open={addUniverseObjectOpen}
          onOpenChange={setAddUniverseObjectOpen}
          sessionToken={token}
          universeId={universe._id}
        />
      ) : null}
    </>
  );
}
