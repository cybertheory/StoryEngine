/** Canonical URL for an object preview (shareable, deep-linkable). */
export function objectPreviewPath(
  universeSlug: string,
  objectId: string
): string {
  return `/universe/${encodeURIComponent(universeSlug)}/object/${objectId}`;
}

/** Canonical URL for reading a story (universe → story hierarchy). */
export function storyReaderPath(
  universeSlug: string,
  storyId: string
): string {
  return `/universe/${encodeURIComponent(universeSlug)}/story/${storyId}`;
}

/** Workspace / editor URL (not nested under universe slug). */
export function storyWorkspacePath(storyId: string): string {
  return `/story/${storyId}/edit`;
}
