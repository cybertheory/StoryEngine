"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Masthead } from "@/components/layout/masthead";
import { Footer } from "@/components/layout/footer";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Layers } from "lucide-react";
import { useAppSession } from "@/contexts/auth-context";
import { objectPreviewPath } from "@/lib/routes";
import { useEffect } from "react";

export default function ObjectPreviewPage({
  params,
}: {
  params: Promise<{ slug: string; objectId: string }>;
}) {
  const { slug, objectId } = use(params);
  const { token } = useAppSession();

  const preview = useQuery(
    api.objects.getPreviewInUniverse,
    objectId
      ? {
          universeSlug: slug,
          objectId: objectId as Id<"objects">,
          ...(token ? { sessionToken: token } : {}),
        }
      : "skip"
  );

  const creator = useQuery(
    api.users.getById,
    preview ? { id: preview.object.createdBy } : "skip"
  );

  useEffect(() => {
    if (preview?.object.name) {
      document.title = `${preview.object.name} · ${preview.universe.name} · StoryObject`;
    }
  }, [preview]);

  if (preview === undefined) {
    return (
      <>
        <Masthead />
        <main className="flex-1 max-w-3xl mx-auto px-4 py-10">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="aspect-video w-full max-w-xl mb-6" />
          <Skeleton className="h-6 w-full mb-2" />
          <Skeleton className="h-32 w-full" />
        </main>
        <Footer />
      </>
    );
  }

  if (!preview) {
    return (
      <>
        <Masthead />
        <main className="flex-1 max-w-3xl mx-auto px-4 py-20 text-center">
          <p className="font-display text-2xl font-bold mb-2">
            Object not found
          </p>
          <p className="text-muted-foreground font-body mb-6 max-w-md mx-auto leading-relaxed">
            This link may be wrong, or the object lives in a private universe.
            Sign in if it&apos;s yours.
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

  const { object: obj, universe } = preview;

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
            <span className="text-sm font-body text-muted-foreground truncate">
              {obj.name}
            </span>
          </div>
        </div>

        <article className="max-w-3xl mx-auto px-4 py-10">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge
              variant="outline"
              className="font-mono-face text-[10px] tracking-wider uppercase"
            >
              {obj.kind.replace("_", " ")}
            </Badge>
            <Link
              href={`/universe/${encodeURIComponent(universe.slug)}`}
              className="inline-flex items-center gap-1 text-[10px] font-mono-face tracking-wider uppercase text-muted-foreground hover:text-foreground"
            >
              <Layers className="h-3 w-3" />
              {universe.name}
            </Link>
          </div>

          <h1 className="font-display text-4xl md:text-5xl font-black tracking-tight mb-6">
            {obj.name}
          </h1>

          {obj.imageUrl && (
            <div className="mb-8 border border-foreground/15 overflow-hidden">
              <img
                src={obj.imageUrl}
                alt={obj.name}
                className="w-full max-h-[min(56vh,520px)] object-cover"
              />
            </div>
          )}

          <p className="text-base font-body leading-relaxed text-foreground/90 whitespace-pre-wrap mb-8">
            {obj.description}
          </p>

          {obj.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-8">
              {obj.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-mono-face tracking-wider uppercase px-2 py-1 border border-foreground/20 text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <Separator className="bg-foreground/10 mb-6" />

          <p className="text-xs text-muted-foreground font-mono-face">
            {creator ? (
              <>
                Building block in{" "}
                <Link
                  href={`/universe/${encodeURIComponent(universe.slug)}`}
                  className="underline underline-offset-2 text-foreground"
                >
                  {universe.name}
                </Link>
                {" · "}
                <Link
                  href={`/profile/${creator._id}`}
                  className="underline underline-offset-2 text-foreground"
                >
                  {creator.name}
                </Link>
              </>
            ) : (
              <>
                Part of{" "}
                <Link
                  href={`/universe/${encodeURIComponent(universe.slug)}`}
                  className="underline underline-offset-2 text-foreground"
                >
                  {universe.name}
                </Link>
              </>
            )}
          </p>

          <p className="mt-4 text-[10px] font-mono-face text-muted-foreground/70 break-all">
            Share:{" "}
            {typeof window !== "undefined"
              ? `${window.location.origin}${objectPreviewPath(universe.slug, obj._id)}`
              : objectPreviewPath(universe.slug, obj._id)}
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
