import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isSignInPage = createRouteMatcher(["/signin"]);
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/supplements(.*)",
  "/people(.*)",
  "/costs(.*)",
  "/buy(.*)",
]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  // Signed-in users never see the login page.
  if (isSignInPage(request) && (await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/dashboard");
  }
  // App routes require a session; bounce anonymous visitors to sign in.
  if (isProtectedRoute(request) && !(await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/signin");
  }
  return undefined;
});

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
