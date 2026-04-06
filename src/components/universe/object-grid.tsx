"use client";

import type { ReactNode } from "react";
import { ObjectCard } from "./object-card";
import { objectPreviewPath } from "@/lib/routes";

interface ObjectData {
  _id: string;
  name: string;
  kind: string;
  description: string;
  imageUrl?: string;
  tags: string[];
}

interface ObjectGridProps {
  /** Universe slug for preview URLs (`/universe/{slug}/object/{id}`). */
  universeSlug: string;
  objects: ObjectData[];
  kindFilter?: string;
  /** Shown under the empty-state line when the filtered list is empty. */
  emptyHint?: ReactNode;
}

export function ObjectGrid({
  universeSlug,
  objects,
  kindFilter,
  emptyHint,
}: ObjectGridProps) {
  const filtered = kindFilter
    ? objects.filter((o) => o.kind === kindFilter)
    : objects;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {filtered.map((obj) => (
        <ObjectCard
          key={obj._id}
          name={obj.name}
          kind={obj.kind}
          description={obj.description}
          imageUrl={obj.imageUrl}
          href={objectPreviewPath(universeSlug, obj._id)}
        />
      ))}

      {filtered.length === 0 && (
        <div className="col-span-full py-12 text-center">
          <p className="text-muted-foreground font-body">
            No objects found in this category.
          </p>
          {emptyHint ? (
            <div className="mt-4 text-muted-foreground font-body">{emptyHint}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
