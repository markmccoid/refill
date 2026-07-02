"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";

/** Password input with a show/hide toggle (each field keeps its own state). */
function PasswordInput({
  value,
  onChange,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative mt-1">
      <input
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-black/15 rounded-lg px-3 py-2 pr-10 text-sm"
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text"
        tabIndex={-1}
      >
        {visible ? (
          // open eye — password is currently visible
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ) : (
          // slashed eye — password is currently hidden
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
            <line x1="2" y1="2" x2="22" y2="22" />
          </svg>
        )}
      </button>
    </div>
  );
}

/**
 * Email + password sign in / sign up (Convex Auth). Replaces the old anonymous
 * localStorage demo household — identity is now a real account.
 */
export default function SignInPage() {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();

  // Already signed in (e.g. returning visit) → go straight to the app.
  useEffect(() => {
    if (isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, router]);

  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (flow === "signUp" && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
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
            <PasswordInput
              value={password}
              onChange={setPassword}
              autoComplete={flow === "signIn" ? "current-password" : "new-password"}
            />
          </div>
          {flow === "signUp" && (
            <div>
              <label className="text-xs font-semibold text-text-label uppercase tracking-wide">
                Confirm password
              </label>
              <PasswordInput
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
              />
            </div>
          )}

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
              setConfirmPassword("");
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
