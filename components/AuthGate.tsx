"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";

/**
 * Client-side route guard (replaces the SSR middleware, which didn't play well
 * with Next 16). Sends unauthenticated visitors to /signin; renders the app only
 * once a session is confirmed. Auth state comes from the localStorage-backed
 * ConvexAuthProvider, so it survives refreshes.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/signin");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-text-muted">
        Loading…
      </div>
    );
  }
  if (!isAuthenticated) return null;

  return <>{children}</>;
}
