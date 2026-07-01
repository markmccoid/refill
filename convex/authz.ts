import { getAuthUserId } from "@convex-dev/auth/server";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

/** The signed-in user's id, or throw. Every app function goes through auth now. */
export async function requireUserId(ctx: Ctx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated.");
  return userId;
}

/** All household ids the signed-in user belongs to. */
async function membershipHouseholdIds(
  ctx: Ctx,
  userId: Id<"users">
): Promise<Id<"households">[]> {
  const memberships = await ctx.db
    .query("householdMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return memberships.map((m) => m.householdId);
}

/** The household the signed-in user belongs to (their first membership), or null. */
export async function getUserHouseholdId(
  ctx: Ctx
): Promise<Id<"households"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const ids = await membershipHouseholdIds(ctx, userId);
  return ids[0] ?? null;
}

/** Require an authenticated user who belongs to a household; returns its id. */
export async function requireHousehold(ctx: Ctx): Promise<Id<"households">> {
  const householdId = await getUserHouseholdId(ctx);
  if (!householdId) throw new Error("No household for this user.");
  return householdId;
}

/**
 * Verify the signed-in user is a member of `householdId`. Prevents one account
 * from reading/writing another household's data once sharing exists — the check
 * that makes the multi-tenant model safe.
 */
export async function requireMembership(
  ctx: Ctx,
  householdId: Id<"households">
): Promise<void> {
  const userId = await requireUserId(ctx);
  const ids = await membershipHouseholdIds(ctx, userId);
  if (!ids.includes(householdId)) {
    throw new Error("Not a member of this household.");
  }
}

/**
 * Verify the signed-in user may access a supplement (it belongs to one of their
 * households) and return it. Used by supplement-scoped functions that only take
 * a supplementId.
 */
export async function requireSupplementAccess(
  ctx: Ctx,
  supplementId: Id<"supplements">
) {
  const supplement = await ctx.db.get(supplementId);
  if (!supplement) throw new Error("Supplement not found.");
  await requireMembership(ctx, supplement.householdId);
  return supplement;
}

/** Verify the signed-in user may access a person and return it. */
export async function requirePersonAccess(ctx: Ctx, personId: Id<"people">) {
  const person = await ctx.db.get(personId);
  if (!person) throw new Error("Person not found.");
  await requireMembership(ctx, person.householdId);
  return person;
}

/** Verify the signed-in user may access a group and return it. */
export async function requireGroupAccess(ctx: Ctx, groupId: Id<"groups">) {
  const group = await ctx.db.get(groupId);
  if (!group) throw new Error("Group not found.");
  await requireMembership(ctx, group.householdId);
  return group;
}
