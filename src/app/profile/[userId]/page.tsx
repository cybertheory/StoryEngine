"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { Masthead } from "@/components/layout/masthead";
import { Footer } from "@/components/layout/footer";
import { UniverseCard } from "@/components/catalog/universe-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookOpen, Layers } from "lucide-react";
import Link from "next/link";
import { useAppSession } from "@/contexts/auth-context";
import { storyReaderPath } from "@/lib/routes";

export default function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const { token } = useAppSession();
  const user = useQuery(api.users.getById, {
    id: userId as Id<"users">,
  });

  const universes = useQuery(
    api.universes.byCreator,
    user
      ? {
          creatorId: user._id,
          ...(token ? { sessionToken: token } : {}),
        }
      : "skip"
  );

  const stories = useQuery(
    api.stories.listByAuthor,
    user
      ? {
          authorId: user._id,
          ...(token ? { sessionToken: token } : {}),
        }
      : "skip"
  );

  if (user === undefined) {
    return (
      <>
        <Masthead />
        <main className="flex-1 max-w-5xl mx-auto px-4 py-12">
          <div className="flex items-center gap-4 mb-8">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div>
              <Skeleton className="h-6 w-40 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <Skeleton className="h-64 w-full" />
        </main>
        <Footer />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Masthead />
        <main className="flex-1 max-w-5xl mx-auto px-4 py-20 text-center">
          <p className="font-display text-2xl font-bold">User not found</p>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Masthead />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-start gap-5 mb-8">
          <Avatar className="h-16 w-16 border-2 border-foreground">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="font-display text-lg font-bold bg-muted">
              {user.name[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-display text-2xl font-black">{user.name}</h1>
            {user.username && (
              <p className="text-xs font-mono-face text-muted-foreground">
                @{user.username}
              </p>
            )}
            {user.bio && (
              <p className="text-sm font-body text-muted-foreground mt-2 max-w-md">
                {user.bio}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs font-mono-face text-muted-foreground">
              <span className="flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {universes?.length ?? 0} universes
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                {stories?.length ?? 0} stories
              </span>
            </div>
          </div>
        </div>

        <Separator className="bg-foreground/10 mb-6" />

        <Tabs defaultValue="universes">
          <TabsList className="bg-transparent border-b border-foreground/10 w-full justify-start gap-0 p-0 h-auto">
            <TabsTrigger
              value="universes"
              className="font-mono-face text-xs tracking-wider uppercase px-4 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:shadow-none rounded-none bg-transparent"
            >
              Universes
            </TabsTrigger>
            <TabsTrigger
              value="stories"
              className="font-mono-face text-xs tracking-wider uppercase px-4 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:shadow-none rounded-none bg-transparent"
            >
              Stories
            </TabsTrigger>
          </TabsList>

          <TabsContent value="universes" className="pt-4">
            {universes && universes.length > 0 ? (
              <div className="flex flex-wrap gap-4">
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
            ) : (
              <p className="text-center py-12 text-muted-foreground font-body">
                No universes created yet.
              </p>
            )}
          </TabsContent>

          <TabsContent value="stories" className="pt-4">
            {stories && stories.length > 0 ? (
              <div className="space-y-3">
                {stories.map((story) => (
                  <Link
                    key={story._id}
                    href={storyReaderPath(story.universeSlug, story._id)}
                    className="block border border-foreground/15 p-4 hover:border-foreground/50 transition-colors"
                  >
                    <h3 className="font-display text-base font-bold">
                      {story.title}
                    </h3>
                    {story.description && (
                      <p className="text-xs text-muted-foreground mt-1 font-body">
                        {story.description}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-center py-12 text-muted-foreground font-body">
                No stories written yet.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </>
  );
}
