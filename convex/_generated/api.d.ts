/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as fandomImport from "../fandomImport.js";
import type * as fandomPipeline from "../fandomPipeline.js";
import type * as fandomScraper from "../fandomScraper.js";
import type * as fandomScraperInternal from "../fandomScraperInternal.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_anthropic from "../lib/anthropic.js";
import type * as lib_sceneAnchorConstants from "../lib/sceneAnchorConstants.js";
import type * as lib_workspaceHeuristic from "../lib/workspaceHeuristic.js";
import type * as lib_workspaceModel from "../lib/workspaceModel.js";
import type * as likes from "../likes.js";
import type * as notepadAssist from "../notepadAssist.js";
import type * as objects from "../objects.js";
import type * as proseGeneration from "../proseGeneration.js";
import type * as seed from "../seed.js";
import type * as stories from "../stories.js";
import type * as universes from "../universes.js";
import type * as users from "../users.js";
import type * as workbenchInterpret from "../workbenchInterpret.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  crons: typeof crons;
  fandomImport: typeof fandomImport;
  fandomPipeline: typeof fandomPipeline;
  fandomScraper: typeof fandomScraper;
  fandomScraperInternal: typeof fandomScraperInternal;
  "lib/access": typeof lib_access;
  "lib/anthropic": typeof lib_anthropic;
  "lib/sceneAnchorConstants": typeof lib_sceneAnchorConstants;
  "lib/workspaceHeuristic": typeof lib_workspaceHeuristic;
  "lib/workspaceModel": typeof lib_workspaceModel;
  likes: typeof likes;
  notepadAssist: typeof notepadAssist;
  objects: typeof objects;
  proseGeneration: typeof proseGeneration;
  seed: typeof seed;
  stories: typeof stories;
  universes: typeof universes;
  users: typeof users;
  workbenchInterpret: typeof workbenchInterpret;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
