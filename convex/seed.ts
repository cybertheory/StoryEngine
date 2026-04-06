import { mutation } from "./_generated/server";

export const seed = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query("universes").first();
    if (existing) return "Already seeded";

    const now = Date.now();

    const userId = await ctx.db.insert("users", {
      clerkId: "seed_user",
      name: "StoryObject Team",
      username: "storyobject",
      avatar: undefined,
      bio: "The creators of StoryObject",
      createdAt: now,
    });

    // --- Universe 1: Sci-Fi ---
    const scifiId = await ctx.db.insert("universes", {
      name: "Exodus Protocol",
      slug: "exodus-protocol",
      description:
        "In 2347, humanity's last colony ship — the Exodus — drifts through uncharted space after Earth's collapse. Political factions vie for control of the ship's dwindling resources while an alien signal pulls them toward the unknown.",
      creatorId: userId,
      tags: ["sci-fi", "space-opera", "survival"],
      visibility: "public",
      objectCount: 6,
      storyCount: 2,
      forkCount: 3,
      likeCount: 142,
      featured: true,
      coverUrl: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1200&q=80",
      createdAt: now - 86400000 * 30,
      updatedAt: now,
    });

    const scifiChars = [
      {
        name: "Captain Aria Voss",
        kind: "character" as const,
        description:
          "Commander of the Exodus. Stoic, brilliant tactician haunted by the decisions that cost lives during Earth's evacuation. Carries a compass that belonged to her daughter.",
        imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80",
      },
      {
        name: "Kael Morrow",
        kind: "character" as const,
        description:
          "Chief engineer and reluctant revolutionary. Once Aria's closest ally, now leads the faction demanding democratic reform on the ship.",
        imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
      },
      {
        name: "The Signal",
        kind: "lore" as const,
        description:
          "A repeating mathematical sequence detected 4 years into the journey. Origin unknown. Appears to encode coordinates to a habitable system — or a trap.",
      },
    ];

    const scifiPlaces = [
      {
        name: "The Exodus Bridge",
        kind: "place" as const,
        description:
          "The nerve center of humanity's last vessel. A cathedral of holographic star charts and blinking consoles, where every decision could mean survival or extinction.",
        imageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80",
      },
      {
        name: "The Underdeck",
        kind: "place" as const,
        description:
          "The lower levels of the Exodus where refugees live in cramped quarters. A thriving black market and the heart of Kael's resistance movement.",
      },
    ];

    const scifiItems = [
      {
        name: "The Compass",
        kind: "item" as const,
        description:
          "An antique brass compass that belonged to Aria's daughter. It doesn't point north in space — but Aria swears it sometimes points toward the Signal's origin.",
      },
    ];

    for (const obj of [...scifiChars, ...scifiPlaces, ...scifiItems]) {
      await ctx.db.insert("objects", {
        universeId: scifiId,
        kind: obj.kind,
        name: obj.name,
        description: obj.description,
        imageUrl: "imageUrl" in obj ? obj.imageUrl : undefined,
        tags: [],
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    }

    // --- Universe 2: Fantasy ---
    const fantasyId = await ctx.db.insert("universes", {
      name: "The Hollow Crown",
      slug: "the-hollow-crown",
      description:
        "A dying kingdom where magic is fueled by memory. As the world forgets its history, reality itself begins to unravel. Five houses compete for the Hollow Crown — a relic said to restore what was lost.",
      creatorId: userId,
      tags: ["fantasy", "dark-fantasy", "political"],
      visibility: "public",
      objectCount: 7,
      storyCount: 5,
      forkCount: 8,
      likeCount: 237,
      coverUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&q=80",
      createdAt: now - 86400000 * 20,
      updatedAt: now,
    });

    const fantasyObjs = [
      {
        name: "Lysara Ashveil",
        kind: "character" as const,
        description:
          "Last keeper of the Memory Vaults. She remembers everything — every joy, every atrocity. The weight of the world's forgotten history is slowly driving her mad.",
        imageUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=80",
      },
      {
        name: "Thorne Blackwood",
        kind: "character" as const,
        description:
          "A sellsword with no memories of his past. Wields a blade that cuts through enchantments. He's searching for whoever stole his history.",
        imageUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80",
      },
      {
        name: "The Hollow Crown",
        kind: "item" as const,
        description:
          "A crown of twisted black iron that appears empty but contains the compressed memories of every ruler who ever wore it. Wearing it grants omniscience — but erases the wearer's own identity.",
      },
      {
        name: "The Forgetting",
        kind: "lore" as const,
        description:
          "A cataclysmic event where the world's collective memory began to fade. Buildings forget their architecture and crumble. People forget their names. Reality dissolves at the edges.",
      },
      {
        name: "Ashenmere",
        kind: "place" as const,
        description:
          "The capital city, half-ruined by the Forgetting. Grand spires stand beside gaps in reality where buildings simply ceased to exist. The Memory Vaults lie beneath.",
        imageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80",
      },
      {
        name: "House Ashveil",
        kind: "faction" as const,
        description:
          "Keepers of memory and knowledge. Once the most powerful house, now reduced to Lysara alone. Their sigil is a silver eye weeping ink.",
      },
      {
        name: "House Blackwood",
        kind: "faction" as const,
        description:
          "Warriors and mercenaries who embraced the Forgetting, believing the past should be destroyed. Their soldiers willingly erase their own memories for battlefield focus.",
      },
    ];

    for (const obj of fantasyObjs) {
      await ctx.db.insert("objects", {
        universeId: fantasyId,
        kind: obj.kind,
        name: obj.name,
        description: obj.description,
        imageUrl: "imageUrl" in obj ? obj.imageUrl : undefined,
        tags: [],
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    }

    // --- Universe 3: Horror ---
    const horrorId = await ctx.db.insert("universes", {
      name: "Frequency 19",
      slug: "frequency-19",
      description:
        "A coastal town where a decommissioned radio tower begins broadcasting again — transmitting conversations that haven't happened yet. Those who listen begin to change.",
      creatorId: userId,
      tags: ["horror", "mystery", "cosmic-horror"],
      visibility: "public",
      objectCount: 5,
      storyCount: 1,
      forkCount: 1,
      likeCount: 89,
      coverUrl:
        "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1200&q=80",
      createdAt: now - 86400000 * 10,
      updatedAt: now,
    });

    const horrorObjs = [
      {
        name: "Dr. Maren Cole",
        kind: "character" as const,
        description:
          "A marine biologist who first decoded the pattern in the broadcasts. Now she hears the frequency everywhere — in the waves, in the static between heartbeats.",
        imageUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80",
      },
      {
        name: "The Tower",
        kind: "place" as const,
        description:
          "A rusting radio tower on the cliffs above Harrow Bay. Decommissioned in 1987. Started broadcasting again on its own. No power source has been found.",
        imageUrl: "https://images.unsplash.com/photo-1509803874385-db7c23652552?w=400&q=80",
      },
      {
        name: "Harrow Bay",
        kind: "place" as const,
        description:
          "A fog-shrouded fishing town of 3,000. Residents have begun sleepwalking to the shoreline at night, standing in the surf and listening.",
      },
      {
        name: "The Frequency",
        kind: "lore" as const,
        description:
          "Broadcasts on exactly 19Hz — below human hearing but felt as dread. Contains encoded speech that, when slowed down, appears to be conversations from the future.",
      },
      {
        name: "The Changed",
        kind: "faction" as const,
        description:
          "Townsfolk who have listened too long. They speak in unison, finish each other's sentences, and their eyes reflect light wrong. They say they're 'tuning in.'",
      },
    ];

    for (const obj of horrorObjs) {
      await ctx.db.insert("objects", {
        universeId: horrorId,
        kind: obj.kind,
        name: obj.name,
        description: obj.description,
        imageUrl: "imageUrl" in obj ? obj.imageUrl : undefined,
        tags: [],
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Seed tags
    for (const tag of [
      { name: "Sci-Fi", slug: "sci-fi", universeCount: 1 },
      { name: "Fantasy", slug: "fantasy", universeCount: 1 },
      { name: "Horror", slug: "horror", universeCount: 1 },
      { name: "Space Opera", slug: "space-opera", universeCount: 1 },
      { name: "Dark Fantasy", slug: "dark-fantasy", universeCount: 1 },
      { name: "Mystery", slug: "mystery", universeCount: 1 },
      { name: "Political", slug: "political", universeCount: 1 },
      { name: "Survival", slug: "survival", universeCount: 1 },
      { name: "Cosmic Horror", slug: "cosmic-horror", universeCount: 1 },
      { name: "Romance", slug: "romance", universeCount: 0 },
      { name: "Original", slug: "original", universeCount: 0 },
    ]) {
      await ctx.db.insert("tags", tag);
    }

    return "Seeded 3 universes with objects and tags";
  },
});

/** Unsplash removed photo-1509248961895 (404). Run once if an old seed still has it. */
const FREQUENCY_19_COVER_FIXED =
  "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1200&q=80";

export const repairFrequency19Cover = mutation({
  handler: async (ctx) => {
    const u = await ctx.db
      .query("universes")
      .withIndex("by_slug", (q) => q.eq("slug", "frequency-19"))
      .unique();
    if (!u) {
      return { ok: false as const, reason: "not_found" };
    }
    const broken =
      u.coverUrl?.includes("photo-1509248961895") ||
      u.coverUrl ===
        "https://images.unsplash.com/photo-1509248961895-40b7e1d27603?w=1200&q=80";
    if (!broken && u.coverUrl === FREQUENCY_19_COVER_FIXED) {
      return { ok: true as const, reason: "already_fixed" };
    }
    if (!broken) {
      return { ok: true as const, reason: "unchanged_custom_cover" };
    }
    await ctx.db.patch(u._id, {
      coverUrl: FREQUENCY_19_COVER_FIXED,
      updatedAt: Date.now(),
    });
    return { ok: true as const, reason: "patched" };
  },
});
