"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Masthead } from "@/components/layout/masthead";
import { Footer } from "@/components/layout/footer";
import { UniverseCard } from "@/components/catalog/universe-card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useOptionalSessionToken } from "@/contexts/auth-context";
import { objectPreviewPath } from "@/lib/routes";

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <>
          <Masthead />
          <main className="flex-1 max-w-7xl mx-auto px-4 py-8">
            <Skeleton className="h-8 w-48 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          </main>
          <Footer />
        </>
      }
    >
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const sessionToken = useOptionalSessionToken();
  const q = searchParams.get("q") ?? "";
  const hasQuery = Boolean(q.trim());

  const universes = useQuery(
    api.universes.search,
    hasQuery ? { query: q.trim() } : "skip"
  );

  const objects = useQuery(
    api.objects.search,
    hasQuery
      ? {
          query: q.trim(),
          ...(sessionToken ? { sessionToken } : {}),
        }
      : "skip"
  );

  const catalogUniverses = useQuery(
    api.universes.list,
    !hasQuery ? { visibility: "public" as const, limit: 100 } : "skip"
  );

  const catalogObjects = useQuery(
    api.objects.listCatalog,
    !hasQuery ? { limit: 72 } : "skip"
  );

  const isLoading = hasQuery
    ? universes === undefined || objects === undefined
    : catalogUniverses === undefined || catalogObjects === undefined;

  const displayUniverses = hasQuery ? universes : catalogUniverses;
  const displayObjects = hasQuery ? objects : catalogObjects;

  return (
    <>
      <Masthead />
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <p className="section-label mb-2">
            {hasQuery ? "Search results" : "Catalog"}
          </p>
          <h1 className="font-display text-3xl font-black">
            {q ? `"${q}"` : "Browse catalog"}
          </h1>
          {!hasQuery && (
            <p className="mt-2 text-sm text-muted-foreground font-body max-w-xl">
              Public universes and objects. Use the bar above or ⌘K to search
              by name.
            </p>
          )}
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        )}

        {!isLoading && displayUniverses && displayUniverses.length > 0 && (
          <section className="mb-8">
            <h2 className="section-label mb-4">
              Universes ({displayUniverses.length})
            </h2>
            <div className="flex flex-wrap gap-4">
              {displayUniverses.map((u) => (
                <UniverseCard
                  key={u._id}
                  name={u.name}
                  slug={u.slug}
                  description={u.description}
                  coverUrl={u.coverUrl}
                  objectCount={u.objectCount}
                  storyCount={u.storyCount}
                  likeCount={u.likeCount}
                  tags={u.tags}
                />
              ))}
            </div>
          </section>
        )}

        {!isLoading &&
          displayUniverses &&
          displayUniverses.length > 0 &&
          displayObjects &&
          displayObjects.length > 0 && (
          <Separator className="bg-foreground/10 my-6" />
        )}

        {!isLoading && displayObjects && displayObjects.length > 0 && (
          <section>
            <h2 className="section-label mb-4">
              Objects ({displayObjects.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayObjects.map((obj) => {
                const row = (
                  <div className="flex flex-col sm:flex-row sm:items-stretch overflow-hidden">
                    {obj.imageUrl ? (
                      <img
                        src={obj.imageUrl}
                        alt={obj.name}
                        className="w-full sm:w-36 shrink-0 aspect-[16/10] sm:aspect-auto sm:self-stretch sm:min-h-[120px] object-cover border-b sm:border-b-0 sm:border-r border-foreground/10"
                      />
                    ) : (
                      <div className="w-full sm:w-36 shrink-0 aspect-[16/10] sm:aspect-auto sm:self-stretch sm:min-h-[120px] bg-muted flex items-center justify-center border-b sm:border-b-0 sm:border-r border-foreground/10">
                        <span className="font-display text-2xl font-bold text-muted-foreground/40">
                          {obj.name[0]}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0 p-4 flex flex-col justify-center">
                      <p className="font-display text-sm font-bold truncate">
                        {obj.name}
                      </p>
                      <p className="text-[10px] font-mono-face tracking-wider uppercase text-muted-foreground">
                        {obj.kind}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-3 mt-1 font-body">
                        {obj.description}
                      </p>
                    </div>
                  </div>
                );
                const slug =
                  "universeSlug" in obj &&
                  typeof (obj as { universeSlug?: string }).universeSlug ===
                    "string"
                    ? (obj as { universeSlug: string }).universeSlug
                    : null;
                const shell =
                  "border border-foreground/20 overflow-hidden hover:border-foreground transition-colors";
                if (slug) {
                  return (
                    <Link
                      key={obj._id}
                      href={objectPreviewPath(slug, obj._id)}
                      className={`${shell} block no-underline text-inherit`}
                    >
                      {row}
                    </Link>
                  );
                }
                return (
                  <div key={obj._id} className={shell}>
                    {row}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {hasQuery &&
          universes &&
          objects &&
          universes.length === 0 &&
          objects.length === 0 && (
            <div className="py-20 text-center">
              <p className="font-display text-xl font-bold mb-2">
                No results found
              </p>
              <p className="text-muted-foreground font-body">
                Try searching with different terms.
              </p>
            </div>
          )}

        {!hasQuery &&
          !isLoading &&
          catalogUniverses &&
          catalogObjects &&
          catalogUniverses.length === 0 &&
          catalogObjects.length === 0 && (
            <div className="py-20 text-center text-muted-foreground font-body">
              Nothing in the public catalog yet.
            </div>
          )}
      </main>
      <Footer />
    </>
  );
}
