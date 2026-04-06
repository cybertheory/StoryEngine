export type SavedCustomInteraction = {
  id: string;
  label: string;
  /** Optional author notes / meaning; may be empty. */
  description: string;
  createdAt: number;
};

const prefix = "storyobject.customInteractions.";

function key(userKey: string) {
  return `${prefix}${userKey}`;
}

export function loadCustomInteractions(userKey: string): SavedCustomInteraction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(userKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is SavedCustomInteraction =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as SavedCustomInteraction).id === "string" &&
        typeof (x as SavedCustomInteraction).label === "string" &&
        typeof (x as SavedCustomInteraction).description === "string"
    );
  } catch {
    return [];
  }
}

export function saveCustomInteraction(
  userKey: string,
  entry: {
    label: string;
    description?: string;
    id?: string;
    createdAt?: number;
  }
): SavedCustomInteraction[] {
  const prev = loadCustomInteractions(userKey);
  const next: SavedCustomInteraction = {
    id: entry.id ?? `ci-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    label: entry.label.trim(),
    description: (entry.description ?? "").trim(),
    createdAt: entry.createdAt ?? Date.now(),
  };
  const withoutDupLabel = prev.filter(
    (p) => p.label.toLowerCase() !== next.label.toLowerCase()
  );
  const merged = [next, ...withoutDupLabel].slice(0, 80);
  try {
    localStorage.setItem(key(userKey), JSON.stringify(merged));
  } catch {
    /* ignore quota */
  }
  return merged;
}
