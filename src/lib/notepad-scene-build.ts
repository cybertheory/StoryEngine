import type {
  InteractionEdge,
  SceneTimelineEvent,
  WorkspaceInteraction,
} from "@/lib/workspace-model";
import { packSceneEventsNonOverlapping } from "@/lib/workspace-model";

/** Semantic identity of an event (no random ids) — for prose cache keys and id preservation. */
export function sceneEventStructureKey(ev: SceneTimelineEvent): string {
  const intr = [...ev.interactions]
    .sort(
      (a, b) =>
        (a.lineIndexInEvent ?? 0) - (b.lineIndexInEvent ?? 0) ||
        a.startTick - b.startTick
    )
    .map((i) => ({
      li: i.lineIndexInEvent,
      e: i.edges.map((e) => [
        e.sourceObjectId,
        e.targetObjectId,
        e.label,
        e.interactionMeaning ?? "",
      ]),
    }));
  return JSON.stringify({ or: ev.order ?? 0, intr });
}

function interactionStructureKey(i: WorkspaceInteraction): string {
  return JSON.stringify({
    li: i.lineIndexInEvent,
    e: i.edges.map((e) => [
      e.sourceObjectId,
      e.targetObjectId,
      e.label,
      e.interactionMeaning ?? "",
    ]),
  });
}

/** Fingerprint for AI prose triggers — stable across notepad re-parses that only rotate ids. */
export function sceneEventsStructureFingerprint(
  events: SceneTimelineEvent[]
): string {
  const sorted = [...events].sort(
    (a, b) =>
      a.startTick - b.startTick || (a.order ?? 0) - (b.order ?? 0)
  );
  return sorted.map((ev) => sceneEventStructureKey(ev)).join("\n|\n");
}

/**
 * After rebuilding scene events from the notepad, reuse event / interaction / edge ids when
 * structure matches so `aiProseByEventId` and timeline refs stay valid.
 */
export function mergePreservedSceneEventIds(
  built: SceneTimelineEvent[],
  previous: SceneTimelineEvent[]
): SceneTimelineEvent[] {
  if (previous.length === 0) return built;

  const buckets = new Map<string, SceneTimelineEvent[]>();
  for (const ev of previous) {
    const k = sceneEventStructureKey(ev);
    const list = buckets.get(k) ?? [];
    list.push(ev);
    buckets.set(k, list);
  }

  return built.map((ev) => {
    const k = sceneEventStructureKey(ev);
    const candidates = buckets.get(k);
    if (!candidates || candidates.length === 0) return ev;
    const match = candidates.shift()!;

    return {
      ...ev,
      eventId: match.eventId,
      interactions: ev.interactions.map((inter) => {
        const pk = interactionStructureKey(inter);
        const prevInter = match.interactions.find(
          (p) => interactionStructureKey(p) === pk
        );
        if (!prevInter) return inter;
        return {
          ...inter,
          interactionId: prevInter.interactionId,
          timelineLane: prevInter.timelineLane,
          edges: inter.edges.map((e, ei) => {
            const pe = prevInter.edges[ei];
            if (
              pe &&
              pe.sourceObjectId === e.sourceObjectId &&
              pe.targetObjectId === e.targetObjectId &&
              pe.label === e.label &&
              (pe.interactionMeaning ?? "") === (e.interactionMeaning ?? "")
            ) {
              return { ...e, edgeId: pe.edgeId };
            }
            return e;
          }),
        };
      }),
    };
  });
}

export type HeuristicKeyframe = {
  sourceObjectId: string;
  targetObjectId: string;
  label: string;
  style: InteractionEdge["style"];
  duration?: number;
  eventIndex: number;
  lineIndexInEvent: number;
};

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Group heuristic keyframes into scene events (one interaction per notepad line; multiple edges if chained). */
export function buildSceneEventsFromHeuristicKeyframes(
  kfs: HeuristicKeyframe[],
  startTicks: number[],
  defaultDuration: number
): SceneTimelineEvent[] {
  if (kfs.length === 0) return [];

  type LineKey = `${number}:${number}`;
  const lineGroups = new Map<
    LineKey,
    { kfs: HeuristicKeyframe[]; ticks: number[] }
  >();

  for (let i = 0; i < kfs.length; i++) {
    const k = kfs[i];
    const key = `${k.eventIndex}:${k.lineIndexInEvent}` as LineKey;
    const g = lineGroups.get(key) ?? { kfs: [], ticks: [] };
    g.kfs.push(k);
    g.ticks.push(startTicks[i] ?? 0);
    lineGroups.set(key, g);
  }

  const eventIndices = [
    ...new Set(kfs.map((k) => k.eventIndex)),
  ].sort((a, b) => a - b);

  const sceneEvents: SceneTimelineEvent[] = [];

  for (const eventIndex of eventIndices) {
    const lineKeys = [...lineGroups.keys()].filter((k) =>
      k.startsWith(`${eventIndex}:`)
    );
    lineKeys.sort((a, b) => {
      const la = parseInt(a.split(":")[1]!, 10);
      const lb = parseInt(b.split(":")[1]!, 10);
      return la - lb;
    });

    const interactions: WorkspaceInteraction[] = [];
    for (const lk of lineKeys) {
      const { kfs: group, ticks } = lineGroups.get(lk)!;
      const st = Math.min(...ticks);
      const dur =
        group[0]?.duration ??
        defaultDuration;
      const interactionId = newId("ik");
      const edges: InteractionEdge[] = group.map((row, j) => ({
        edgeId: newId(`e${j}`),
        sourceObjectId: row.sourceObjectId,
        targetObjectId: row.targetObjectId,
        label: row.label,
        style: row.style,
      }));
      const lineIndexInEvent = group[0]!.lineIndexInEvent;
      interactions.push({
        interactionId,
        startTick: st,
        duration: dur,
        lineIndexInEvent,
        edges,
      });
    }

    if (interactions.length === 0) continue;

    const lo = Math.min(...interactions.map((i) => i.startTick));
    const hi = Math.max(
      ...interactions.map((i) => i.startTick + i.duration)
    );
    sceneEvents.push({
      eventId: newId("ev"),
      startTick: lo,
      duration: Math.max(8, hi - lo),
      order: eventIndex,
      interactions,
    });
  }

  return packSceneEventsNonOverlapping(sceneEvents);
}
