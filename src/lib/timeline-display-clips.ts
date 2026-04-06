/**
 * One timeline block per workspace interaction per object row (not per edge).
 * Labels list every verb on edges that touch that row for that interaction.
 */

export type KeyframeLikeForTimelineMerge = {
  _id: string;
  interactionId: string;
  sourceObjectId: string;
  targetObjectId: string;
  label: string;
  style: string;
  startTick: number;
  duration: number;
  timelineLane?: number;
};

export type ObjectRowTimelineClip = {
  rowObjectId: string;
  /** Stable React key + lane map id */
  clipId: string;
  interactionId: string;
  /** Any `interactionId:edgeId` — updateInteractionTiming only needs interactionId */
  updateKeyframeId: string;
  label: string;
  style: string;
  startTick: number;
  duration: number;
  timelineLane?: number;
};

/**
 * For each object that appears on an edge of an interaction, emit one clip with
 * comma-separated verbs for all edges of that interaction that involve the object.
 */
export function buildTimelineObjectRowClips(
  keyframes: ReadonlyArray<KeyframeLikeForTimelineMerge>
): ObjectRowTimelineClip[] {
  const groups = new Map<string, KeyframeLikeForTimelineMerge[]>();
  for (const k of keyframes) {
    const rows = new Set<string>();
    rows.add(k.sourceObjectId);
    rows.add(k.targetObjectId);
    for (const rowId of rows) {
      const gkey = `${rowId}\t${k.interactionId}`;
      const list = groups.get(gkey) ?? [];
      list.push(k);
      groups.set(gkey, list);
    }
  }

  const out: ObjectRowTimelineClip[] = [];
  for (const [gkey, list] of groups) {
    const tab = gkey.indexOf("\t");
    const rowObjectId = gkey.slice(0, tab);
    const interactionId = gkey.slice(tab + 1);
    const k0 = list[0]!;
    const labels = [...new Set(list.map((x) => x.label))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
    out.push({
      rowObjectId,
      clipId: `${interactionId}::${rowObjectId}`,
      interactionId,
      updateKeyframeId: k0._id,
      label: labels.join(", "),
      style: k0.style,
      startTick: k0.startTick,
      duration: k0.duration,
      timelineLane: k0.timelineLane,
    });
  }

  out.sort(
    (a, b) =>
      a.startTick - b.startTick ||
      a.rowObjectId.localeCompare(b.rowObjectId) ||
      a.interactionId.localeCompare(b.interactionId)
  );
  return out;
}

/** Synthetic keyframes for overlap lane assignment (one logical clip per row). */
export function objectRowClipsToLaneKeyframes(
  clips: ObjectRowTimelineClip[]
): {
  _id: string;
  startTick: number;
  duration: number;
  sourceObjectId: string;
  targetObjectId: string;
  timelineLane?: number;
}[] {
  return clips.map((c) => ({
    _id: c.clipId,
    startTick: c.startTick,
    duration: c.duration,
    sourceObjectId: c.rowObjectId,
    targetObjectId: c.rowObjectId,
    timelineLane: c.timelineLane,
  }));
}
