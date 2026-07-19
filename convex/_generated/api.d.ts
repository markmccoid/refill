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
import type * as authz from "../authz.js";
import type * as bottles from "../bottles.js";
import type * as candidateProducts from "../candidateProducts.js";
import type * as candidateSeeding from "../candidateSeeding.js";
import type * as consumption from "../consumption.js";
import type * as costs from "../costs.js";
import type * as crons from "../crons.js";
import type * as dosages from "../dosages.js";
import type * as dsld from "../dsld.js";
import type * as groups from "../groups.js";
import type * as households from "../households.js";
import type * as http from "../http.js";
import type * as insights from "../insights.js";
import type * as inventory from "../inventory.js";
import type * as migrations from "../migrations.js";
import type * as people from "../people.js";
import type * as restock from "../restock.js";
import type * as retailers from "../retailers.js";
import type * as savedLinks from "../savedLinks.js";
import type * as supplementFacts from "../supplementFacts.js";
import type * as supplements from "../supplements.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authz: typeof authz;
  bottles: typeof bottles;
  candidateProducts: typeof candidateProducts;
  candidateSeeding: typeof candidateSeeding;
  consumption: typeof consumption;
  costs: typeof costs;
  crons: typeof crons;
  dosages: typeof dosages;
  dsld: typeof dsld;
  groups: typeof groups;
  households: typeof households;
  http: typeof http;
  insights: typeof insights;
  inventory: typeof inventory;
  migrations: typeof migrations;
  people: typeof people;
  restock: typeof restock;
  retailers: typeof retailers;
  savedLinks: typeof savedLinks;
  supplementFacts: typeof supplementFacts;
  supplements: typeof supplements;
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
