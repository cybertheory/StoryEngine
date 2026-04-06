/** Scene workbench canonical model (events → interactions → edges). */

export const WORKSPACE_MODEL_VERSION = 2;

export type InteractionEdge = {
  edgeId: string;
  sourceObjectId: string;
  targetObjectId: string;
  label: string;
  style: "solid" | "dashed" | "wavy" | "dotted";
  interactionMeaning?: string;
};

export type WorkspaceInteraction = {
  interactionId: string;
  startTick: number;
  duration: number;
  /** Vertical stack index on object rows when multiple beats overlap in time (optional). */
  timelineLane?: number;
  lineIndexInEvent?: number;
  linePlaybackStart?: number;
  linePlaybackEnd?: number;
  edges: InteractionEdge[];
};

export type SceneTimelineEvent = {
  eventId: string;
  startTick: number;
  duration: number;
  order?: number;
  interactions: WorkspaceInteraction[];
};

/** Convex workspace row shape we hydrate from (partial). */
export type WorkspaceEventDocInteractionsRow = {
  beatId?: string;
  sourceObjectId: string;
  targetObjectId: string;
  label: string;
  style: "solid" | "dashed" | "wavy" | "dotted";
  startTick?: number;
  duration?: number;
  interactionMeaning?: string;
  lineIndex?: number;
  linePlaybackStart?: number;
  linePlaybackEnd?: number;
  eventIndex?: number;
  lineIndexInEvent?: number;
};

export type WorkspaceEventDoc = {
  startTick: number;
  duration: number;
  interactions: WorkspaceEventDocInteractionsRow[];
  workspaceModelVersion?: number;
  sceneEvents?: SceneTimelineEvent[];
};

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Wrap legacy flat beats into one scene event (migration). */
export function migrateLegacyToSceneEvents(doc: WorkspaceEventDoc): SceneTimelineEvent[] {
  const rows = doc.interactions ?? [];
  if (rows.length === 0) {
    return [
      {
        eventId: newId("ev"),
        startTick: 0,
        duration: Math.max(100, doc.duration || 100),
        order: 0,
        interactions: [],
      },
    ];
  }

  const eventStart = doc.startTick ?? 0;
  const eventDur = doc.duration ?? 100;
  const interactions: WorkspaceInteraction[] = rows.map((row, idx) => {
    const interactionId =
      row.beatId && !row.beatId.includes(":")
        ? row.beatId
        : newId(`ik-${idx}`);
    const st = row.startTick ?? eventStart;
    const dur = row.duration ?? eventDur;
    return {
      interactionId,
      startTick: st,
      duration: dur,
      lineIndexInEvent: row.lineIndexInEvent ?? row.lineIndex,
      linePlaybackStart: row.linePlaybackStart,
      linePlaybackEnd: row.linePlaybackEnd,
      edges: [
        {
          edgeId: newId("e"),
          sourceObjectId: row.sourceObjectId,
          targetObjectId: row.targetObjectId,
          label: row.label,
          style: row.style,
          interactionMeaning: row.interactionMeaning,
        },
      ],
    };
  });

  const starts = interactions.map((i) => i.startTick);
  const ends = interactions.map((i) => i.startTick + i.duration);
  const minS = Math.min(...starts);
  const maxE = Math.max(...ends);

  return [
    {
      eventId: newId("ev"),
      startTick: minS,
      duration: Math.max(100, maxE - minS),
      order: 0,
      interactions,
    },
  ];
}

export function sceneEventsFromDoc(doc: WorkspaceEventDoc): SceneTimelineEvent[] {
  if (
    doc.workspaceModelVersion === WORKSPACE_MODEL_VERSION &&
    doc.sceneEvents &&
    doc.sceneEvents.length > 0
  ) {
    return doc.sceneEvents.map((se) => ({
      ...se,
      interactions: se.interactions.map((i) => ({
        ...i,
        edges: i.edges.map((e) => ({ ...e })),
      })),
    }));
  }
  return migrateLegacyToSceneEvents(doc);
}

