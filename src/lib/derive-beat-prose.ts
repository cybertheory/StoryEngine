import type { SceneTimelineEvent } from "@/lib/workspace-model";
import { isStoryobjectSceneAnchor } from "@/lib/scene-anchor";

type BeatFields = {
  sourceObjectId: string;
  targetObjectId: string;
  label: string;
  interactionMeaning?: string;
};

export type NamedObject = { _id: string; name: string; tags?: string[] };

/** Single-paragraph beat line from roles + verb (no custom meaning). */
export function beatActionLine(k: BeatFields, objs: NamedObject[]): string {
  const src = objs.find((o) => o._id === k.sourceObjectId)?.name ?? "One";
  const tgtObj = objs.find((o) => o._id === k.targetObjectId);
  if (tgtObj && isStoryobjectSceneAnchor(tgtObj)) {
    return `At this beat, ${src} ${k.label}.`;
  }
  const tgt = tgtObj?.name ?? "another";
  return `At this beat, ${src} ${k.label} ${tgt}.`;
}

export function beatSummaryLine(k: BeatFields, objs: NamedObject[]): string {
  const src = objs.find((o) => o._id === k.sourceObjectId)?.name ?? "?";
  const tgtObj = objs.find((o) => o._id === k.targetObjectId);
  if (tgtObj && isStoryobjectSceneAnchor(tgtObj)) {
    return `${src} · ${k.label}`;
  }
  const tgt = tgtObj?.name ?? "?";
  return `${src} → ${tgt} · ${k.label}`;
}

/**
 * Full read-only copy for the prose panel: optional author meaning, then the beat line.
 * Recomputes whenever label, endpoints, meaning, or object names change.
 */
export function deriveBeatProse(k: BeatFields, objs: NamedObject[]): string {
  const line = beatActionLine(k, objs);
  const m = k.interactionMeaning?.trim();
  if (m) return `${m}\n\n${line}`;
  return line;
}

export type DraftKeyframe = BeatFields & {
  _id: string;
  startTick: number;
  duration: number;
};

/** Compiles all interaction beats into one draft document for preview. */
export function compileSceneDraft(
  keyframes: DraftKeyframe[],
  objs: NamedObject[],
  meta: {
    sceneLabel: string | null;
    storyTitle: string;
    universeName: string;
  },
  /** When present, uses AI-rendered copy per beat id instead of the template. */
  aiProseByBeatId?: Record<string, string>
): string {
  const sorted = [...keyframes].sort(
    (a, b) =>
      a.startTick - b.startTick || a._id.localeCompare(b._id)
  );

  const hasAi = Boolean(
    aiProseByBeatId &&
      sorted.some((k) => (aiProseByBeatId[k._id] ?? "").trim().length > 0)
  );

  const lines: string[] = [
    "SCENE DRAFT",
    "─────────────",
    meta.sceneLabel ? `Where: ${meta.sceneLabel}` : null,
    `Story: ${meta.storyTitle}`,
    `World: ${meta.universeName}`,
    "",
    hasAi
      ? "Compiled from interaction beats. Passages use AI-rendered prose where available, otherwise the beat template."
      : "Compiled from interaction beats (read-only source of truth on the canvas and timeline).",
    "",
  ].filter((x): x is string => x !== null);

  sorted.forEach((k, i) => {
    lines.push(`── Beat ${i + 1} · tick ${k.startTick} ──`);
    lines.push(beatSummaryLine(k, objs));
    lines.push("");
    const ai = aiProseByBeatId?.[k._id]?.trim();
    lines.push(ai && ai.length > 0 ? ai : deriveBeatProse(k, objs));
    lines.push("");
  });

  if (sorted.length === 0) {
    lines.push("(No interaction beats in this scene yet.)");
  }

  return lines.join("\n").trim();
}

export type SceneEventDraftBeat = BeatFields & {
  _id: string;
  startTick: number;
  duration: number;
};

export type SceneEventDraftGroup = {
  eventId: string;
  startTick: number;
  beats: SceneEventDraftBeat[];
};

/** Scene draft grouped by narrative event (one section per event). */
export function compileSceneDraftFromEvents(
  eventGroups: SceneEventDraftGroup[],
  objs: NamedObject[],
  meta: {
    sceneLabel: string | null;
    storyTitle: string;
    universeName: string;
  },
  aiProseByEventId?: Record<string, string>
): string {
  const sorted = [...eventGroups].sort(
    (a, b) => a.startTick - b.startTick || a.eventId.localeCompare(b.eventId)
  );

  const hasAi = Boolean(
    aiProseByEventId &&
      sorted.some((e) => (aiProseByEventId[e.eventId] ?? "").trim().length > 0)
  );

  const lines: string[] = [
    "SCENE DRAFT",
    "─────────────",
    meta.sceneLabel ? `Where: ${meta.sceneLabel}` : null,
    `Story: ${meta.storyTitle}`,
    `World: ${meta.universeName}`,
    "",
    hasAi
      ? "Compiled by scene event. AI prose per event where available; otherwise templates from each interaction."
      : "Compiled by scene event from interactions on the canvas and timeline.",
    "",
  ].filter((x): x is string => x !== null);

  sorted.forEach((ev, ei) => {
    const beats = [...ev.beats].sort(
      (a, b) =>
        a.startTick - b.startTick || a._id.localeCompare(b._id)
    );
    const ai = aiProseByEventId?.[ev.eventId]?.trim();
    lines.push(`══ Event ${ei + 1} · tick ${ev.startTick} ══`);
    if (ai && ai.length > 0) {
      lines.push(ai);
      lines.push("");
      return;
    }
    beats.forEach((k, i) => {
      lines.push(`── Interaction ${i + 1} · tick ${k.startTick} ──`);
      lines.push(beatSummaryLine(k, objs));
      lines.push("");
    });
    const template = beats
      .map((k) => deriveBeatProse(k, objs))
      .join("\n\n");
    lines.push(template);
    lines.push("");
  });

  if (sorted.length === 0) {
    lines.push("(No scene events in this workspace yet.)");
  }

  return lines.join("\n").trim();
}

/** Single template block for an event (concatenates interaction templates). */
export function deriveEventTemplateProse(
  beats: BeatFields[],
  objs: NamedObject[]
): string {
  if (beats.length === 0) return "";
  return beats.map((b) => deriveBeatProse(b, objs)).join("\n\n");
}

/**
 * Readable body for the public story reader: one block per scene event (AI when
 * available, otherwise beat templates). Same substance as the workbench prose panel.
 */
export function compileReaderSceneBody(
  sceneEvents: SceneTimelineEvent[],
  objs: NamedObject[],
  aiProseByEventId?: Record<string, string>
): { prose: string; usedAi: boolean } {
  const sorted = [...sceneEvents].sort(
    (a, b) =>
      a.startTick - b.startTick || (a.order ?? 0) - (b.order ?? 0)
  );
  let usedAi = false;
  const parts: string[] = [];
  for (const ev of sorted) {
    const beats: BeatFields[] = [];
    for (const inter of ev.interactions) {
      for (const e of inter.edges) {
        beats.push({
          sourceObjectId: e.sourceObjectId,
          targetObjectId: e.targetObjectId,
          label: e.label,
          interactionMeaning: e.interactionMeaning,
        });
      }
    }
    if (beats.length === 0) continue;
    const ai = aiProseByEventId?.[ev.eventId]?.trim();
    if (ai && ai.length > 0) {
      usedAi = true;
      parts.push(ai);
    } else {
      parts.push(deriveEventTemplateProse(beats, objs));
    }
  }
  return { prose: parts.join("\n\n").trim(), usedAi };
}
