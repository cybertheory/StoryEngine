import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function hashSessionToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getViewerUserId(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string | undefined
): Promise<Id<"users"> | null> {
  if (!sessionToken?.trim()) return null;
  const tokenHash = await hashSessionToken(sessionToken.trim());
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
    .first();
  if (!session || session.expiresAt < Date.now()) return null;
  return session.userId;
}

/** Public & unlisted: visible to anyone with the slug. Private: creator only. */
export function canViewUniverse(
  u: Doc<"universes">,
  viewerUserId: Id<"users"> | null
): boolean {
  if (u.visibility === "public" || u.visibility === "unlisted") return true;
  if (u.visibility === "private") {
    return viewerUserId !== null && viewerUserId === u.creatorId;
  }
  return false;
}

/**
 * Story is readable when the parent universe is already authorized.
 * Public / unlisted: any viewer who can see the universe.
 * Private: author only.
 */
export function canViewStory(
  story: Doc<"stories">,
  viewerUserId: Id<"users"> | null
): boolean {
  if (story.visibility === "public" || story.visibility === "unlisted") {
    return true;
  }
  if (story.visibility === "private") {
    return viewerUserId !== null && viewerUserId === story.authorId;
  }
  return false;
}
