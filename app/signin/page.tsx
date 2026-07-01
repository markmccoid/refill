"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";

/**
 * Email + password sign in / sign up (Convex Auth). Replaces the old anonymous
 * localStorage demo household — identity is now a real account.
 */
export default function SignInPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();

  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn("password", { email, password, flow });
      router.push("/dashboard");
    } catch {
      setError(
        flow === "signIn"
          ? "Couldn't sign in. Check your email and password."
          : "Couldn't create that account. Try a different email."
      );
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-8">
      <div className="card w-full max-w-sm p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Refill</h1>
          <p className="text-sm text-text-muted mt-1">
            {flow === "signIn" ? "Sign in to your household" : "Create your account"}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-text-label uppercase tracking-wide">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full border border-black/15 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-label uppercase tracking-wide">
              Password
            </label>
            <input
              type="password"
              autoComplete={flow === "signIn" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border border-black/15 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full text-sm py-2.5 disabled:opacity-40"
          >
            {busy
              ? "Working…"
              : flow === "signIn"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-text-muted">
          {flow === "signIn" ? "New here? " : "Already have an account? "}
          <button
            onClick={() => {
              setFlow(flow === "signIn" ? "signUp" : "signIn");
              setError(null);
            }}
            className="text-primary font-semibold hover:underline"
          >
            {flow === "signIn" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
