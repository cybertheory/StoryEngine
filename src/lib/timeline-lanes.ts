/**
 * Vertical stacking for interaction clips on the same object row when beats overlap in time.
 */

export type LaneKeyframe = {
  _id: string;
  startTick: number;
  duration: number;
  sourceObjectId: string;
  targetObjectId: string;
  /** Persisted lane from workspace (optional). */
  timelineLane?: number;
};

const mapKey = (objectId: string, keyframeId: string) => `${objectId}\t${keyframeId}`;

function assignClipToLane(
  c: { start: number; end: number; pref?: number },
  laneEnd: number[]
): number {
  const p = c.pref;
  if (typeof p === "number" && p >= 0 && Number.isFinite(p)) {
    while (laneEnd.length <= p) laneEnd.push(-Infinity);
    if (laneEnd[p]! <= c.start) {
      laneEnd[p] = c.end;
      return p;
    }
  }
  let lane = 0;
  while (lane < laneEnd.length && laneEnd[lane]! > c.start) {
    lane++;
  }
  if (lane === laneEnd.length) laneEnd.push(c.end);
  else laneEnd[lane] = c.end;
  return lane;
}

/**
 * For each object row, assigns lane indices so overlapping intervals don't share a lane.
 */
export function computeLanesByObjectAndKeyframe(
  keyframes: LaneKeyframe[],
  trackObjectIds: string[]
): Map<string, number> {
  const out = new Map<string, number>();

  for (const oid of trackObjectIds) {
    const clips = keyframes
      .filter(
        (k) => k.sourceObjectId === oid || k.targetObjectId === oid
      )
      .map((k) => ({
        kid: k._id,
        start: k.startTick,
        end: k.startTick + k.duration,
        pref: k.timelineLane,
      }))
      .sort((a, b) => a.start - b.start || a.end - b.end);

    const laneEnd: number[] = [];
    for (const c of clips) {
      const lane = assignClipToLane(
        { start: c.start, end: c.end, pref: c.pref },
        laneEnd
      );
      out.set(mapKey(oid, c.kid), lane);
    }
  }

  return out;
}

/** Number of stacked lanes needed on this object row (minimum row height). */
export function laneDepthForObject(
  laneMap: Map<string, number>,
  objectId: string
): number {
  const prefix = `${objectId}\t`;
  let max = 0;
  for (const [k, lane] of laneMap) {
    if (k.startsWith(prefix)) max = Math.max(max, lane + 1);
  }
  return Math.max(1, max);
}
