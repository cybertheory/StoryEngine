import Link from "next/link";
import { Heart, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StoryCardProps = {
  title: string;
  description?: string;
  likeCount: number;
  href: string;
  coverUrl?: string;
  visibility?: "public" | "private" | "unlisted";
  className?: string;
};

export function StoryCard({
  title,
  description,
  likeCount,
  href,
  coverUrl,
  visibility,
  className,
}: StoryCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group block border border-foreground/15 p-3 hover:border-foreground/45 transition-colors no-underline text-inherit",
        className
      )}
    >
      <div className="flex gap-3">
        <div className="w-14 h-[4.5rem] shrink-0 border border-foreground/10 overflow-hidden bg-muted">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-muted-foreground/35" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 flex flex-col">
          <div className="flex items-start gap-2 mb-1">
            <h3 className="font-display text-sm font-bold leading-tight group-hover:underline underline-offset-2 line-clamp-2">
              {title}
            </h3>
            {visibility && visibility !== "public" && (
              <Badge
                variant="outline"
                className="shrink-0 font-mono-face text-[9px] uppercase px-1 py-0"
              >
                {visibility === "private" ? "Private" : "Unlisted"}
              </Badge>
            )}
          </div>
          {description && (
            <p className="text-[11px] text-muted-foreground font-body line-clamp-2 leading-snug mb-auto">
              {description}
            </p>
          )}
          <div className="flex items-center gap-1 mt-2 text-[10px] font-mono-face text-muted-foreground">
            <Heart className="h-3 w-3" />
            {likeCount}
          </div>
        </div>
      </div>
    </Link>
  );
}
