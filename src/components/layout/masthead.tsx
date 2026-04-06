"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useSpotlight } from "@/contexts/spotlight-context";
import { useAppSession } from "@/contexts/auth-context";
import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

function spotlightKbdSnapshot() {
  return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? "⌘K" : "Ctrl K";
}

export function Masthead() {
  const router = useRouter();
  const { openSpotlight } = useSpotlight();
  const { isSignedIn, signOut, user, userId } = useAppSession();

  const kbd = useSyncExternalStore(
    noopSubscribe,
    spotlightKbdSnapshot,
    () => "Ctrl K"
  );

  return (
    <header className="sticky top-0 z-50 border-b border-foreground bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="h-0.5 bg-foreground" aria-hidden />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[3.25rem] flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex flex-col shrink-0 group"
        >
          <span className="font-display text-[1.15rem] font-black tracking-[0.04em] uppercase leading-none group-hover:opacity-80 transition-opacity">
            StoryObject
          </span>
          <span className="hidden sm:block text-[9px] font-mono-face tracking-[0.18em] uppercase text-muted-foreground mt-0.5 max-w-[14rem] leading-tight">
            Building blocks to build universes
          </span>
        </Link>

        {/* Spotlight-style universal search trigger */}
        <button
          type="button"
          onClick={openSpotlight}
          className={cn(
            "hidden sm:flex flex-1 max-w-lg items-center gap-3 border border-foreground/20 bg-muted/35 px-3 h-9 text-left transition-colors",
            "hover:border-foreground/40 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="flex-1 font-mono-face text-[11px] tracking-wide text-muted-foreground/70 truncate">
            Search universes, objects…
          </span>
          <kbd className="hidden md:inline shrink-0 rounded-none border border-foreground/20 bg-background px-1.5 py-0.5 text-[10px] font-mono-face text-muted-foreground">
            {kbd}
          </kbd>
        </button>

        <nav className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={openSpotlight}
            aria-label="Open search"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" }),
              "sm:hidden inline-flex"
            )}
          >
            <Search className="h-4 w-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "text-[11px] font-mono-face tracking-[0.14em] uppercase h-8 px-3 gap-1.5 no-underline data-popup-open:bg-muted/50"
              )}
            >
              Create
              <ChevronDown className="h-3 w-3 opacity-70 shrink-0" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[9rem]">
              <DropdownMenuItem
                className="font-mono-face text-[11px] tracking-[0.12em] uppercase"
                onClick={() => router.push("/create/universe")}
              >
                Universe
              </DropdownMenuItem>
              <DropdownMenuItem
                className="font-mono-face text-[11px] tracking-[0.12em] uppercase"
                onClick={() => router.push("/create/story")}
              >
                Story
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {isSignedIn && userId && (
            <Link
              href={`/profile/${userId}`}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "text-[11px] font-mono-face tracking-[0.14em] uppercase h-8 px-3 no-underline hidden sm:inline-flex"
              )}
            >
              Profile
            </Link>
          )}
          {isSignedIn ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "text-[11px] font-mono-face tracking-[0.14em] uppercase h-8 px-3 max-w-[10rem] truncate"
              )}
              title={user?.email ?? user?.name}
            >
              Sign out
            </button>
          ) : (
            <Link
              href="/sign-in"
              className={cn(
                buttonVariants({ size: "sm" }),
                "text-[11px] font-mono-face tracking-[0.14em] uppercase h-8 px-3 no-underline"
              )}
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
