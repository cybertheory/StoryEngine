"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Command as CommandPrimitive } from "cmdk";
import { Globe, Box, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOptionalSessionToken } from "@/contexts/auth-context";
import { objectPreviewPath } from "@/lib/routes";

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function UniversalSpotlight({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const sessionToken = useOptionalSessionToken();
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 200);

  const universes = useQuery(
    api.universes.search,
    debounced.trim().length >= 1 ? { query: debounced.trim() } : "skip"
  );

  const objects = useQuery(
    api.objects.search,
    debounced.trim().length >= 1
      ? {
          query: debounced.trim(),
          ...(sessionToken ? { sessionToken } : {}),
        }
      : "skip"
  );

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const openRef = useRef(open);
  openRef.current = open;
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const editable =
        target?.isContentEditable ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT";
      if (editable && !openRef.current) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!openRef.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  const universeList = universes ?? [];
  const objectList = objects ?? [];
  const searching = debounced.trim().length >= 1;
  const loading =
    searching &&
    (universes === undefined || objects === undefined);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  const hint = useMemo(() => {
    if (
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)
    ) {
      return "⌘K";
    }
    return "Ctrl+K";
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "top-[8vh] left-1/2 z-[100] max-h-[min(72vh,640px)] w-[min(100%-1.5rem,560px)] -translate-x-1/2 translate-y-0 gap-0 overflow-hidden rounded-none border-2 border-foreground/20 bg-background p-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.35)] sm:max-w-none",
          "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.98] data-open:slide-in-from-top-2",
          "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.98]"
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search</DialogTitle>
        </DialogHeader>

        <Command
          shouldFilter={false}
          className="rounded-none border-0 bg-transparent shadow-none [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:font-mono-face [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:tracking-[0.18em] [&_[cmdk-group-heading]]:uppercase"
        >
          <label className="flex items-center gap-3 border-b border-foreground/15 bg-muted/25 px-4 py-3">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <CommandPrimitive.Input
              ref={searchInputRef}
              value={query}
              onValueChange={setQuery}
              placeholder="Search universes, characters, places, items…"
              className="flex-1 min-w-0 bg-transparent text-lg font-body text-foreground outline-none placeholder:text-muted-foreground/45"
            />
          </label>

          <CommandList className="max-h-[min(52vh,480px)] py-2">
            {!searching && (
              <CommandGroup heading="Quick actions">
                <CommandItem
                  value="quick-search"
                  onSelect={() => go("/search")}
                  className="rounded-none px-3 py-2.5"
                >
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span>Open full catalog search</span>
                </CommandItem>
                <CommandItem
                  value="quick-create"
                  onSelect={() => go("/create/universe")}
                  className="rounded-none px-3 py-2.5"
                >
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  <span>Create a new universe</span>
                </CommandItem>
              </CommandGroup>
            )}

            {searching && loading && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground font-mono-face">
                Searching…
              </div>
            )}

            {searching && !loading && universeList.length === 0 && objectList.length === 0 && (
              <CommandEmpty className="py-10 font-body text-muted-foreground">
                No matches for &ldquo;{debounced.trim()}&rdquo;
              </CommandEmpty>
            )}

            {searching && !loading && universeList.length > 0 && (
              <>
                <CommandGroup heading="Universes">
                  {universeList.map((u) => (
                    <CommandItem
                      key={u._id}
                      value={`universe-${u._id}`}
                      onSelect={() => go(`/universe/${u.slug}`)}
                      className="rounded-none px-3 py-2.5"
                    >
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate font-display font-semibold">
                          {u.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground font-body">
                          {u.description.slice(0, 72)}
                          {u.description.length > 72 ? "…" : ""}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {searching && !loading && objectList.length > 0 && (
              <>
                {universeList.length > 0 && <CommandSeparator className="bg-foreground/10" />}
                <CommandGroup heading="Objects">
                  {objectList.map((o) => (
                    <CommandItem
                      key={o._id}
                      value={`object-${o._id}`}
                      onSelect={() =>
                        go(
                          "universeSlug" in o && typeof o.universeSlug === "string"
                            ? objectPreviewPath(o.universeSlug, o._id)
                            : `/search?q=${encodeURIComponent(o.name)}`
                        )
                      }
                      className="rounded-none px-3 py-2.5"
                    >
                      <Box className="h-4 w-4 text-muted-foreground" />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-center gap-2 truncate">
                          <span className="truncate font-display font-semibold">
                            {o.name}
                          </span>
                          <span className="shrink-0 text-[10px] font-mono-face uppercase tracking-wider text-muted-foreground">
                            {o.kind}
                          </span>
                        </span>
                        <span className="truncate text-xs text-muted-foreground font-body">
                          {o.description.slice(0, 64)}
                          {o.description.length > 64 ? "…" : ""}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-foreground/10 bg-muted/20 px-3 py-2 text-[10px] font-mono-face text-muted-foreground">
            <span>
              <kbd className="rounded border border-foreground/20 bg-background px-1 py-0.5">
                ↑↓
              </kbd>{" "}
              navigate{" "}
              <kbd className="rounded border border-foreground/20 bg-background px-1 py-0.5">
                ↵
              </kbd>{" "}
              open{" "}
              <kbd className="rounded border border-foreground/20 bg-background px-1 py-0.5">
                esc
              </kbd>{" "}
              close
            </span>
            <span className="hidden sm:inline opacity-70">{hint}</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