export type FlatInteractionKeyframe = {
  _id: string;
  interactionId: string;
  edgeId: string;
  eventId: string;
  sourceObjectId: string;
  targetObjectId: string;
  label: string;
  style: InteractionEdge["style"];
  interactionMeaning?: string;
  startTick: number;
  duration: number;
  lineIndexInEvent?: number;
  timelineLane?: number;
};

/** Flat list for canvas (one row per edge). Timeline UI merges by interaction per object row. */
export function flattenSceneEventsToKeyframes(
  sceneEvents: SceneTimelineEvent[]
): FlatInteractionKeyframe[] {
  const out: FlatInteractionKeyframe[] = [];
  for (const ev of sceneEvents) {
    for (const inter of ev.interactions) {
      for (const edge of inter.edges) {
        out.push({
          _id: `${inter.interactionId}:${edge.edgeId}`,
          interactionId: inter.interactionId,
          edgeId: edge.edgeId,
          eventId: ev.eventId,
          sourceObjectId: edge.sourceObjectId,
          targetObjectId: edge.targetObjectId,
          label: edge.label,
          style: edge.style,
          interactionMeaning: edge.interactionMeaning,
          startTick: inter.startTick,
          duration: inter.duration,
          lineIndexInEvent: inter.lineIndexInEvent,
          timelineLane: inter.timelineLane,
        });
      }
    }
  }
  return out;
}

/** Rebuild nested tree from flat keyframes (same interactionId shares timing). */
export function keyframesToSceneEvents(
  keyframes: FlatInteractionKeyframe[],
  eventMeta: Map<string, { startTick: number; duration: number; order?: number }>
): SceneTimelineEvent[] {
  const byEvent = new Map<string, FlatInteractionKeyframe[]>();
  for (const k of keyframes) {
    const list = byEvent.get(k.eventId) ?? [];
    list.push(k);
    byEvent.set(k.eventId, list);
  }

  const eventIds = [...new Set(keyframes.map((k) => k.eventId))];
  eventIds.sort((a, b) => {
    const ma = eventMeta.get(a);
    const mb = eventMeta.get(b);
    return (ma?.startTick ?? 0) - (mb?.startTick ?? 0);
  });

  return eventIds.map((eventId) => {
    const rows = byEvent.get(eventId) ?? [];
    const meta = eventMeta.get(eventId) ?? {
      startTick: Math.min(...rows.map((r) => r.startTick), 0),
      duration: 100,
    };
    const byInter = new Map<string, FlatInteractionKeyframe[]>();
    for (const r of rows) {
      const list = byInter.get(r.interactionId) ?? [];
      list.push(r);
      byInter.set(r.interactionId, list);
    }
    const interactions: WorkspaceInteraction[] = [...byInter.entries()].map(
      ([interactionId, ks]) => {
        const k0 = ks[0];
        return {
          interactionId,
          startTick: k0.startTick,
          duration: k0.duration,
          timelineLane: k0.timelineLane,
          lineIndexInEvent: k0.lineIndexInEvent,
          edges: ks.map((k) => ({
            edgeId: k.edgeId,
            sourceObjectId: k.sourceObjectId,
            targetObjectId: k.targetObjectId,
            label: k.label,
            style: k.style,
            interactionMeaning: k.interactionMeaning,
          })),
        };
      }
    );
    return {
      eventId,
      startTick: meta.startTick,
      duration: meta.duration,
      order: meta.order,
      interactions,
    };
  });
}

/** Events in the same scene must not overlap in time (open intervals). */
export function sceneEventsOverlap(a: SceneTimelineEvent, b: SceneTimelineEvent): boolean {
  const a0 = a.startTick;
  const a1 = a.startTick + a.duration;
  const b0 = b.startTick;
  const b1 = b.startTick + b.duration;
  return a0 < b1 && b0 < a1;
}

export function assertSceneEventsOrderedNonOverlapping(
  events: SceneTimelineEvent[]
): void {
  const sorted = [...events].sort((x, y) => x.startTick - y.startTick);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (sceneEventsOverlap(prev, cur)) {
      throw new Error("Scene timeline events overlap in the same scene.");
    }
  }
}

