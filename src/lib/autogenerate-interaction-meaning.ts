export type InteractionMeaningContext = {
  universeName: string;
  storyTitle: string;
  sceneTitle?: string;
  /** Names of objects currently on the canvas (placed). */
  onCanvasNames: string[];
  interactionLabel: string;
};

/**
 * Heuristic “AI-style” copy for what a custom interaction means in this scene.
 * No external API — reads scene + label and expands into author-facing guidance.
 */
export async function autogenerateInteractionMeaning(
  ctx: InteractionMeaningContext
): Promise<string> {
  await new Promise((r) => setTimeout(r, 450));

  const roster =
    ctx.onCanvasNames.length > 0
      ? ctx.onCanvasNames.slice(0, 10).join(", ")
      : "the characters in frame";

  const sceneBit = ctx.sceneTitle
    ? ` In “${ctx.sceneTitle}”,`
    : " In this scene,";

  const label = ctx.interactionLabel.trim() || "this beat";

  return (
    `${sceneBit} “${label}” marks a moment where relationship and stakes shift between ${roster}. ` +
    `In «${ctx.storyTitle}» (${ctx.universeName}), use this beat when you want the reader to feel that subtext — ` +
    `not just see motion — so the choice of “${label}” signals intent: trust, danger, desire, or fracture. ` +
    `Keep the prose tight; let dialogue and blocking carry the rest.`
  );
}
