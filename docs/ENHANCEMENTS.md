# Future Enhancements

Planned work that isn't scheduled yet. Remove items when they ship.

## Password reset (email OTP)

Convex Auth's `Password` provider has reset support built in — it emails a
one-time code, the user enters it with a new password. Everything is in place
except an email sender.

1. Create a [Resend](https://resend.com) account (the provider Convex Auth
   documents; free tier 100 emails/day) and grab an API key. Without a
   verified domain Resend only delivers to the account owner's own address —
   fine for testing.
2. Set the key on the deployment: `npx convex env set RESEND_API_KEY re_...`
3. `npm install resend`, then add `convex/ResendOTPPasswordReset.ts` — an
   Email provider that generates an 8-digit code and emails it.
4. Wire it up in `convex/auth.ts`: `Password({ reset: ResendOTPPasswordReset })`.
5. Add a "Forgot password?" flow to `app/signin/page.tsx`, two steps:
   - `signIn("password", { flow: "reset", email })` — sends the code
   - `signIn("password", { flow: "reset-verification", email, code, newPassword })`
     — sets the new password and signs the user in

## Other auth hardening (from the multi-tenant review, 2026-07-01)

- Email verification on sign-up (same shape as reset: `verify:` option on the
  `Password` provider + an email OTP provider).
- "Active household" selector once household sharing (multiple
  `householdMembers` rows per user) becomes real — `getUserHouseholdId`
  currently returns the user's first membership.
