import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import bcrypt from "bcryptjs";
import type { Id } from "./_generated/dataModel";
import { hashSessionToken, getViewerUserId } from "./lib/access";

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export type PublicUser = {
  _id: Id<"users">;
  clerkId: string;
  email?: string;
  name: string;
  username?: string;
  avatar?: string;
  bio?: string;
  createdAt: number;
};

async function toPublicUser(ctx: { db: { get: (id: Id<"users">) => Promise<unknown> } }, userId: Id<"users">): Promise<PublicUser | null> {
  const row = await ctx.db.get(userId);
  if (!row) return null;
  const u = row as PublicUser & { passwordHash?: string };
  return {
    _id: u._id,
    clerkId: u.clerkId,
    email: u.email,
    name: u.name,
    username: u.username,
    avatar: u.avatar,
    bio: u.bio,
    createdAt: u.createdAt,
  };
}

export const getSessionUser = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const userId = await getViewerUserId(ctx, token);
    if (!userId) return null;
    return toPublicUser(ctx, userId);
  },
});

export const register = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (email.length < 5 || !email.includes("@")) {
      throw new Error("Enter a valid email address.");
    }
    if (args.password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    const name = args.name.trim();
    if (name.length < 1) throw new Error("Name is required.");

    const taken = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (taken) throw new Error("That email is already registered.");

    const clerkId = `local:${email}`;
    const dupClerk = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();
    if (dupClerk) throw new Error("Account already exists.");

    const passwordHash = bcrypt.hashSync(args.password, 12);
    const now = Date.now();
    const baseUsername =
      email
        .split("@")[0]
        ?.replace(/[^a-z0-9_]/gi, "")
        .slice(0, 24) || "user";
    const userId = await ctx.db.insert("users", {
      clerkId,
      email,
      passwordHash,
      name,
      username: baseUsername,
      createdAt: now,
    });

    const rawToken = crypto.randomUUID();
    const tokenHash = await hashSessionToken(rawToken);
    await ctx.db.insert("sessions", {
      userId,
      tokenHash,
      expiresAt: now + SESSION_MS,
      createdAt: now,
    });

    return { token: rawToken, userId };
  },
});

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!user?.passwordHash) {
      throw new Error("Invalid email or password.");
    }
    const ok = bcrypt.compareSync(args.password, user.passwordHash);
    if (!ok) throw new Error("Invalid email or password.");

    const rawToken = crypto.randomUUID();
    const tokenHash = await hashSessionToken(rawToken);
    const now = Date.now();
    await ctx.db.insert("sessions", {
      userId: user._id,
      tokenHash,
      expiresAt: now + SESSION_MS,
      createdAt: now,
    });

    return { token: rawToken };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const tokenHash = await hashSessionToken(token.trim());
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (session) await ctx.db.delete(session._id);
  },
});
