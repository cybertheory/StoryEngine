"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WorkspaceTooltipButton } from "@/components/workspace/workspace-tooltip-button";
import { Button } from "@/components/ui/button";
import {
  FastForward,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Playhead } from "./playhead";
import { InteractionClip } from "./interaction-clip";
import { SceneEventRegion } from "./scene-event-region";
import { ChapterSceneTimelineClip } from "@/components/workspace/chapter-scene-timeline-clip";
import {
  layoutChapterSceneTimelines,
  CHAPTER_SCENE_GAP,
  type ChapterSceneTimelineRow,
} from "@/lib/chapter-scene-timeline-layout";
import { numberedSceneLabel } from "@/lib/story-structure-labels";
import {
  computeLanesByObjectAndKeyframe,
  laneDepthForObject,
} from "@/lib/timeline-lanes";
import {
  buildTimelineObjectRowClips,
  objectRowClipsToLaneKeyframes,
} from "@/lib/timeline-display-clips";
import { cn } from "@/lib/utils";

export type { ChapterSceneTimelineRow };

export type TimelineInteractionKeyframe = {
  _id: string;
  /** Workspace interaction (one timeline block per interaction per object row). */
  interactionId: string;
  sourceObjectId: string;
  targetObjectId: string;
  label: string;
  style: string;
  startTick: number;
  duration: number;
  /** Optional persisted stack index; merged with auto lanes when overlaps exist. */
  timelineLane?: number;
};

export type TimelineVariant = "interactions" | "chapter-scenes";

interface StoryObject {
  _id: string;
  name: string;
  kind: string;
  imageUrl?: string;
}

export type ChapterTimelinePayload = {
  chapterId: string;
  chapterIndexLabel: number;
  chapterTitle: string;
  scenes: ChapterSceneTimelineRow[];
};

export type TimelineSceneEventBand = {
  eventId: string;
  startTick: number;
  duration: number;
  order?: number;
};

interface TimelineProps {
  variant: TimelineVariant;
  onVariantChange: (next: TimelineVariant) => void;
  keyframes: TimelineInteractionKeyframe[];
  /** Narrative event bands (same scene); rendered on the dedicated events row. */
  sceneEvents?: TimelineSceneEventBand[];
  onSceneEventTranslate?: (eventId: string, deltaTicks: number) => void;
  selectedSceneEventId?: string | null;
  onSelectSceneEvent?: (eventId: string) => void;
  trackObjects: StoryObject[];
  currentTick: number;
  totalTicks: number;
  onSeek: (tick: number) => void;
  onKeyframeUpdate: (
    id: string,
    startTick: number,
    duration: number
  ) => void;
  /** When non-null, chapter mode can show this chapter’s scene rows. */
  chapterTimeline: ChapterTimelinePayload | null;
  onSceneTimelineCommit?: (
    sceneId: string,
    start: number,
    duration: number
  ) => void | Promise<void>;
  readOnlyChapterTimeline?: boolean;
  /** Fires when interaction-mode play/pause changes (notepad can gate highlights on this). */
  onPlayingChange?: (playing: boolean) => void;
}

const INTERACTION_TICK_WIDTH_BASE = 4;
const CHAPTER_TICK_WIDTH_BASE = 5;
const CHAPTER_TIMELINE_PAD_TICKS = 24;
/** How many timeline ticks advance per real second while playing (canvas edges follow the playhead). */
const PLAYBACK_TICKS_PER_SECOND = 14;
/** Fast-forward jump (ticks per click). */
const FAST_FORWARD_TICK_JUMP = 24;

const RULER_ROW_PX = 24;
const EVENTS_ROW_PX = 32;
const LANE_STRIDE_PX = 20;
const TRACK_ROW_MIN_PX = 28;

