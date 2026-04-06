/** Display `1: Title` with a fallback if the stored title is empty. */
export function numberedChapterLabel(index1: number, storedTitle: string): string {
  const t = storedTitle.trim();
  const fallback = `Chapter ${index1}`;
  return `${index1}: ${t || fallback}`;
}

export function numberedSceneLabel(index1: number, storedTitle: string): string {
  const t = storedTitle.trim();
  const fallback = `Scene ${index1}`;
  return `${index1}: ${t || fallback}`;
}
