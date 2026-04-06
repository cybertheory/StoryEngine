/** Defaults kept in sync with `convex/stories.ts` (CHAPTER_SCENE_*). */
export const CHAPTER_SCENE_DEFAULT_DURATION = 24;
export const CHAPTER_SCENE_GAP = 4;

export type ChapterSceneTimelineInput = {
  order: number;
  chapterTimelineStart?: number;
  chapterTimelineDuration?: number;
};

/** Scene row for the workspace timeline (chapter schedule). */
export type ChapterSceneTimelineRow = {
  _id: string;
  title: string;
  order: number;
  chapterTimelineStart?: number;
  chapterTimelineDuration?: number;
};

export function layoutChapterSceneTimelines<T extends ChapterSceneTimelineInput>(
  scenes: T[]
): { scene: T; start: number; duration: number }[] {
  const sorted = [...scenes].sort((a, b) => a.order - b.order);
  let cursor = 0;
  const out: { scene: T; start: number; duration: number }[] = [];
  for (const s of sorted) {
    const st = s.chapterTimelineStart;
    const dur = s.chapterTimelineDuration;
    if (st !== undefined && dur !== undefined) {
      out.push({ scene: s, start: st, duration: dur });
      cursor = Math.max(cursor, st + dur + CHAPTER_SCENE_GAP);
    } else {
      out.push({
        scene: s,
        start: cursor,
        duration: CHAPTER_SCENE_DEFAULT_DURATION,
      });
      cursor += CHAPTER_SCENE_DEFAULT_DURATION + CHAPTER_SCENE_GAP;
    }
  }
  return out;
}
