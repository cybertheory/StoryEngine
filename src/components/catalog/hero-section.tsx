"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Layers,
  BookOpen,
  Heart,
} from "lucide-react";
import { HeroCursorBackdrop } from "@/components/catalog/hero-cursor-backdrop";

const ROTATE_MS = 7000;

export type HeroSpotlightUniverse = {
  name: string;
  slug: string;
  description: string;
  coverUrl?: string;
  objectCount: number;
  storyCount: number;
  likeCount: number;
  tags: string[];
};

interface HeroProps {
  universes: HeroSpotlightUniverse[];
}

function IntroHeroContent() {
  return (
    <>
      <p className="text-[11px] font-mono-face tracking-[0.28em] uppercase text-primary-foreground/55 mb-5">
        Create · Remix · Share
      </p>
      <h2 className="font-display text-[clamp(2.25rem,7vw,5rem)] font-black leading-[0.92] tracking-[-0.02em] mb-6 max-w-4xl mx-auto md:mx-0">
        Building Blocks
        <br />
        <span className="text-primary-foreground/88">to Build Universes.</span>
      </h2>
      <p className="text-lg md:text-xl text-primary-foreground/72 max-w-xl mb-10 font-body leading-relaxed mx-auto md:mx-0">
        Build and remix any universe. Share your stories.
      </p>
      <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
        <Link
          href="/create/universe"
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-11 px-6 font-mono-face text-xs tracking-[0.12em] uppercase bg-primary-foreground text-foreground hover:bg-primary-foreground/90 border-0 no-underline"
          )}
        >
          Create a universe
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
        <Link
          href="/search"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-11 px-6 font-mono-face text-xs tracking-[0.12em] uppercase border-primary-foreground/35 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground no-underline"
          )}
        >
          Browse catalog
        </Link>
      </div>
    </>
  );
}

