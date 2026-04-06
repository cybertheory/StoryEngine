"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Masthead } from "@/components/layout/masthead";
import { Footer } from "@/components/layout/footer";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppSession } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const SIGN_IN_WITH_RETURN = `/sign-in?redirect=${encodeURIComponent("/create/universe")}`;

function CreateUniverseForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forkSlug = searchParams.get("fork")?.trim() || null;

  const { isLoaded, isSignedIn, token } = useAppSession();
  const createUniverse = useMutation(api.universes.create);
  const forkUniverse = useMutation(api.universes.fork);

  const forkParent = useQuery(
    api.universes.getBySlug,
    forkSlug
      ? token
        ? { slug: forkSlug, sessionToken: token }
        : { slug: forkSlug }
      : "skip"
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [coverUrl, setCoverUrl] = useState("");
  const [visibility, setVisibility] = useState<
    "public" | "private" | "unlisted"
  >("public");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const forkPrefilled = useRef(false);

  useEffect(() => {
    forkPrefilled.current = false;
  }, [forkSlug]);

  useEffect(() => {
    if (!forkSlug || !forkParent || forkPrefilled.current) return;
    forkPrefilled.current = true;
    setName(`${forkParent.name} (fork)`);
    setDescription(forkParent.description);
    setTags([...forkParent.tags]);
    setCoverUrl(forkParent.coverUrl ?? "");
  }, [forkSlug, forkParent]);

  function addTag() {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput("");
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSignedIn || !token || !name.trim()) return;

    setIsSubmitting(true);
    try {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      if (forkSlug && forkParent) {
        await forkUniverse({
          sessionToken: token,
          parentUniverseId: forkParent._id,
          name: name.trim(),
          slug,
          description: description.trim(),
          tags,
          visibility,
          coverUrl: coverUrl.trim() || undefined,
        });
      } else {
        await createUniverse({
          sessionToken: token,
          name: name.trim(),
          slug,
          description: description.trim(),
          tags,
          visibility,
          coverUrl: coverUrl.trim() || undefined,
        });
      }

      router.push(`/universe/${encodeURIComponent(slug)}`);
    } catch (err) {
      console.error("Failed to save universe:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  const forkLoading = Boolean(forkSlug) && forkParent === undefined;
  const forkMissing = Boolean(forkSlug) && forkParent === null;

  return (
    <>
      <Masthead />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-mono-face mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="newspaper-rule-thick mb-6" />
        <h1 className="font-display text-3xl font-black tracking-tight mb-2">
          {forkSlug ? "Fork universe" : "Create Universe"}
        </h1>
        <p className="text-sm text-muted-foreground font-body mb-8">
          {forkSlug ? (
            <>
              You get a new universe with a full copy of objects and
              relationships from the source. Stories stay on the original —
              fork is for remixing the building blocks and adding your own.
            </>
          ) : (
            <>
              Your universe is a set of building blocks — characters, places,
              items, and lore. Others can remix it; you share stories built
              from it.
            </>
          )}
        </p>

        {forkSlug && forkLoading && (
          <div className="mb-8 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {forkSlug && forkMissing && (
          <div
            className="mb-8 border border-foreground/25 bg-muted/30 px-4 py-4"
            role="status"
          >
            <p className="font-body text-sm text-foreground mb-3">
              We couldn&apos;t load that universe to fork. It may be private or
              the link may be wrong.
            </p>
            <Link
              href="/create/universe"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "font-mono-face text-xs uppercase no-underline"
              )}
            >
              Create blank universe
            </Link>
          </div>
        )}

        {forkSlug && forkParent && (
          <div className="mb-6 border border-foreground/15 px-4 py-3 text-sm font-body text-muted-foreground">
            Forking from{" "}
            <span className="text-foreground font-display font-semibold">
              {forkParent.name}
            </span>
            <span className="font-mono-face text-xs ml-2">
              ({forkParent.objectCount} objects)
            </span>
          </div>
        )}

        {isLoaded && !isSignedIn && (
          <div
            className="mb-8 border border-foreground/25 bg-muted/30 px-4 py-4 sm:px-5 sm:py-5"
            role="status"
          >
            <p className="text-[11px] font-mono-face tracking-[0.22em] uppercase text-muted-foreground mb-2">
              Sign in required
            </p>
            <p className="font-body text-sm text-foreground mb-4 leading-relaxed">
              You need to be signed in to create a universe. Sign in (or create
              an account) below, then you&apos;ll return here to finish the
              form.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={
                  forkSlug
                    ? `/sign-in?redirect=${encodeURIComponent(`/create/universe?fork=${encodeURIComponent(forkSlug)}`)}`
                    : SIGN_IN_WITH_RETURN
                }
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "font-mono-face text-xs tracking-wider uppercase h-9 no-underline"
                )}
              >
                Sign in
              </Link>
              <Link
                href={
                  forkSlug
                    ? `/sign-up?redirect=${encodeURIComponent(`/create/universe?fork=${encodeURIComponent(forkSlug)}`)}`
                    : `/sign-up?redirect=${encodeURIComponent("/create/universe")}`
                }
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "font-mono-face text-xs tracking-wider uppercase h-9 no-underline"
                )}
              >
                Create account
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset
            disabled={
              !isLoaded ||
              !isSignedIn ||
              Boolean(forkSlug && (forkLoading || forkMissing))
            }
            className={cn(
              "space-y-6 min-w-0 border-0 p-0 m-0",
              (!isLoaded || !isSignedIn || (forkSlug && (forkLoading || forkMissing))) &&
                "opacity-[0.55]"
            )}
          >
            <legend className="sr-only">
              Universe details{!isSignedIn && " — sign in to edit"}
            </legend>

            <div>
              <label className="section-label mb-2 block">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. The Hollow Crown"
                className="font-display text-lg border-foreground/30"
                required
              />
            </div>

            <div>
              <label className="section-label mb-2 block">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your universe — its premise, tone, and what makes it unique..."
                className="min-h-[120px] font-body border-foreground/30"
                required
              />
            </div>

            <div>
              <label className="section-label mb-2 block">Visibility</label>
              <select
                value={visibility}
                onChange={(e) =>
                  setVisibility(
                    e.target.value as "public" | "private" | "unlisted"
                  )
                }
                className="w-full h-10 border border-foreground/30 bg-background px-3 font-body text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <option value="public">
                  Public — in catalog, search, and trending
                </option>
                <option value="unlisted">
                  Unlisted — open to anyone with the link (hidden from catalog)
                </option>
                <option value="private">Private — only you can view</option>
              </select>
              <p className="text-xs text-muted-foreground font-body mt-2 leading-relaxed">
                Private universes stay out of the catalog and search; only you
                can open them while signed in.
              </p>
            </div>

            <div>
              <label className="section-label mb-2 block">
                Cover Image URL (optional)
              </label>
              <Input
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="font-mono-face text-xs border-foreground/30"
              />
              {coverUrl && (
                <img
                  src={coverUrl}
                  alt="Cover preview"
                  className="mt-2 w-full max-w-xs aspect-[3/4] object-cover border border-foreground/20"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
            </div>

            <div>
              <label className="section-label mb-2 block">Tags</label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Add a tag..."
                  className="font-mono-face text-xs border-foreground/30"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTag}
                  className="shrink-0"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="font-mono-face text-[10px] tracking-wider uppercase gap-1 pr-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator className="bg-foreground/10" />

            <Button
              type="submit"
              disabled={
                !name.trim() ||
                isSubmitting ||
                !isSignedIn ||
                Boolean(forkSlug && (forkLoading || forkMissing))
              }
              className="w-full font-mono-face text-xs tracking-wider uppercase h-10"
            >
              {isSubmitting
                ? forkSlug
                  ? "Forking…"
                  : "Creating..."
                : forkSlug
                  ? "Fork universe"
                  : "Create Universe"}
            </Button>
          </fieldset>
        </form>
      </main>
      <Footer />
    </>
  );
}

export default function CreateUniversePage() {
  return (
    <Suspense
      fallback={
        <>
          <Masthead />
          <main className="flex-1 max-w-2xl mx-auto px-4 py-8">
            <Skeleton className="h-8 w-48 mb-6" />
            <Skeleton className="h-10 w-full mb-4" />
            <Skeleton className="h-40 w-full" />
          </main>
          <Footer />
        </>
      }
    >
      <CreateUniverseForm />
    </Suspense>
  );
}
