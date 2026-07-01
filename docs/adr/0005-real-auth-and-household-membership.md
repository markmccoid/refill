# Real auth replaces the localStorage demo household

Identity was a value in browser `localStorage` (`demo-household-id`). When that
key was absent — cleared storage, a new browser, Safari's ~7-day storage purge,
or a first visit on a different origin — `useDemoHousehold` created a *fresh*
household and **seeded sample supplements** (Omega-3 Fish Oil, Vitamin K2). The
user's real data was never deleted; it was orphaned under the old household id
while the app showed a new seeded one. That looked like "my data reset to the
defaults on deploy."

We replace this with **Convex Auth (email + password)** and a real user → household link.

## Decisions

- **Convex Auth, Password provider.** `authTables` added to the schema; auth HTTP
  routes registered in `convex/http.ts`; `convex/auth.ts` configures the provider.
  Keys (`JWT_PRIVATE_KEY`, `JWKS`) and `SITE_URL` are deployment env vars.
- **Membership join table, not an owner field.** `householdMembers`
  (`userId`, `householdId`, `role: owner|member`) with `by_user`/`by_household`
  indexes. Single-user today = one `owner` row. **Sharing later is one insert** —
  no schema change, no migration. This is the "multi-tenant ready now, single-user
  UI" choice the user asked for.
- **No seeding.** `households.ensureForCurrentUser` creates an *empty* household +
  owner membership on first sign-in (idempotent). The old sample-data seeder is
  deleted. `useHousehold()` (replacing `useDemoHousehold()`) returns the signed-in
  user's household and triggers the ensure-once.
- **Backend derives trust from the session, not the client.** `convex/authz.ts`
  provides `requireUserId`, `requireMembership`, and per-resource
  `require{Supplement,Person,Group}Access`. Every household-scoped query/mutation
  verifies the caller belongs to the household (or owns the resource) before
  reading/writing. This is what makes the future sharing safe — a client can't act
  on another household by passing its id.
- **Route protection** via `middleware.ts` (Convex Auth Next.js middleware):
  unauthenticated visits to app routes redirect to `/signin`; authenticated visits
  to `/signin` redirect to `/dashboard`.

## Deferred / not done

- Old orphaned prod data is **not** recovered (user: "not much in it yet").
- DSLD label functions (`dsld.ts`, `supplementFacts.ts`) are not yet membership-
  gated — they key off a supplement the user owns; harden before enabling sharing.
- Invite/sharing UI (adding a second member) — the data model supports it; no UI.
- Password reset / email verification flows.
