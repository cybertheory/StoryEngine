import type { Id } from "../_generated/dataModel";

type Style = "solid" | "dashed" | "wavy" | "dotted";

export type SceneEventArg = {
  eventId: string;
  startTick: number;
  duration: number;
  order?: number;
  interactions: {
    interactionId: string;
    startTick: number;
    duration: number;
    timelineLane?: number;
    lineIndexInEvent?: number;
    linePlaybackStart?: number;
    linePlaybackEnd?: number;
    edges: {
      edgeId: string;
      sourceObjectId: Id<"objects">;
      targetObjectId: Id<"objects">;
      label: string;
      style: Style;
      interactionMeaning?: string;
    }[];
  }[];
};

function overlaps(a: SceneEventArg, b: SceneEventArg): boolean {
  const a0 = a.startTick;
  const a1 = a.startTick + a.duration;
  const b0 = b.startTick;
  const b1 = b.startTick + b.duration;
  return a0 < b1 && b0 < a1;
}

export function assertSceneEventsNonOverlapping(events: SceneEventArg[]): void {
  const sorted = [...events].sort((x, y) => x.startTick - y.startTick);
  for (let i = 1; i < sorted.length; i++) {
    if (overlaps(sorted[i - 1], sorted[i])) {
      throw new Error("Scene timeline events overlap.");
    }
  }
}

export function flattenSceneEventsForDb(sceneEvents: SceneEventArg[]) {
  const eventOrder = [...sceneEvents].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.startTick - b.startTick
  );
  const out: {
    beatId: string;
    sourceObjectId: Id<"objects">;
    targetObjectId: Id<"objects">;
    label: string;
    style: Style;
    startTick: number;
    duration: number;
    interactionMeaning?: string;
    lineIndexInEvent?: number;
    eventIndex?: number;
    linePlaybackStart?: number;
    linePlaybackEnd?: number;
    timelineLane?: number;
  }[] = [];
  eventOrder.forEach((ev, eventIndex) => {
    for (const inter of ev.interactions) {
      for (const edge of inter.edges) {
        out.push({
          beatId: `${inter.interactionId}:${edge.edgeId}`,
          sourceObjectId: edge.sourceObjectId,
          targetObjectId: edge.targetObjectId,
          label: edge.label,
          style: edge.style,
          startTick: inter.startTick,
          duration: inter.duration,
          interactionMeaning: edge.interactionMeaning,
          lineIndexInEvent: inter.lineIndexInEvent,
          eventIndex,
          linePlaybackStart: inter.linePlaybackStart,
          linePlaybackEnd: inter.linePlaybackEnd,
          timelineLane: inter.timelineLane,
        });
      }
    }
  });
  return out;
}

export function envelopeTicks(
  sceneEvents: SceneEventArg[],
  minTicks: number
): { startTick: number; duration: number } {
  if (sceneEvents.length === 0) {
    return { startTick: 0, duration: minTicks };
  }
  const starts = sceneEvents.map((e) => e.startTick);
  const ends = sceneEvents.map((e) => e.startTick + e.duration);
  const startTick = Math.min(...starts);
  const endMax = Math.max(...ends);
  return {
    startTick,
    duration: Math.max(minTicks, endMax - startTick),
  };
}
