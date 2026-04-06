"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

const STORAGE_KEY = "storyobject_session_token";

export type SessionUser = {
  _id: Id<"users">;
  clerkId: string;
  email?: string;
  name: string;
  username?: string;
  avatar?: string;
  bio?: string;
  createdAt: number;
};

type AuthContextValue = {
  token: string | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  user: SessionUser | null | undefined;
  userId: Id<"users"> | null;
  setSessionToken: (token: string | null) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const logoutMutation = useMutation(api.auth.logout);

  useEffect(() => {
    try {
      setTokenState(localStorage.getItem(STORAGE_KEY));
    } catch {
      setTokenState(null);
    }
    setStorageReady(true);
  }, []);

  const user = useQuery(
    api.auth.getSessionUser,
    storageReady && token ? { token } : "skip"
  );

  const setSessionToken = useCallback((next: string | null) => {
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setTokenState(next);
  }, []);

  const signOut = useCallback(async () => {
    const t = token;
    if (t) {
      try {
        await logoutMutation({ token: t });
      } catch {
        /* still clear client */
      }
    }
    setSessionToken(null);
  }, [token, logoutMutation, setSessionToken]);

  const isLoaded =
    storageReady && (token === null || user !== undefined);

  const isSignedIn = Boolean(token && user);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      isLoaded,
      isSignedIn,
      user: user === undefined ? undefined : user,
      userId: user?._id ?? null,
      setSessionToken,
      signOut,
    }),
    [token, isLoaded, isSignedIn, user, setSessionToken, signOut]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAppSession() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAppSession must be used within AuthProvider");
  }
  return ctx;
}

/** Optional session token for Convex queries (visibility / access control). */
export function useOptionalSessionToken(): string | undefined {
  const { token } = useAppSession();
  return token ?? undefined;
}
