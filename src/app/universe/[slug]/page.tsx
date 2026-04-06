"use client";

import { use } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Masthead } from "@/components/layout/masthead";
import { Footer } from "@/components/layout/footer";
import { ObjectGrid } from "@/components/universe/object-grid";
import { AddUniverseObjectDialog } from "@/components/universe/add-universe-object-dialog";
import { StoryCard } from "@/components/universe/story-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Heart,
  GitFork,
  Layers,
  BookOpen,
  Plus,
  PenLine,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Id } from "@convex/_generated/dataModel";
import { useAppSession } from "@/contexts/auth-context";
import { storyReaderPath, storyWorkspacePath } from "@/lib/routes";
import { cn } from "@/lib/utils";

const KINDS = [
  { value: "all", label: "All" },
  { value: "character", label: "Characters" },
  { value: "place", label: "Places" },
  { value: "item", label: "Items" },
  { value: "faction", label: "Factions" },
  { value: "lore", label: "Lore" },
];

export default function UniverseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { token, isSignedIn, userId } = useAppSession();
  const createStory = useMutation(api.stories.create);
  const [storyStarting, setStoryStarting] = useState(false);
  const [addObjectOpen, setAddObjectOpen] = useState(false);
  const universe = useQuery(
    api.universes.getBySlug,
    token ? { slug, sessionToken: token } : { slug }
  );
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [mainTab, setMainTab] = useState("objects");
  const [storyFeedSort, setStoryFeedSort] = useState<"latest" | "popular">(
    "latest"
  );

  const objects = useQuery(
    api.objects.listByUniverse,
    universe
      ? {
          universeId: universe._id,
          ...(token ? { sessionToken: token } : {}),
        }
      : "skip"
  );

  const stories = useQuery(
    api.stories.listByUniverse,
    universe
      ? {
          universeId: universe._id as Id<"universes">,
          ...(token ? { sessionToken: token } : {}),
        }
      : "skip"
  );

  const featuredStories = useMemo(() => {
    if (!stories?.length) return [];
    return [...stories]
      .sort(
        (a, b) =>
          b.likeCount - a.likeCount ||
          b.updatedAt - a.updatedAt
      )
      .slice(0, 4);
  }, [stories]);

  const storyFeed = useMemo(() => {
    if (!stories?.length) return [];
    const copy = [...stories];
    if (storyFeedSort === "latest") {
      copy.sort((a, b) => b.updatedAt - a.updatedAt);
    } else {
      copy.sort(
        (a, b) =>
          b.likeCount - a.likeCount ||
          b.updatedAt - a.updatedAt
      );
    }
    return copy;
  }, [stories, storyFeedSort]);

  const signInForStoryHref = `/sign-in?redirect=${encodeURIComponent(`/universe/${encodeURIComponent(slug)}`)}`;

  const forkUniverseFlowHref = useMemo(() => {
    const target = `/create/universe?fork=${encodeURIComponent(slug)}`;
    return token
      ? target
      : `/sign-in?redirect=${encodeURIComponent(target)}`;
  }, [slug, token]);

  const isUniverseOwner = useMemo(
    () =>
      Boolean(
        userId &&
          universe &&
          String(userId) === String(universe.creatorId)
      ),
    [userId, universe]
  );

  const openNewStoryWorkbench = useCallback(async () => {
    if (!universe || !token) return;
    setStoryStarting(true);
    try {
      const id = await createStory({
        sessionToken: token,
        universeId: universe._id,
        title: "Untitled story",
        visibility: "unlisted",
      });
      router.push(storyWorkspacePath(id));
    } catch (err) {
      console.error("Failed to create story:", err);
    } finally {
      setStoryStarting(false);
    }
  }, [createStory, router, token, universe]);

  if (universe === undefined) {
    return (
      <>
        <Masthead />
        <main className="flex-1 max-w-7xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-64 w-full mb-4" />
          <Skeleton className="h-40 w-full" />
        </main>
        <Footer />
      </>
    );
  }

  if (!universe) {
    return (
      <>
        <Masthead />
        <main className="flex-1 max-w-7xl mx-auto px-4 py-20 text-center">
          <p className="font-display text-2xl font-bold mb-2">
            Universe not found
          </p>
          <p className="text-muted-foreground font-body mb-4 max-w-md mx-auto leading-relaxed">
            This slug may not exist, or the universe may be private. If it’s
            yours, sign in and open it again from your profile.
          </p>
          <Link href="/">
            <Button variant="outline" className="font-mono-face text-xs">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Masthead />
      <main className="flex-1">
        {/* Header */}
        <div className="border-b border-foreground/10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-mono-face"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <div className="flex items-center gap-2">
              {isSignedIn ? (
                <Link
                  href={`/create/universe?fork=${encodeURIComponent(slug)}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "font-mono-face text-xs gap-1.5 no-underline"
                  )}
                >
                  <GitFork className="h-3 w-3" />
                  Fork
                </Link>
              ) : (
                <Link
                  href={`/sign-in?redirect=${encodeURIComponent(`/create/universe?fork=${encodeURIComponent(slug)}`)}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "font-mono-face text-xs gap-1.5 no-underline"
                  )}
                >
                  <GitFork className="h-3 w-3" />
                  Fork
                </Link>
              )}
              <Button
                variant="outline"
                size="sm"
                className="font-mono-face text-xs gap-1.5"
              >
                <Heart className="h-3 w-3" />
                {universe.likeCount}
              </Button>
            </div>
          </div>
        </div>

        {/* Cover + Info */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="md:w-80 shrink-0">
              {universe.coverUrl ? (
                <img
                  src={universe.coverUrl}
                  alt={universe.name}
                  className="w-full aspect-[3/4] object-cover border border-foreground/20"
                />
              ) : (
                <div className="w-full aspect-[3/4] bg-muted border border-foreground/20 flex items-center justify-center">
                  <span className="font-display text-4xl font-bold text-muted-foreground/30">
                    {universe.name[0]}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-mono-face tracking-wider uppercase text-muted-foreground/80 mb-1">
                Catalog / Universe
              </p>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <p className="section-label mb-0">Universe</p>
                {universe.visibility !== "public" && (
                  <Badge variant="outline" className="font-mono-face text-[10px] uppercase">
                    {universe.visibility === "private" ? "Private" : "Unlisted"}
                  </Badge>
                )}
              </div>
              <h1 className="font-display text-4xl font-black tracking-tight mb-4">
                {universe.name}
              </h1>
              <p className="text-base font-body leading-relaxed text-muted-foreground mb-6 max-w-xl">
                {universe.description}
              </p>
              <div className="flex items-center gap-4 mb-4 text-xs font-mono-face text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  {universe.objectCount} objects
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  {universe.storyCount} stories
                </span>
                <span className="flex items-center gap-1">
                  <GitFork className="h-3 w-3" />
                  {universe.forkCount} forks
                </span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {universe.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="font-mono-face text-[10px] tracking-wider uppercase"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {isSignedIn && token ? (
                  <>
                    {isUniverseOwner ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="font-mono-face text-xs tracking-wider uppercase gap-1.5"
                        onClick={() => setAddObjectOpen(true)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add object
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      className="font-mono-face text-xs tracking-wider uppercase gap-1.5"
                      disabled={storyStarting}
                      onClick={() => void openNewStoryWorkbench()}
                    >
                      <PenLine className="h-3.5 w-3.5" />
                      {storyStarting ? "Opening…" : "Tell a story"}
                    </Button>
                  </>
                ) : (
                  <Link
                    href={signInForStoryHref}
                    className={cn(
                      buttonVariants(),
                      "font-mono-face text-xs tracking-wider uppercase gap-1.5 no-underline"
                    )}
                  >
                    <PenLine className="h-3.5 w-3.5" />
                    Tell a story
                  </Link>
                )}
              </div>
            </div>
          </div>

          {featuredStories.length > 0 && (
            <div className="mt-10 pt-8 border-t border-foreground/10">
              <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                <div>
                  <p className="section-label mb-1">Stories in this universe</p>
                  <p className="text-xs text-muted-foreground font-body max-w-lg">
                    Narratives built from this world. Open a story to read,
                    share, or jump into the workspace if you&apos;re the author.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMainTab("stories")}
                  className="text-[10px] font-mono-face tracking-wider uppercase text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  Browse all stories
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {featuredStories.map((story) => (
                  <StoryCard
                    key={story._id}
                    title={story.title}
                    description={story.description}
                    likeCount={story.likeCount}
                    coverUrl={story.coverUrl}
                    visibility={story.visibility}
                    href={storyReaderPath(slug, story._id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="max-w-7xl mx-auto px-4">
          <Separator className="bg-foreground/10" />
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Tabs value={mainTab} onValueChange={setMainTab}>
            <TabsList className="bg-transparent border-b border-foreground/10 w-full justify-start gap-0 p-0 h-auto">
              <TabsTrigger
                value="objects"
                className="font-mono-face text-xs tracking-wider uppercase px-4 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:shadow-none rounded-none bg-transparent"
              >
                Objects
              </TabsTrigger>
              <TabsTrigger
                value="stories"
                className="font-mono-face text-xs tracking-wider uppercase px-4 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:shadow-none rounded-none bg-transparent"
              >
                Stories
              </TabsTrigger>
              <TabsTrigger
                value="lore"
                className="font-mono-face text-xs tracking-wider uppercase px-4 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:shadow-none rounded-none bg-transparent"
              >
                Lore
              </TabsTrigger>
            </TabsList>

            <TabsContent value="objects" className="pt-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  {KINDS.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => setKindFilter(k.value)}
                      className={`text-[10px] font-mono-face tracking-wider uppercase px-2.5 py-1 border transition-colors ${
                        kindFilter === k.value
                          ? "bg-foreground text-background border-foreground"
                          : "border-foreground/20 text-muted-foreground hover:border-foreground/50"
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
                {isUniverseOwner && token ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="font-mono-face text-[10px] tracking-wider uppercase gap-1 shrink-0"
                    onClick={() => setAddObjectOpen(true)}
                  >
                    <Plus className="h-3 w-3" />
                    Add object
                  </Button>
                ) : null}
              </div>
              {objects ? (
                <ObjectGrid
                  universeSlug={slug}
                  objects={objects.map((o) => ({
                    _id: o._id,
                    name: o.name,
                    kind: o.kind,
                    description: o.description,
                    imageUrl: o.imageUrl,
                    tags: o.tags,
                  }))}
                  kindFilter={kindFilter === "all" ? undefined : kindFilter}
                  emptyHint={
                    !isUniverseOwner ? (
                      <p className="mx-auto max-w-md text-xs">
                        <Link
                          href={forkUniverseFlowHref}
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          Fork this universe
                        </Link>{" "}
                        to add your own objects and stories.
                      </p>
                    ) : undefined
                  }
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="stories" className="pt-4">
              <div className="mb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <p className="section-label mb-1">Story feed</p>
                  <p className="text-xs text-muted-foreground font-body max-w-xl">
                    Every narrative set in this world. Open one to read; if you
                    wrote it, use the reader to reach the workspace.
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setStoryFeedSort("latest")}
                    className={`text-[10px] font-mono-face tracking-wider uppercase px-2.5 py-1 border transition-colors ${
                      storyFeedSort === "latest"
                        ? "bg-foreground text-background border-foreground"
                        : "border-foreground/20 text-muted-foreground hover:border-foreground/50"
                    }`}
                  >
                    Latest
                  </button>
                  <button
                    type="button"
                    onClick={() => setStoryFeedSort("popular")}
                    className={`text-[10px] font-mono-face tracking-wider uppercase px-2.5 py-1 border transition-colors ${
                      storyFeedSort === "popular"
                        ? "bg-foreground text-background border-foreground"
                        : "border-foreground/20 text-muted-foreground hover:border-foreground/50"
                    }`}
                  >
                    Popular
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {stories && stories.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {storyFeed.map((story) => (
                      <StoryCard
                        key={story._id}
                        title={story.title}
                        description={story.description}
                        likeCount={story.likeCount}
                        coverUrl={story.coverUrl}
                        visibility={story.visibility}
                        href={storyReaderPath(slug, story._id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <p className="text-muted-foreground font-body mb-4">
                      No stories written in this universe yet.
                    </p>
                    {isSignedIn && token ? (
                      <Button
                        type="button"
                        className="font-mono-face text-xs tracking-wider uppercase gap-1.5"
                        disabled={storyStarting}
                        onClick={() => void openNewStoryWorkbench()}
                      >
                        <Plus className="h-3 w-3" />
                        {storyStarting ? "Opening…" : "Write a story"}
                      </Button>
                    ) : (
                      <Link
                        href={signInForStoryHref}
                        className={cn(
                          buttonVariants(),
                          "font-mono-face text-xs tracking-wider uppercase gap-1.5 no-underline"
                        )}
                      >
                        <Plus className="h-3 w-3" />
                        Write a story
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="lore" className="pt-4">
              {objects ? (
                <ObjectGrid
                  universeSlug={slug}
                  objects={objects
                    .filter((o) => o.kind === "lore")
                    .map((o) => ({
                      _id: o._id,
                      name: o.name,
                      kind: o.kind,
                      description: o.description,
                      imageUrl: o.imageUrl,
                      tags: o.tags,
                    }))}
                  emptyHint={
                    !isUniverseOwner ? (
                      <p className="mx-auto max-w-md text-xs">
                        <Link
                          href={forkUniverseFlowHref}
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          Fork this universe
                        </Link>{" "}
                        to add lore entries to your own copy.
                      </p>
                    ) : undefined
                  }
                />
              ) : (
                <Skeleton className="h-40" />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />

      {token && isUniverseOwner && universe ? (
        <AddUniverseObjectDialog
          open={addObjectOpen}
          onOpenChange={setAddObjectOpen}
          sessionToken={token}
          universeId={universe._id}
        />
      ) : null}
    </>
  );
}
