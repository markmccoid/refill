import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

// Email + password auth (ADR-0005 / auth-direction). On successful sign-in the
// client calls households.ensureForCurrentUser to attach a household.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});