export function HeroSection({ universes }: HeroProps) {
  const containerRef = useRef<HTMLElement>(null);
  const hasUniverseSlides = universes.length > 0;
  const totalSlides = hasUniverseSlides ? 1 + universes.length : 1;

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const max = Math.max(0, totalSlides - 1);
    setActive((i) => Math.min(i, max));
  }, [totalSlides]);

  useEffect(() => {
    if (!hasUniverseSlides || totalSlides <= 1 || reducedMotion || paused) return;
    const id = window.setInterval(() => {
      setActive((a) => (a + 1) % totalSlides);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [hasUniverseSlides, totalSlides, reducedMotion, paused]);

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= totalSlides) return;
      setActive(index);
    },
    [totalSlides]
  );

  const prevSlide = useCallback(() => {
    setActive((a) => (a - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  const nextSlide = useCallback(() => {
    setActive((a) => (a + 1) % totalSlides);
  }, [totalSlides]);

  if (!hasUniverseSlides) {
    return (
      <section
        ref={containerRef}
        className="relative bg-foreground text-primary-foreground overflow-hidden min-h-[min(52vh,440px)] flex items-center"
      >
        <HeroCursorBackdrop containerRef={containerRef} />
        <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-transparent via-transparent to-foreground" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-20 md:py-28 text-center md:text-left w-full">
          <IntroHeroContent />
        </div>
      </section>
    );
  }

  return (
    <section
      ref={containerRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={cn(
        "relative overflow-hidden flex flex-col min-h-[min(70vh,520px)]",
        active === 0
          ? "justify-center bg-foreground text-primary-foreground"
          : "justify-end bg-black text-white"
      )}
    >
      {active === 0 ? (
        <HeroCursorBackdrop containerRef={containerRef} />
      ) : null}

      {universes.map((u, i) => {
        const slideIndex = i + 1;
        return (
          <div
            key={u.slug}
            aria-hidden={active !== slideIndex}
            className={cn(
              "absolute inset-0 z-[1] transition-opacity duration-700 ease-out",
              active === slideIndex ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          >
            {u.coverUrl ? (
              <img
                src={u.coverUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-black" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/25" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />
          </div>
        );
      })}

      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-transparent via-transparent to-foreground transition-opacity duration-700",
          active === 0 ? "opacity-100" : "opacity-0"
        )}
        aria-hidden={active !== 0}
      />

      <div
        className={cn(
          "relative z-10 w-full max-w-7xl mx-auto px-4",
          active === 0 ? "py-20 md:py-28 text-center md:text-left" : "py-16 md:py-24"
        )}
      >
        <div
          className={cn(
            "transition-opacity duration-500 ease-out",
            active === 0
              ? "relative opacity-100"
              : "pointer-events-none absolute inset-x-4 top-0 opacity-0"
          )}
          aria-hidden={active !== 0}
        >
          <IntroHeroContent />
        </div>

        {universes.map((u, i) => {
          const slideIndex = i + 1;
          return (
            <div
              key={u.slug}
              className={cn(
                "transition-opacity duration-500 ease-out",
                active === slideIndex
                  ? "relative opacity-100"
                  : "pointer-events-none absolute inset-x-4 top-0 opacity-0"
              )}
              aria-hidden={active !== slideIndex}
            >
              <p className="text-[11px] font-mono-face tracking-[0.28em] uppercase text-white/45 mb-3">
                Featured universe
              </p>
              <h2 className="font-display text-4xl md:text-6xl font-black text-white leading-[0.92] tracking-tight mb-4 max-w-2xl">
                {u.name}
              </h2>
              <p className="text-base md:text-lg text-white/75 max-w-lg mb-6 font-body leading-relaxed">
                {u.description}
              </p>
              <div className="flex items-center gap-4 mb-6 text-xs font-mono-face text-white/50">
                <span className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  {u.objectCount} objects
                </span>
                <span className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  {u.storyCount} stories
                </span>
                <span className="flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5" />
                  {u.likeCount}
                </span>
              </div>
              <div className="flex gap-2 mb-8 flex-wrap">
                {u.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-mono-face tracking-wider uppercase px-2.5 py-1 border border-white/35 text-white/80 bg-black/20"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <Link
                href={`/universe/${u.slug}`}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "inline-flex h-11 px-6 font-mono-face text-xs tracking-[0.12em] uppercase bg-white text-black hover:bg-white/90 border-0 no-underline"
                )}
              >
                Explore universe
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          );
        })}

        {totalSlides > 1 && (
          <div
            className={cn(
              "mt-10 flex flex-wrap items-center gap-2 sm:gap-3",
              active === 0 ? "justify-center md:justify-start" : ""
            )}
          >
            <button
              type="button"
              onClick={prevSlide}
              aria-label="Previous spotlight"
              className={cn(
                "group flex h-10 w-10 shrink-0 items-center justify-center border transition-[color,background-color,border-color] duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                active === 0
                  ? "border-primary-foreground/30 bg-primary-foreground/[0.07] text-primary-foreground hover:border-primary-foreground/50 hover:bg-primary-foreground/[0.12] focus-visible:ring-primary-foreground/35 focus-visible:ring-offset-foreground"
                  : "border-white/30 bg-black/30 text-white backdrop-blur-md hover:border-white/45 hover:bg-black/45 focus-visible:ring-white/40 focus-visible:ring-offset-black"
              )}
            >
              <ChevronLeft
                className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-px"
                strokeWidth={1.35}
                aria-hidden
              />
            </button>

            <div
              className={cn(
                "hidden sm:block h-5 w-px shrink-0",
                active === 0 ? "bg-primary-foreground/20" : "bg-white/25"
              )}
              aria-hidden
            />

            <div
              className="flex flex-wrap items-center gap-2"
              role="tablist"
              aria-label="Hero spotlight"
            >
              <button
                type="button"
                role="tab"
                aria-selected={active === 0}
                aria-label="StoryObject — Building blocks to build universes"
                onClick={() => goTo(0)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  active === 0
                    ? "w-8 bg-primary-foreground focus-visible:ring-primary-foreground/35 focus-visible:ring-offset-foreground"
                    : "w-1.5 bg-white/35 hover:bg-white/55 focus-visible:ring-white/35 focus-visible:ring-offset-black"
                )}
              />
              {universes.map((u, i) => {
                const slideIndex = i + 1;
                const selected = active === slideIndex;
                return (
                  <button
                    key={u.slug}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-label={`Show ${u.name}`}
                    onClick={() => goTo(slideIndex)}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                      selected
                        ? "w-8 bg-white focus-visible:ring-white/40 focus-visible:ring-offset-black"
                        : active === 0
                          ? "w-1.5 bg-primary-foreground/30 hover:bg-primary-foreground/50 focus-visible:ring-primary-foreground/35 focus-visible:ring-offset-foreground"
                          : "w-1.5 bg-white/35 hover:bg-white/55 focus-visible:ring-white/35 focus-visible:ring-offset-black"
                    )}
                  />
                );
              })}
            </div>

            <div
              className={cn(
                "hidden sm:block h-5 w-px shrink-0",
                active === 0 ? "bg-primary-foreground/20" : "bg-white/25"
              )}
              aria-hidden
            />

            <button
              type="button"
              onClick={nextSlide}
              aria-label="Next spotlight"
              className={cn(
                "group flex h-10 w-10 shrink-0 items-center justify-center border transition-[color,background-color,border-color] duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                active === 0
                  ? "border-primary-foreground/30 bg-primary-foreground/[0.07] text-primary-foreground hover:border-primary-foreground/50 hover:bg-primary-foreground/[0.12] focus-visible:ring-primary-foreground/35 focus-visible:ring-offset-foreground"
                  : "border-white/30 bg-black/30 text-white backdrop-blur-md hover:border-white/45 hover:bg-black/45 focus-visible:ring-white/40 focus-visible:ring-offset-black"
              )}
            >
              <ChevronRight
                className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-px"
                strokeWidth={1.35}
                aria-hidden
              />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
