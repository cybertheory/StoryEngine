"use client";

import Link from "next/link";
import { Heart, BookOpen, Layers } from "lucide-react";

interface UniverseCardProps {
  name: string;
  slug: string;
  description: string;
  coverUrl?: string;
  objectCount: number;
  storyCount: number;
  likeCount: number;
  tags: string[];
}

export function UniverseCard({
  name,
  slug,
  description,
  coverUrl,
  objectCount,
  storyCount,
  likeCount,
  tags,
}: UniverseCardProps) {
  return (
    <Link href={`/universe/${slug}`} className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background">
      <article className="border border-foreground/25 hover:border-foreground bg-background w-[280px] shrink-0 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[4px_8px_0_0_rgba(0,0,0,0.08)]">
        <div className="aspect-[3/4] relative overflow-hidden">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <span className="font-display text-2xl font-bold text-muted-foreground/40">
                {name[0]}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <h3 className="font-display text-lg font-bold text-white leading-tight">
              {name}
            </h3>
          </div>
        </div>
        <div className="p-3 border-t border-foreground/10">
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2 font-body">
            {description}
          </p>
          <div className="flex items-center gap-3 text-xs font-mono-face text-muted-foreground">
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              {objectCount}
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {storyCount}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {likeCount}
            </span>
          </div>
          {tags.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-mono-face tracking-wider uppercase px-1.5 py-0.5 border border-foreground/20 text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
