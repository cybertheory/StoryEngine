import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  interpretHeuristic,
  keyframesFromNotepadScript,
  type WorkspaceCommandPatch,
} from "./lib/workspaceHeuristic";
import { STORYOBJECT_SCENE_ANCHOR_TAG } from "./lib/sceneAnchorConstants";

type InterpretPatches = WorkspaceCommandPatch;

export type InterpretCommandResult =
  | { ok: false; message: string; patches: undefined }
  | { ok: true; message: string; patches: InterpretPatches | undefined };

/**
 * Interprets a short natural-language command and returns canvas/timeline patches.
 * Only the story author can run this. Deterministic heuristics (no external LLM required).
 *
 * Lives in `workbenchInterpret` (not `workspaceAgent`) so `api.*` has no self-referential
 * module — Convex `tsc` can typecheck and push this action reliably.
 */
export const interpretCommand = action({
  args: {
    sessionToken: v.string(),
    storyId: v.id("stories"),
    command: v.string(),
    clientContext: v.object({
      currentTick: v.number(),
      placedObjectIds: v.optional(v.array(v.string())),
    }),
    /** When true, only parse interaction beats from text; always returns addKeyframes (possibly []). */
    syncBeatsFromNotepad: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<InterpretCommandResult> => {
    const gate = await ctx.runQuery(api.stories.workspaceAgentGate, {
      storyId: args.storyId,
      sessionToken: args.sessionToken,
    });

    if (!gate.ok) {
      return {
        ok: false,
        message: gate.message,
        patches: undefined,
      };
    }

    const universeId: Id<"universes"> = gate.universeId;

    const objectRows = await ctx.runQuery(api.objects.listByUniverse, {
      universeId,
      sessionToken: args.sessionToken,
    });

    const ambientId =
      objectRows.find((o: Doc<"objects">) =>
        o.tags.includes(STORYOBJECT_SCENE_ANCHOR_TAG)
      )?._id ?? null;

    const objects = objectRows.map((o: Doc<"objects">) => ({
      _id: o._id as string,
      name: o.name,
    }));
    const placed = new Set(args.clientContext.placedObjectIds ?? []);

    if (args.syncBeatsFromNotepad) {
      const kfs = keyframesFromNotepadScript(
        args.command,
        objects,
        ambientId as string | null
      );
      return {
        ok: true,
        message:
          kfs.length === 0
            ? "No beats parsed — use two @ names and a verb, chain with who then / who also, or one @ name plus a solo action (e.g. rides off)."
            : `Synced ${kfs.length} beat(s) from notepad.`,
        patches: { addKeyframes: kfs },
      };
    }

    const { message, patches } = interpretHeuristic(
      args.command,
      objects,
      placed,
      args.clientContext.currentTick,
      ambientId as string | null
    );

    const hasWork =
      (patches.addPlacements?.length ?? 0) > 0 ||
      (patches.addKeyframes?.length ?? 0) > 0;

    return {
      ok: true,
      message,
      patches: hasWork
        ? {
            addPlacements: patches.addPlacements,
            addKeyframes: patches.addKeyframes,
          }
        : undefined,
    };
  },
});
