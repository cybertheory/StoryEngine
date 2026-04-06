import { STORYOBJECT_SCENE_ANCHOR_TAG } from "@/lib/scene-anchor-constants";

export { STORYOBJECT_SCENE_ANCHOR_TAG } from "@/lib/scene-anchor-constants";

export function isStoryobjectSceneAnchor(o: { tags?: string[] }): boolean {
  return o.tags?.includes(STORYOBJECT_SCENE_ANCHOR_TAG) ?? false;
}
