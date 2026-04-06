"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { Masthead } from "@/components/layout/masthead";
import { Footer } from "@/components/layout/footer";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppSession } from "@/contexts/auth-context";
import { storyReaderPath } from "@/lib/routes";

/**
 * Legacy `/story/[id]` — redirects to canonical
 * `/universe/[slug]/story/[id]` once the story and universe are resolved.
 */
export default function StoryLegacyRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { token } = useAppSession();
  const storyId = id as Id<"stories">;

  const story = useQuery(api.stories.getById, {
    id: storyId,
    ...(token ? { sessionToken: token } : {}),
  });

  const universe = useQuery(
    api.universes.getById,
    story
      ? {
          id: story.universeId,
          ...(token ? { sessionToken: token } : {}),
        }
      : "skip"
  );

  useEffect(() => {
    if (story && universe) {
      router.replace(storyReaderPath(universe.slug, story._id));
    }
  }, [story, universe, router]);

  if (story === undefined || (story && universe === undefined)) {
    return (
      <>
        <Masthead />
        <main className="flex-1 max-w-md mx-auto px-4 py-20 text-center">
          <Skeleton className="h-8 w-48 mx-auto mb-4" />
          <p className="text-xs font-mono-face text-muted-foreground">
            Opening story…
          </p>
        </main>
        <Footer />
      </>
    );
  }

  if (!story || !universe) {
    return (
      <>
        <Masthead />
        <main className="flex-1 max-w-md mx-auto px-4 py-20 text-center">
          <p className="font-display text-xl font-bold mb-2">
            Story not found
          </p>
          <p className="text-sm text-muted-foreground font-body">
            This story may have been removed, or you don&apos;t have access.
          </p>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Masthead />
      <main className="flex-1 max-w-md mx-auto px-4 py-20 text-center">
        <Skeleton className="h-8 w-48 mx-auto mb-4" />
        <p className="text-xs font-mono-face text-muted-foreground">
          Redirecting…
        </p>
      </main>
      <Footer />
    </>
  );
}
