# Deploying Refill (Convex + Vercel)

This app is Next.js (App Router) on Vercel, backed by Convex, using
`@convex-dev/auth` (email + password, **client-side only** — see
`app/providers.tsx`, no `middleware.ts`). Convex has two independent
deployments: `dev` (used by `npx convex dev` locally) and `prod` (used by
Vercel). Each deployment has its own copy of every env var below — setting
something on dev does not set it on prod.

## 1. Local dev

```
npm install
npx convex dev
```

`npx convex dev` links the project and writes `.env.local`:

```
CONVEX_DEPLOYMENT=dev:<slug>            # local only, tells the CLI which deployment to talk to
NEXT_PUBLIC_CONVEX_URL=https://<dev>.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://<dev>.convex.site
```

Then set up Convex Auth's signing keys against the **dev** deployment (run
once, or whenever keys need rotating):

```
npx @convex-dev/auth
```

This pushes `JWT_PRIVATE_KEY`, `JWKS`, and `SITE_URL` as environment
variables on the Convex **dev** deployment (dashboard → Settings →
Environment Variables, or `npx convex env list`). `SITE_URL` should be
`http://localhost:3000` for dev.

## 2. Env vars — where each one lives

**Convex dev deployment** (`npx convex env set <NAME> <VALUE>`, no `--prod` flag):
| Var | Set by | Value |
|---|---|---|
| `JWT_PRIVATE_KEY` | `npx @convex-dev/auth` | signing key |
| `JWKS` | `npx @convex-dev/auth` | public key set |
| `SITE_URL` | `npx @convex-dev/auth` | `http://localhost:3000` |

**Convex prod deployment** (`npx convex env set <NAME> <VALUE> --prod`) —
already configured for this project:
| Var | Set by | Value |
|---|---|---|
| `JWT_PRIVATE_KEY` | `npx @convex-dev/auth --prod` | signing key (different from dev's) |
| `JWKS` | `npx @convex-dev/auth --prod` | public key set (different from dev's) |
| `SITE_URL` | `npx @convex-dev/auth --prod` | `https://refill-livid.vercel.app/` |

`CONVEX_SITE_URL` (no `NEXT_PUBLIC_` prefix, read by `convex/auth.config.ts`)
is auto-provided by Convex per deployment — you never set this yourself.

**Vercel (Project Settings → Environment Variables)**:
| Var | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | `https://<prod>.convex.cloud` | read in `app/providers.tsx` |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | `https://<prod>.convex.site` | not read by app code today, but `convex dev` always provisions it locally — set it on Vercel too so dev/prod parity holds if a future feature (e.g. OAuth, direct HTTP action calls) needs it client-side |
| `CONVEX_DEPLOY_KEY` | prod deploy key from Convex dashboard → Settings → Deploy Keys | only needed if the Vercel build runs `convex deploy` (see below) |

No other server-side env vars are needed on Vercel — there's no
`middleware.ts` or server component reading the Convex auth session; all
auth state lives in the browser via `ConvexAuthProvider`.

## 3. Wiring the Vercel build to prod Convex

`convex/_generated/*` must be current, and prod must be deployed
independently of dev. Set the Vercel **build command** to:

```
npx convex deploy --cmd 'npm run build'
```

This deploys `convex/` functions to prod and runs codegen against the prod
schema before `next build` runs. Requires `CONVEX_DEPLOY_KEY` (above).

## 4. Verifying a deploy

- [ ] `npx convex env list --prod` shows `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`
      (`SITE_URL` matches the live Vercel domain, not `localhost`)
- [ ] Vercel has `NEXT_PUBLIC_CONVEX_URL` / `NEXT_PUBLIC_CONVEX_SITE_URL`
      pointing at the `.convex.cloud` / `.convex.site` prod URLs, not dev
- [ ] Sign up / sign in works end-to-end on the deployed URL
- [ ] If the Vercel domain ever changes, re-run `npx @convex-dev/auth --prod`
      (or manually update `SITE_URL`) so it matches — a stale `SITE_URL`
      breaks auth cookie scoping
