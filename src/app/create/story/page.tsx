"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Masthead } from "@/components/layout/masthead";
import { Footer } from "@/components/layout/footer";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppSession } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { storyWorkspacePath } from "@/lib/routes";

const SIGN_IN_WITH_RETURN = `/sign-in?redirect=${encodeURIComponent("/create/story")}`;

export default function CreateStoryPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, token, userId } = useAppSession();
  const createStory = useMutation(api.stories.create);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const useSearchMode = debouncedSearch.length > 0;

  const pickerList = useQuery(
    api.universes.listForStoryPicker,
    isSignedIn && token && !useSearchMode ? { sessionToken: token } : "skip"
  );

  const searchResults = useQuery(
    api.universes.searchForStoryPicker,
    isSignedIn && token && useSearchMode
      ? { sessionToken: token, query: debouncedSearch }
      : "skip"
  );

  const universes = useMemo(() => {
    if (useSearchMode) {
      return searchResults ?? [];
    }
    return pickerList ?? [];
  }, [useSearchMode, searchResults, pickerList]);

  const loadingUniverses =
    isSignedIn &&
    token &&
    (useSearchMode ? searchResults === undefined : pickerList === undefined);

  const [pendingUniverseId, setPendingUniverseId] =
    useState<Id<"universes"> | null>(null);

  async function startInUniverse(universeId: Id<"universes">) {
    if (!token) return;
    setPendingUniverseId(universeId);
    try {
      const id = await createStory({
        sessionToken: token,
        universeId,
        title: "Untitled story",
        visibility: "unlisted",
      });
      router.push(storyWorkspacePath(id));
    } catch (err) {
      console.error("Failed to create story:", err);
    } finally {
      setPendingUniverseId(null);
    }
  }

  return (
    <>
      <Masthead />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-mono-face mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="newspaper-rule-thick mb-6" />
        <h1 className="font-display text-3xl font-black tracking-tight mb-2">
          New story
        </h1>
        <p className="text-sm text-muted-foreground font-body mb-6">
          Choose any public universe or one of your own (including private).
          You&apos;ll open the multi-pane workspace to compose scenes, timeline,
          and prose.
        </p>

        {isLoaded && !isSignedIn && (
          <div className="mb-8 border border-foreground/25 bg-muted/30 px-4 py-4 sm:px-5 sm:py-5">
            <p className="text-sm font-body text-muted-foreground mb-3">
              Sign in to create a story in a universe.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={SIGN_IN_WITH_RETURN} className={cn(buttonVariants())}>
                Sign in
              </Link>
              <Link
                href={`/sign-up?redirect=${encodeURIComponent("/create/story")}`}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Create account
              </Link>
            </div>
          </div>
        )}

        {isSignedIn && token && (
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search universes by name…"
              className="pl-9 font-mono-face text-xs border-foreground/30"
              aria-label="Search universes"
            />
          </div>
        )}

        {isSignedIn && token && loadingUniverses && (
          <p className="text-sm text-muted-foreground font-mono-face">
            Loading universes…
          </p>
        )}

        {isSignedIn && token && !loadingUniverses && universes.length === 0 && (
          <div className="border border-foreground/20 p-6 text-center">
            <p className="text-sm text-muted-foreground font-body mb-2">
              {useSearchMode
                ? "No universes match that search."
                : "No universes available yet."}
            </p>
            {!useSearchMode && (
              <Link href="/create/universe" className={cn(buttonVariants())}>
                Create universe
              </Link>
            )}
          </div>
        )}

        {isSignedIn && token && !loadingUniverses && universes.length > 0 && (
          <ul className="space-y-2">
            {universes.map((u) => {
              const isYours = userId && u.creatorId === userId;
              return (
                <li key={u._id}>
                  <Button
                    variant="outline"
                    className="w-full justify-between font-mono-face text-xs tracking-wider uppercase h-auto min-h-10 py-2.5 px-4 gap-3"
                    disabled={pendingUniverseId !== null}
                    onClick={() => void startInUniverse(u._id)}
                  >
                    <span className="flex items-center gap-2 min-w-0 text-left">
                      <span className="font-display text-sm font-bold tracking-tight normal-case truncate">
                        {u.name}
                      </span>
                      {isYours && (
                        <Badge
                          variant="secondary"
                          className="shrink-0 font-mono-face text-[9px] uppercase"
                        >
                          Yours
                        </Badge>
                      )}
                      {u.visibility !== "public" && (
                        <Badge
                          variant="outline"
                          className="shrink-0 font-mono-face text-[9px] uppercase"
                        >
                          {u.visibility === "private" ? "Private" : "Unlisted"}
                        </Badge>
                      )}
                    </span>
                    {pendingUniverseId === u._id ? (
                      <span className="text-muted-foreground shrink-0">
                        Opening…
                      </span>
                    ) : (
                      <span className="text-muted-foreground shrink-0">
                        Workspace
                      </span>
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <Separator className="bg-foreground/10 my-10" />
        <p className="text-[10px] font-mono-face text-muted-foreground tracking-wider uppercase">
          Tip: From any universe page use &ldquo;Tell a story&rdquo; to start in
          that world without searching here.
        </p>
      </main>
      <Footer />
    </>
  );
}
