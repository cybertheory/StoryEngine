"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Masthead } from "@/components/layout/masthead";
import { Footer } from "@/components/layout/footer";
import { HeroSection } from "@/components/catalog/hero-section";
import { UniverseRow } from "@/components/catalog/universe-row";
import { Separator } from "@/components/ui/separator";

const GENRE_ROWS = [
  { tag: "sci-fi", label: "Science Fiction" },
  { tag: "fantasy", label: "Fantasy" },
  { tag: "horror", label: "Horror" },
  { tag: "romance", label: "Romance" },
  { tag: "mystery", label: "Mystery" },
];

export default function HomePage() {
  const featured = useQuery(api.universes.featured);
  const trending = useQuery(api.universes.trending, { limit: 20 });
  const allPublic = useQuery(api.universes.list, {
    visibility: "public",
    limit: 50,
  });

  const isLoading =
    featured === undefined || trending === undefined || allPublic === undefined;

  const genreRows = GENRE_ROWS.map(({ tag, label }) => ({
    label,
    universes: (allPublic ?? []).filter((u) => u.tags.includes(tag)),
  })).filter((row) => row.universes.length > 0);

  const spotlightUniverses = useMemo(() => {
    const out: typeof trending = [];
    const seen = new Set<string>();
    const push = (u: NonNullable<typeof featured>) => {
      if (seen.has(u._id)) return;
      seen.add(u._id);
      out.push(u);
    };
    if (featured) push(featured);
    for (const u of trending ?? []) {
      push(u);
      if (out.length >= 8) break;
    }
    return out;
  }, [featured, trending]);

  const heroUniverses = spotlightUniverses.map((u) => ({
    name: u.name,
    slug: u.slug,
    description: u.description,
    coverUrl: u.coverUrl,
    objectCount: u.objectCount,
    storyCount: u.storyCount,
    likeCount: u.likeCount,
    tags: u.tags,
  }));

  return (
    <>
      <Masthead />
      <main className="flex-1">
        {isLoading ? (
          <div className="space-y-0">
            <div className="w-full h-[min(52vh,440px)] border-b border-foreground/15 bg-muted/30 animate-pulse" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-6">
              <div className="h-3 w-40 bg-foreground/10 animate-pulse" />
              <div className="flex gap-4 overflow-hidden pb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-[280px] h-[400px] shrink-0 border border-foreground/12 bg-muted/25 animate-pulse"
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <HeroSection universes={heroUniverses} />

            <Separator className="bg-foreground/10" />

            {trending && trending.length > 0 && (
              <>
                <UniverseRow
                  label="Trending Now"
                  universes={trending.map((u) => ({
                    _id: u._id,
                    name: u.name,
                    slug: u.slug,
                    description: u.description,
                    coverUrl: u.coverUrl,
                    objectCount: u.objectCount,
                    storyCount: u.storyCount,
                    likeCount: u.likeCount,
                    tags: u.tags,
                  }))}
                />
                <div className="max-w-7xl mx-auto px-4">
                  <Separator className="bg-foreground/10" />
                </div>
              </>
            )}

            {genreRows.map((row) => (
              <div key={row.label}>
                <UniverseRow
                  label={row.label}
                  universes={row.universes.map((u) => ({
                    _id: u._id,
                    name: u.name,
                    slug: u.slug,
                    description: u.description,
                    coverUrl: u.coverUrl,
                    objectCount: u.objectCount,
                    storyCount: u.storyCount,
                    likeCount: u.likeCount,
                    tags: u.tags,
                  }))}
                />
                <div className="max-w-7xl mx-auto px-4">
                  <Separator className="bg-foreground/10" />
                </div>
              </div>
            ))}

            {(!allPublic || allPublic.length === 0) &&
              spotlightUniverses.length === 0 && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-16">
                <div className="max-w-lg mx-auto text-center border-y border-foreground/20 py-10 px-4">
                  <p className="text-[11px] font-mono-face tracking-[0.28em] uppercase text-muted-foreground mb-3">
                    Catalog
                  </p>
                  <p className="font-display text-2xl md:text-3xl font-black tracking-tight mb-3">
                    Nothing here yet
                  </p>
                  <p className="text-muted-foreground font-body text-sm leading-relaxed">
                    Be the first to create a universe and fill it with characters,
                    places, and lore — then remix, write, and share your stories.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
