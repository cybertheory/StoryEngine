"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface ObjectCardProps {
  name: string;
  kind: string;
  description: string;
  imageUrl?: string;
  /** When set, the whole card navigates to the object preview page. */
  href?: string;
  onClick?: () => void;
  draggable?: boolean;
}

const KIND_ICONS: Record<string, string> = {
  character: "CH",
  place: "PL",
  item: "IT",
  faction: "FA",
  lore: "LO",
  event_type: "EV",
};

const cardClass =
  "w-full text-left border border-foreground/15 hover:border-foreground/60 transition-colors bg-background group";

const inner = (
  name: string,
  kind: string,
  description: string,
  imageUrl?: string
) => (
  <div className="flex gap-3 p-3">
    {imageUrl ? (
      <img
        src={imageUrl}
        alt={name}
        className="w-14 h-14 object-cover border border-foreground/10 shrink-0"
      />
    ) : (
      <div className="w-14 h-14 bg-muted flex items-center justify-center border border-foreground/10 shrink-0">
        <span className="font-mono-face text-xs font-bold text-muted-foreground/50">
          {KIND_ICONS[kind] || kind[0]?.toUpperCase() || "?"}
        </span>
      </div>
    )}
    <div className="flex-1 min-w-0">
      <p className="font-display text-sm font-bold truncate group-hover:underline">
        {name}
      </p>
      <p className="text-[10px] font-mono-face tracking-wider uppercase text-muted-foreground mb-1">
        {kind}
      </p>
      <p className="text-xs text-muted-foreground line-clamp-2 font-body">
        {description}
      </p>
    </div>
  </div>
);

export function ObjectCard({
  name,
  kind,
  description,
  imageUrl,
  href,
  onClick,
}: ObjectCardProps) {
  if (href) {
    return (
      <Link href={href} className={cn(cardClass, "block no-underline")}>
        {inner(name, kind, description, imageUrl)}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cardClass}
    >
      {inner(name, kind, description, imageUrl)}
    </button>
  );
}