export function Timeline({
  variant,
  onVariantChange,
  keyframes,
  sceneEvents = [],
  onSceneEventTranslate,
  selectedSceneEventId = null,
  onSelectSceneEvent,
  trackObjects,
  currentTick,
  totalTicks,
  onSeek,
  onKeyframeUpdate,
  chapterTimeline,
  onSceneTimelineCommit,
  readOnlyChapterTimeline = false,
  onPlayingChange,
}: TimelineProps) {
  const [zoom, setZoom] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const currentTickRef = useRef(currentTick);
  const totalTicksRef = useRef(totalTicks);
  const onSeekRef = useRef(onSeek);
  currentTickRef.current = currentTick;
  totalTicksRef.current = totalTicks;
  onSeekRef.current = onSeek;

  const isChapter = variant === "chapter-scenes";

  useEffect(() => {
    if (isChapter) setIsPlaying(false);
  }, [isChapter]);

  useEffect(() => {
    onPlayingChange?.(isPlaying);
  }, [isPlaying, onPlayingChange]);

  useEffect(() => {
    if (!isPlaying) return;
    const tickMs = Math.max(20, Math.round(1000 / PLAYBACK_TICKS_PER_SECOND));
    const id = window.setInterval(() => {
      const t = currentTickRef.current;
      const max = totalTicksRef.current;
      const next = t + 1;
      if (next > max) {
        setIsPlaying(false);
        return;
      }
      currentTickRef.current = next;
      onSeekRef.current(next);
    }, tickMs);
    return () => window.clearInterval(id);
  }, [isPlaying]);

  const togglePlayback = useCallback(() => {
    setIsPlaying((p) => {
      if (p) return false;
      const max = totalTicksRef.current;
      let t = currentTickRef.current;
      if (t >= max) {
        onSeekRef.current(0);
        currentTickRef.current = 0;
        t = 0;
      }
      return true;
    });
  }, []);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const seekToStart = useCallback(() => {
    setIsPlaying(false);
    onSeek(0);
    currentTickRef.current = 0;
  }, [onSeek]);

  const seekToEnd = useCallback(() => {
    setIsPlaying(false);
    const max = totalTicksRef.current;
    onSeek(max);
    currentTickRef.current = max;
  }, [onSeek]);

  const fastForward = useCallback(() => {
    setIsPlaying(false);
    const max = totalTicksRef.current;
    const t = currentTickRef.current;
    const next = Math.min(max, t + FAST_FORWARD_TICK_JUMP);
    onSeek(next);
    currentTickRef.current = next;
  }, [onSeek]);

  const tickWidth = isChapter
    ? CHAPTER_TICK_WIDTH_BASE * zoom
    : INTERACTION_TICK_WIDTH_BASE * zoom;

  const chapterLayout = useMemo(() => {
    if (!chapterTimeline?.scenes.length) return [];
    return layoutChapterSceneTimelines(chapterTimeline.scenes);
  }, [chapterTimeline]);

  const chapterTotalTicks = useMemo(() => {
    let maxEnd = 48;
    for (const row of chapterLayout) {
      maxEnd = Math.max(maxEnd, row.start + row.duration + CHAPTER_SCENE_GAP);
    }
    return Math.ceil(maxEnd + CHAPTER_TIMELINE_PAD_TICKS);
  }, [chapterLayout]);

  const effectiveTotalTicks = isChapter ? chapterTotalTicks : totalTicks;
  totalTicksRef.current = effectiveTotalTicks;

  const totalWidth = Math.max(effectiveTotalTicks * tickWidth, isChapter ? 480 : 800);

  const objectRowClips = useMemo(
    () => buildTimelineObjectRowClips(keyframes),
    [keyframes]
  );

  const laneMap = useMemo(
    () =>
      computeLanesByObjectAndKeyframe(
        objectRowClipsToLaneKeyframes(objectRowClips),
        trackObjects.map((o) => o._id)
      ),
    [objectRowClips, trackObjects]
  );

  const sceneEventsSorted = useMemo(
    () =>
      [...sceneEvents].sort((a, b) => {
        const oa = a.order ?? 0;
        const ob = b.order ?? 0;
        if (oa !== ob) return oa - ob;
        return a.startTick - b.startTick;
      }),
    [sceneEvents]
  );

  const showEventsRow = Boolean(
    sceneEvents.length > 0 && onSceneEventTranslate
  );
  const tracksTopPx = RULER_ROW_PX + (showEventsRow ? EVENTS_ROW_PX : 0);

  const clientXToTick = useCallback(
    (clientX: number) => {
      const el = timelineRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const tick = Math.round(x / tickWidth);
      return Math.max(0, Math.min(tick, effectiveTotalTicks));
    },
    [tickWidth, effectiveTotalTicks]
  );

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      if (isChapter) return;
      setIsPlaying(false);
      onSeek(clientXToTick(e.clientX));
      currentTickRef.current = clientXToTick(e.clientX);
    },
    [clientXToTick, onSeek, isChapter]
  );

  const handleScrubTick = useCallback(
    (tick: number) => {
      onSeek(tick);
      currentTickRef.current = tick;
    },
    [onSeek]
  );

  const handleScrubInteraction = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleChapterClipUpdate = useCallback(
    async (sceneId: string, start: number, duration: number) => {
      await onSceneTimelineCommit?.(sceneId, start, duration);
    },
    [onSceneTimelineCommit]
  );

  const chapterSubtitle = useMemo(() => {
    if (!chapterTimeline) {
      return "Click a chapter in the story sidebar to schedule its scenes, or pick a scene first then open this tab.";
    }
    if (chapterTimeline.scenes.length === 0) {
      return "No scenes in this chapter yet.";
    }
    return `Chapter ${chapterTimeline.chapterIndexLabel} · ${chapterTimeline.chapterTitle.trim() || "Untitled"} — one row per scene; drag blocks to place chapter time.`;
  }, [chapterTimeline]);

  const setChapterZoomOut = useCallback(() => {
    setZoom((z) => Math.max(0.35, z - 0.2));
  }, []);
  const setChapterZoomIn = useCallback(() => {
    setZoom((z) => Math.min(3, z + 0.2));
  }, []);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <div className="flex flex-col gap-1.5 border-b border-foreground/10 px-3 py-1.5 shrink-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <h3 className="section-label shrink-0">Timeline</h3>
          <div
            className="flex w-fit shrink-0 rounded border border-foreground/15 p-px text-[10px] font-mono-face"
            role="tablist"
            aria-label="Timeline mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isChapter}
              className={cn(
                "rounded px-2 py-0.5 transition-colors",
                !isChapter
                  ? "bg-foreground/12 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onVariantChange("interactions")}
            >
              Interactions
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isChapter}
              className={cn(
                "rounded px-2 py-0.5 transition-colors",
                isChapter
                  ? "bg-foreground/12 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onVariantChange("chapter-scenes")}
            >
              Chapter scenes
            </button>
          </div>
          <span className="text-[10px] font-mono-face text-muted-foreground line-clamp-2 sm:truncate">
            {isChapter
              ? chapterSubtitle
              : `Tick ${currentTick} / ${effectiveTotalTicks} · Events row = scene blocks (E1…); object rows = one block per interaction (verbs joined if several edges touch that object)`}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-0.5">
          {!isChapter ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-none"
                title="Go to start"
                onClick={seekToStart}
              >
                <SkipBack className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-none"
                title="Stop playback"
                onClick={stopPlayback}
              >
                <Square className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-none"
                title={isPlaying ? "Pause" : "Play"}
                onClick={togglePlayback}
              >
                {isPlaying ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-none"
                title={`Fast forward +${FAST_FORWARD_TICK_JUMP} ticks`}
                onClick={fastForward}
              >
                <FastForward className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-none"
                title="Go to end"
                onClick={seekToEnd}
              >
                <SkipForward className="h-3 w-3" />
              </Button>
              <span
                className="mx-0.5 h-4 w-px self-center bg-foreground/15"
                aria-hidden
              />
            </>
          ) : null}
          <WorkspaceTooltipButton
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            tooltip="Zoom timeline out"
            tooltipSide="bottom"
            onClick={() =>
              isChapter
                ? setChapterZoomOut()
                : setZoom((z) => Math.max(0.25, z - 0.25))
            }
          >
            <ZoomOut className="h-3 w-3" />
          </WorkspaceTooltipButton>
          <span className="w-8 text-center text-[10px] font-mono-face text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <WorkspaceTooltipButton
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            tooltip="Zoom timeline in"
            tooltipSide="bottom"
            onClick={() =>
              isChapter
                ? setChapterZoomIn()
                : setZoom((z) => Math.min(4, z + 0.25))
            }
          >
            <ZoomIn className="h-3 w-3" />
          </WorkspaceTooltipButton>
        </div>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-auto workspace-scrollbar">
        {isChapter ? (
          <div className="flex w-max min-w-full">
            <div className="w-36 shrink-0 border-r border-foreground/10">
              <div className="flex h-6 items-center border-b border-foreground/10 px-2">
                <span className="text-[9px] font-mono-face text-muted-foreground/50">
                  SCENES
                </span>
              </div>
              {!chapterTimeline || chapterLayout.length === 0 ? (
                <div className="border-b border-foreground/5 px-2 py-4 text-[10px] font-mono-face text-muted-foreground">
                  —
                </div>
              ) : (
                chapterLayout.map(({ scene }, sceneIndex) => (
                  <div
                    key={scene._id}
                    className="flex h-8 items-center gap-1 border-b border-foreground/5 px-2"
                  >
                    <span className="truncate text-[10px] font-mono-face">
                      {numberedSceneLabel(sceneIndex + 1, scene.title)}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div
              ref={timelineRef}
              className="relative shrink-0"
              style={{ width: totalWidth, minWidth: totalWidth }}
            >
              {!chapterTimeline || chapterLayout.length === 0 ? (
                <div className="min-h-[8rem] border-b border-foreground/10 px-3 py-6 text-center text-[10px] font-mono-face text-muted-foreground">
                  {!chapterTimeline
                    ? "Choose a scene on the left to load its chapter here."
                    : "Add scenes to this chapter from the story panel."}
                </div>
              ) : (
                <>
                  <div className="relative h-6 border-b border-foreground/10 bg-background/80">
                    {Array.from({
                      length: Math.ceil(chapterTotalTicks / 10) + 1,
                    }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 flex h-full flex-col justify-end"
                        style={{ left: i * 10 * tickWidth }}
                      >
                        <div className="h-2 w-px bg-foreground/30" />
                        <span className="-translate-x-1/2 text-[7px] font-mono-face leading-none text-muted-foreground/50">
                          {i * 10}
                        </span>
                      </div>
                    ))}
                  </div>
                  {chapterLayout.map(({ scene, start, duration }, sceneIndex) => (
                    <div
                      key={scene._id}
                      className="relative h-8 border-b border-foreground/5"
                    >
                      <ChapterSceneTimelineClip
                        sceneId={scene._id}
                        label={numberedSceneLabel(sceneIndex + 1, scene.title)}
                        startTick={start}
                        duration={duration}
                        tickWidth={tickWidth}
                        readOnly={readOnlyChapterTimeline}
                        onUpdate={handleChapterClipUpdate}
                      />
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex w-max min-w-full">
            <div className="w-36 shrink-0 border-r border-foreground/10">
              <div className="flex h-6 items-center border-b border-foreground/10 px-2">
                <span className="text-[9px] font-mono-face text-muted-foreground/50">
                  RULER
                </span>
              </div>
              {trackObjects.map((obj) => (
                <div
                  key={obj._id}
                  className="flex h-8 items-center gap-1.5 border-b border-foreground/5 px-2"
                >
                  {obj.imageUrl ? (
                    <img
                      src={obj.imageUrl}
                      alt={obj.name}
                      className="h-5 w-5 shrink-0 border border-foreground/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center border border-foreground/10 bg-muted">
                      <span className="text-[7px] font-mono-face font-bold text-muted-foreground/40">
                        {obj.name[0]}
                      </span>
                    </div>
                  )}
                  <span className="truncate text-[10px] font-mono-face">
                    {obj.name}
                  </span>
                </div>
              ))}
              {trackObjects.length === 0 && (
                <div className="px-2 py-4 text-[10px] font-mono-face text-muted-foreground">
                  Place objects, drag from right handle to left handle, then
                  confirm in the dialog to add interaction keyframes.
                </div>
              )}
            </div>

            <div
              ref={timelineRef}
              className="relative shrink-0 cursor-crosshair"
              onClick={handleTimelineClick}
              style={{ width: totalWidth, minWidth: totalWidth }}
            >
              <div className="relative h-6 border-b border-foreground/10">
                {Array.from({
                  length: Math.ceil(effectiveTotalTicks / 10) + 1,
                }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 flex h-full flex-col justify-end"
                    style={{ left: i * 10 * tickWidth }}
                  >
                    <div className="h-2 w-px bg-foreground/30" />
                    <span className="-translate-x-1/2 text-[7px] font-mono-face leading-none text-muted-foreground/40">
                      {i * 10}
                    </span>
                  </div>
                ))}
              </div>

              {showEventsRow ? (
                <div
                  className="relative z-[3] h-8 shrink-0 border-b border-foreground/10 bg-muted/20"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <span className="pointer-events-none absolute left-1 top-1 z-[4] text-[8px] font-mono-face uppercase tracking-wide text-muted-foreground/60">
                    Events
                  </span>
                  {sceneEventsSorted.map((ev, ei) => (
                    <SceneEventRegion
                      key={ev.eventId}
                      label={`E${ei + 1}`}
                      eventId={ev.eventId}
                      startTick={ev.startTick}
                      duration={ev.duration}
                      tickWidth={tickWidth}
                      totalTicks={effectiveTotalTicks}
                      selected={selectedSceneEventId === ev.eventId}
                      onSelect={(id) => onSelectSceneEvent?.(id)}
                      onTranslate={onSceneEventTranslate!}
                    />
                  ))}
                </div>
              ) : null}

              <div className="relative">
                {trackObjects.map((obj) => {
                  const depth = laneDepthForObject(laneMap, obj._id);
                  const rowH = Math.max(
                    TRACK_ROW_MIN_PX,
                    6 + depth * LANE_STRIDE_PX + 4
                  );
                  return (
                    <div
                      key={obj._id}
                      className="relative z-[2] border-b border-foreground/5"
                      style={{ minHeight: rowH }}
                    >
                      {objectRowClips
                        .filter((c) => c.rowObjectId === obj._id)
                        .map((c) => {
                          const laneKey = `${obj._id}\t${c.clipId}`;
                          const laneIndex = laneMap.get(laneKey) ?? 0;
                          return (
                            <InteractionClip
                              key={c.clipId}
                              keyframeId={c.updateKeyframeId}
                              label={c.label}
                              startTick={c.startTick}
                              duration={c.duration}
                              tickWidth={tickWidth}
                              totalTicks={effectiveTotalTicks}
                              displayOffsetPx={0}
                              laneIndex={laneIndex}
                              laneStridePx={LANE_STRIDE_PX}
                              onUpdate={onKeyframeUpdate}
                            />
                          );
                        })}
                    </div>
                  );
                })}
              </div>

              <Playhead
                tick={currentTick}
                tickWidth={tickWidth}
                clientXToTick={clientXToTick}
                onScrubTick={handleScrubTick}
                onScrubInteraction={handleScrubInteraction}
                topPx={tracksTopPx}
              />
            </div>
          </div>
        )}
      </div>

      {isChapter && readOnlyChapterTimeline ? (
        <p className="shrink-0 border-t border-foreground/10 px-3 py-1 text-[10px] font-mono-face text-muted-foreground">
          View only — sign in as the story author to edit chapter scene timing.
        </p>
      ) : null}
    </div>
  );
}
