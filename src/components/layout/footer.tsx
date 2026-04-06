import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export function Footer() {
  return (
    <footer className="mt-auto border-t-2 border-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          <div>
            <p className="font-display text-lg font-black tracking-tight uppercase mb-2">
              StoryObject
            </p>
            <p className="text-xs font-mono-face text-muted-foreground tracking-wider max-w-sm leading-relaxed">
              Building blocks to build universes. Remix any world, write in a
              game-engine-style workspace, and share your stories.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-2 text-xs font-mono-face tracking-[0.12em] uppercase">
            <Link
              href="/search"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Search
            </Link>
            <Link
              href="/create/universe"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Create
            </Link>
            <Link
              href="/sign-in"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
          </nav>
        </div>
        <Separator className="bg-foreground/10 my-8" />
        <p className="text-[10px] font-mono-face text-muted-foreground/80 tracking-wider text-center md:text-left">
          Build and remix any universe · Share your stories
        </p>
      </div>
    </footer>
  );
}
