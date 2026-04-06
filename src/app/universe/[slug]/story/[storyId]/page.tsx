"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Masthead } from "@/components/layout/masthead";
import { Footer } from "@/components/layout/footer";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Heart,
  Pencil,
  BookOpen,
  Share2,
  Copy,
  Check,
} from "lucide-react";
import { useAppSession } from "@/contexts/auth-context";
import { storyReaderPath, storyWorkspacePath } from "@/lib/routes";

export default function StoryReaderPage({
  params,
}: {
  params: Promise<{ slug: string; storyId: string }>;
}) {
  const { slug, storyId: storyIdParam } = use(params);
  const storyId = storyIdParam as Id<"stories">;
  const { token, userId } = useAppSession();
  const [copied, setCopied] = useState(false);

  const bundle = useQuery(
    api.stories.getReaderInUniverse,
    {
      universeSlug: slug,
      storyId,
      ...(token ? { sessionToken: token } : {}),
    }
  );

  const author = useQuery(
    api.users.getById,
    bundle ? { id: bundle.story.authorId } : "skip"
  );

  const liked = useQuery(
    api.likes.isLiked,
    userId && bundle
      ? {
          userId,
          targetType: "story" as const,
          targetId: bundle.story._id,
        }
      : "skip"
  );

  const toggleLike = useMutation(api.likes.toggle);

  const shareUrl =
    typeof window !== "undefined" && bundle
      ? `${window.location.origin}${storyReaderPath(bundle.universe.slug, bundle.story._id)}`
      : "";

  const copyShare = useCallback(async () => {
    if (!shareUrl || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [shareUrl]);

  useEffect(() => {
    if (bundle?.story.title) {
      document.title = `${bundle.story.title} · ${bundle.universe.name} · StoryObject`;
    }
  }, [bundle]);

  if (bundle === undefined) {
    return (
      <>
        <Masthead />
        <main className="flex-1 max-w-3xl mx-auto px-4 py-12">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-48 mb-8" />
          <Skeleton className="h-96 w-full" />
        </main>
        <Footer />
      </>
    );
  }

  if (!bundle) {
    return (
      <>
        <Masthead />
        <main className="flex-1 max-w-3xl mx-auto px-4 py-20 text-center">
          <p className="font-display text-2xl font-bold mb-2">
            Story not found
          </p>
          <p className="text-muted-foreground font-body mb-6 max-w-md mx-auto leading-relaxed">
            This link may be wrong, or the story may be private. Sign in if you
            wrote it.
          </p>
          <Link
            href={`/universe/${encodeURIComponent(slug)}`}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "font-mono-face text-xs inline-flex items-center no-underline"
            )}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to universe
          </Link>
        </main>
        <Footer />
      </>
    );
  }

  const { story, universe, chapters } = bundle;
  const isAuthor = userId !== null && userId === story.authorId;

  return (
    <>
      <Masthead />
      <main className="flex-1">
        <div className="border-b border-foreground/10">
          <div className="max-w-3xl mx-auto px-4 py-4 flex flex-wrap items-center gap-3">
            <Link
              href={`/universe/${encodeURIComponent(universe.slug)}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-mono-face"
            >
              <ArrowLeft className="h-4 w-4" />
              {universe.name}
            </Link>
            <span className="text-muted-foreground/40 hidden sm:inline">/</span>
            <span className="text-sm font-body text-muted-foreground truncate max-w-[min(60vw,280px)]">
              {story.title}
            </span>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div className="flex flex-wrap gap-2">
              {story.visibility !== "public" && (
                <Badge
                  variant="outline"
                  className="font-mono-face text-[10px] uppercase"
                >
                  {story.visibility === "private" ? "Private" : "Unlisted"}
                </Badge>
              )}
              <Badge
                variant="outline"
                className="font-mono-face text-[10px] tracking-wider uppercase"
              >
                Story
              </Badge>
              <Link
                href={`/universe/${encodeURIComponent(universe.slug)}`}
                className="inline-flex items-center gap-1 text-[10px] font-mono-face tracking-wider uppercase text-muted-foreground hover:text-foreground"
              >
                <BookOpen className="h-3 w-3" />
                {universe.name}
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="font-mono-face text-xs gap-1.5"
                onClick={() => void copyShare()}
                disabled={!shareUrl}
              >
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="font-mono-face text-xs gap-1.5"
                onClick={() => {
                  if (!shareUrl) return;
                  const text = encodeURIComponent(story.title);
                  const url = encodeURIComponent(shareUrl);
                  window.open(
                    `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
                    "_blank",
                    "noopener,noreferrer"
                  );
                }}
                disabled={!shareUrl}
              >
                <Share2 className="h-3 w-3" />
                Share
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "font-mono-face text-xs gap-1.5",
                  liked && "border-foreground"
                )}
                disabled={!userId}
                title={!userId ? "Sign in to like" : undefined}
                onClick={() => {
                  if (!userId) return;
                  void toggleLike({
                    userId,
                    targetType: "story",
                    targetId: story._id,
                  });
                }}
              >
                <Heart
                  className={cn("h-3 w-3", liked && "fill-current")}
                />
                {story.likeCount}
              </Button>
              {isAuthor && (
                <Link href={storyWorkspacePath(story._id)}>
                  <Button
                    variant="default"
                    size="sm"
                    className="font-mono-face text-xs gap-1.5"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <div className="newspaper-rule-thick mb-6" />
          <h1 className="font-display text-4xl md:text-5xl font-black tracking-tight leading-[0.95] mb-4">
            {story.title}
          </h1>
          {story.description && (
            <p className="text-lg font-body text-muted-foreground leading-relaxed mb-4">
              {story.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono-face text-muted-foreground mb-6">
            <span>By {author?.name ?? "Unknown"}</span>
            <span>&middot;</span>
            <span>
              <Link
                href={`/universe/${encodeURIComponent(universe.slug)}`}
                className="hover:underline"
              >
                {universe.name}
              </Link>
            </span>
            <span>&middot;</span>
            <span>{chapters.length} chapters</span>
          </div>
          <div className="newspaper-rule mb-8" />

          <div className="space-y-8">
            {chapters.map((chapter) => {
              const scenes = chapter.readerScenes ?? [];
              const withProse = scenes.filter((s) => s.proseText.length > 0);
              return (
                <div key={chapter._id}>
                  <h2 className="font-display text-2xl font-bold mb-4">
                    {chapter.title}
                  </h2>
                  <div className="font-body text-base leading-[1.8] text-foreground/85 space-y-6">
                    {scenes.length === 0 ? (
                      <p className="text-muted-foreground italic">
                        No scenes in this chapter yet.
                      </p>
                    ) : withProse.length > 0 ? (
                      withProse.map((s) => (
                        <div key={s.sceneId}>
                          {scenes.length > 1 && (
                            <h3 className="font-display text-lg font-semibold text-foreground/90 mb-2">
                              {s.title}
                            </h3>
                          )}
                          <div className="whitespace-pre-wrap text-foreground/90">
                            {s.proseText}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground italic">
                        Open this story in the workspace, add interactions on the
                        canvas or timeline, and save — reader prose updates from
                        the same scene events as the Prose panel (including AI
                        passages when generation is enabled).
                      </p>
                    )}
                  </div>
                  <Separator className="bg-foreground/10 mt-8" />
                </div>
              );
            })}

            {chapters.length === 0 && (
              <div className="py-12 text-center">
                <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground font-body mb-4">
                  This story has no chapters yet.
                </p>
                {isAuthor && (
                  <Link href={storyWorkspacePath(story._id)}>
                    <Button className="font-mono-face text-xs tracking-wider uppercase gap-1.5">
                      <Pencil className="h-3 w-3" />
                      Open workspace
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>

          <p className="mt-12 text-[10px] font-mono-face text-muted-foreground/70 break-all">
            Share: {shareUrl || storyReaderPath(universe.slug, story._id)}
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
