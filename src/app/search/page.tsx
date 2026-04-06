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
import { Search } from "lucide-react";
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

  const universes = useQuery(
    api.universes.search,
    q.trim() ? { query: q.trim() } : "skip"
  );

  const objects = useQuery(
    api.objects.search,
    q.trim()
      ? {
          query: q.trim(),
          ...(sessionToken ? { sessionToken } : {}),
        }
      : "skip"
  );

  const isLoading = q.trim() && (universes === undefined || objects === undefined);

  return (
    <>
      <Masthead />
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <p className="section-label mb-2">Search Results</p>
          <h1 className="font-display text-3xl font-black">
            {q ? `"${q}"` : "Search"}
          </h1>
        </div>

        {!q.trim() && (
          <div className="py-20 text-center">
            <Search className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-body">
              Enter a search term to find universes, characters, places, and
              more.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        )}

        {q.trim() && universes && universes.length > 0 && (
          <section className="mb-8">
            <h2 className="section-label mb-4">
              Universes ({universes.length})
            </h2>
            <div className="flex flex-wrap gap-4">
              {universes.map((u) => (
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

        {q.trim() && universes && universes.length > 0 && objects && objects.length > 0 && (
          <Separator className="bg-foreground/10 my-6" />
        )}

        {q.trim() && objects && objects.length > 0 && (
          <section>
            <h2 className="section-label mb-4">Objects ({objects.length})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {objects.map((obj) => {
                const row = (
                  <div className="flex items-start gap-3">
                    {obj.imageUrl ? (
                      <img
                        src={obj.imageUrl}
                        alt={obj.name}
                        className="w-12 h-12 object-cover border border-foreground/10"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-muted flex items-center justify-center border border-foreground/10">
                        <span className="font-display text-sm font-bold text-muted-foreground/40">
                          {obj.name[0]}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-sm font-bold truncate">
                        {obj.name}
                      </p>
                      <p className="text-[10px] font-mono-face tracking-wider uppercase text-muted-foreground">
                        {obj.kind}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1 font-body">
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
                  "border border-foreground/20 p-4 hover:border-foreground transition-colors";
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

        {q.trim() &&
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
      </main>
      <Footer />
    </>
  );
}
