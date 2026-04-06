/**
 * Restrict redirects after sign-in to same-origin paths (no protocol-relative or external URLs).
 */
export function safeRedirectPath(raw: string | null): string {
  if (!raw || typeof raw !== "string") return "/";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";
  return trimmed;
}
