"use client";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { UniverseCard } from "./universe-card";

interface Universe {
  _id: string;
  name: string;
  slug: string;
  description: string;
  coverUrl?: string;
  objectCount: number;
  storyCount: number;
  likeCount: number;
  tags: string[];
}

interface UniverseRowProps {
  label: string;
  universes: Universe[];
}

export function UniverseRow({ label, universes }: UniverseRowProps) {
  if (universes.length === 0) return null;

  return (
    <section className="py-8 md:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between gap-4 mb-5 border-b border-foreground/15 pb-3">
          <h2 className="font-display text-lg md:text-xl font-bold tracking-tight">
            {label}
          </h2>
          <span className="text-[10px] font-mono-face tracking-[0.2em] uppercase text-muted-foreground hidden sm:block">
            Scroll →
          </span>
        </div>
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4">
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
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </section>
  );
}