export type ConvexInteractionMirrorRow = {
  beatId: string;
  sourceObjectId: string;
  targetObjectId: string;
  label: string;
  style: InteractionEdge["style"];
  startTick: number;
  duration: number;
  interactionMeaning?: string;
  lineIndex?: number;
  lineIndexInEvent?: number;
  eventIndex?: number;
  linePlaybackStart?: number;
  linePlaybackEnd?: number;
  timelineLane?: number;
};

/** Convex `interactions` mirror rows (legacy shape + optional indices). */
export function flattenSceneEventsToConvexInteractions(
  sceneEvents: SceneTimelineEvent[]
): ConvexInteractionMirrorRow[] {
  const out: ConvexInteractionMirrorRow[] = [];
  const eventOrder = [...sceneEvents].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.startTick - b.startTick
  );
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

export function envelopeFromSceneEvents(
  sceneEvents: SceneTimelineEvent[],
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

const MIN_EVENT_TICKS = 8;

/** Parse composite keyframe id `interactionId:edgeId`. */
export function parseKeyframeCompositeId(id: string): {
  interactionId: string;
  edgeId: string;
} | null {
  const i = id.indexOf(":");
  if (i <= 0 || i >= id.length - 1) return null;
  return { interactionId: id.slice(0, i), edgeId: id.slice(i + 1) };
}

export function pickSceneEventForTick(
  sceneEvents: SceneTimelineEvent[],
  tick: number
): SceneTimelineEvent | null {
  const sorted = [...sceneEvents].sort((a, b) => a.startTick - b.startTick);
  if (sorted.length === 0) return null;
  for (const ev of sorted) {
    if (tick >= ev.startTick && tick < ev.startTick + ev.duration) return ev;
  }
  if (tick < sorted[0].startTick) return sorted[0];
  return sorted[sorted.length - 1];
}

function shrinkWrapEvent(ev: SceneTimelineEvent): SceneTimelineEvent {
  if (ev.interactions.length === 0) {
    return {
      ...ev,
      duration: Math.max(MIN_EVENT_TICKS, ev.duration),
    };
  }
  const lo = Math.min(...ev.interactions.map((i) => i.startTick));
  const hi = Math.max(...ev.interactions.map((i) => i.startTick + i.duration));
  return {
    ...ev,
    startTick: lo,
    duration: Math.max(MIN_EVENT_TICKS, hi - lo),
  };
}

/** After local edits, resolve overlaps by pushing later events forward (preserving duration). */
export function packSceneEventsNonOverlapping(
  events: SceneTimelineEvent[]
): SceneTimelineEvent[] {
  const sorted = [...events].sort(
    (a, b) => a.startTick - b.startTick || (a.order ?? 0) - (b.order ?? 0)
  );
  let cursor = 0;
  return sorted.map((ev) => {
    const wrapped = shrinkWrapEvent(ev);
    let start = wrapped.startTick;
    if (start < cursor) {
      const delta = cursor - start;
      start = cursor;
      const shifted: SceneTimelineEvent = {
        ...wrapped,
        startTick: start,
        interactions: wrapped.interactions.map((i) => ({
          ...i,
          startTick: i.startTick + delta,
        })),
      };
      const w2 = shrinkWrapEvent(shifted);
      cursor = w2.startTick + w2.duration;
      return w2;
    }
    cursor = wrapped.startTick + wrapped.duration;
    return wrapped;
  });
}

export function updateInteractionTiming(
  sceneEvents: SceneTimelineEvent[],
  interactionId: string,
  startTick: number,
  duration: number
): SceneTimelineEvent[] {
  return packSceneEventsNonOverlapping(
    sceneEvents.map((ev) => ({
      ...ev,
      interactions: ev.interactions.map((inter) =>
        inter.interactionId === interactionId
          ? { ...inter, startTick, duration }
          : inter
      ),
    }))
  );
}

export function translateSceneEvent(
  sceneEvents: SceneTimelineEvent[],
  eventId: string,
  deltaTick: number
): SceneTimelineEvent[] {
  const next = sceneEvents.map((ev) => {
    if (ev.eventId !== eventId) return ev;
    return {
      ...ev,
      startTick: ev.startTick + deltaTick,
      interactions: ev.interactions.map((i) => ({
        ...i,
        startTick: i.startTick + deltaTick,
      })),
    };
  });
  return packSceneEventsNonOverlapping(next);
}

export function removeEdgeByCompositeId(
  sceneEvents: SceneTimelineEvent[],
  compositeId: string
): SceneTimelineEvent[] {
  const parsed = parseKeyframeCompositeId(compositeId);
  if (!parsed) return sceneEvents;
  const { interactionId, edgeId } = parsed;
  return packSceneEventsNonOverlapping(
    sceneEvents.map((ev) => ({
      ...ev,
      interactions: ev.interactions
        .map((inter) => {
          if (inter.interactionId !== interactionId) return inter;
          const edges = inter.edges.filter((e) => e.edgeId !== edgeId);
          if (edges.length === 0) return null;
          return { ...inter, edges };
        })
        .filter((x): x is WorkspaceInteraction => x !== null),
    }))
  );
}

export function appendInteractionEdge(
  sceneEvents: SceneTimelineEvent[],
  opts: {
    tick: number;
    eventIdHint?: string;
    sourceObjectId: string;
    targetObjectId: string;
    label: string;
    style: InteractionEdge["style"];
    interactionMeaning?: string;
    duration: number;
    /** When true, add edge to an interaction at `tick` if one exists. */
    mergeAtTick?: boolean;
  }
): SceneTimelineEvent[] {
  const edge: InteractionEdge = {
    edgeId: newId("e"),
    sourceObjectId: opts.sourceObjectId,
    targetObjectId: opts.targetObjectId,
    label: opts.label,
    style: opts.style,
    interactionMeaning: opts.interactionMeaning,
  };

  let events = [...sceneEvents];
  if (events.length === 0) {
    const interactionId = newId("ik");
    const eventId = newId("ev");
    const inter: WorkspaceInteraction = {
      interactionId,
      startTick: opts.tick,
      duration: opts.duration,
      edges: [edge],
    };
    return packSceneEventsNonOverlapping([
      shrinkWrapEvent({
        eventId,
        startTick: opts.tick,
        duration: Math.max(MIN_EVENT_TICKS, opts.duration),
        order: 0,
        interactions: [inter],
      }),
    ]);
  }

  let targetEv =
    (opts.eventIdHint
      ? events.find((e) => e.eventId === opts.eventIdHint)
      : null) ?? pickSceneEventForTick(events, opts.tick);

  if (!targetEv) {
    targetEv = events[events.length - 1];
  }

  if (opts.mergeAtTick) {
    const interAt = targetEv.interactions.find(
      (i) =>
        opts.tick >= i.startTick && opts.tick < i.startTick + i.duration
    );
    if (interAt) {
      return packSceneEventsNonOverlapping(
        events.map((ev) =>
          ev.eventId !== targetEv!.eventId
            ? ev
            : {
                ...ev,
                interactions: ev.interactions.map((i) =>
                  i.interactionId === interAt.interactionId
                    ? { ...i, edges: [...i.edges, edge] }
                    : i
                ),
              }
        )
      );
    }
  }

  const interactionId = newId("ik");
  const inter: WorkspaceInteraction = {
    interactionId,
    startTick: opts.tick,
    duration: opts.duration,
    edges: [edge],
  };

  return packSceneEventsNonOverlapping(
    events.map((ev) =>
      ev.eventId !== targetEv!.eventId
        ? ev
        : {
            ...ev,
            interactions: [...ev.interactions, inter],
          }
    )
  );
}

export function patchInteractionEdgeFields(
  sceneEvents: SceneTimelineEvent[],
  interactionId: string,
  pick: { label: string; interactionMeaning?: string }
): SceneTimelineEvent[] {
  return sceneEvents.map((ev) => ({
    ...ev,
    interactions: ev.interactions.map((inter) => {
      if (inter.interactionId !== interactionId) return inter;
      return {
        ...inter,
        edges: inter.edges.map((e) => ({
          ...e,
          label: pick.label,
          interactionMeaning: pick.interactionMeaning ?? e.interactionMeaning,
        })),
      };
    }),
  }));
}
