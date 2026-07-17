"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { useHousehold } from "@/hooks/useHousehold";
import { ThemeToggle } from "@/components/ThemeToggle";

const nav = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Supplements", href: "/supplements" },
  { label: "People", href: "/people" },
  { label: "Costs", href: "/costs" },
  { label: "Restock", href: "/restock" },
  // The overview query resets any report currently open on the Insights page.
  { label: "Insights", href: "/insights?view=overview" },
];

const AVATAR_GRADIENTS: Record<string, string> = {
  green: "from-primary to-primary-dark",
  amber: "from-amber-400 to-amber-600",
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuthActions();
  const householdId = useHousehold();
  const people = useQuery(
    api.people.list,
    householdId ? { householdId } : "skip"
  );
  // Restock safety net (ADR-0006): supplements running out within the forecast
  // window that aren't on the plan. Informs — never adds anything itself.
  const restockBadge = useQuery(
    api.restock.badgeCount,
    householdId ? { householdId } : "skip"
  );

  const handleSignOut = async () => {
    await signOut();
    router.push("/signin");
  };

  return (
    <aside className="mobile-nav fixed inset-x-0 bottom-0 z-40 flex h-[calc(4.25rem+env(safe-area-inset-bottom))] w-full flex-row border-t border-border bg-surface px-1 pt-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-18px_rgba(20,40,30,0.4)] md:static md:h-auto md:w-48 md:flex-col md:border-r md:border-t-0 md:bg-surface md:p-4 md:shadow-none">
      {/* Brand */}
      <div className="mb-1 hidden pb-1 border-b border-border md:block">
        <div className="flex items-center">
          <Image
            src="/refill-logo.png"
            alt="Refill"
            width={300}
            height={45}
            className="rounded-md flex-shrink-0"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex min-w-0 flex-1 flex-row justify-around gap-0 md:block md:space-y-0.5">
        {nav.map((item) => {
          const isActive = pathname.startsWith("/insights")
            ? item.href.startsWith("/insights")
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={`flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-md px-1 py-1.5 text-center text-[10px] transition-colors md:block md:px-3 md:py-2 md:text-left md:text-sm ${
                isActive
                  ? "bg-primary-light text-primary font-semibold"
                  : "text-text-muted hover:text-text hover:bg-text/5 font-medium"
              }`}
            >
              <span className="flex items-center justify-between">
                <span className="truncate">{item.label}</span>
                {item.href.startsWith("/restock") &&
                  typeof restockBadge === "number" &&
                  restockBadge > 0 && (
                    <span className="ml-2 min-w-5 h-5 px-1.5 rounded-full bg-low text-white text-[11px] font-bold flex items-center justify-center">
                      {restockBadge}
                    </span>
                  )}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] right-3 z-50 flex items-center gap-2 rounded-lg border border-border-strong bg-surface px-2 py-1.5 shadow-card md:hidden">
        <ThemeToggle />
        <button
          onClick={handleSignOut}
          className="min-h-11 px-2 text-xs font-medium text-text-muted"
        >
          Sign out
        </button>
      </div>

      {/* People + sign out */}
      <div className="hidden pt-4 border-t border-border space-y-3 md:block">
        {people && people.length > 0 && (
          <div className="flex items-center gap-2">
            {people.map((p) => (
              <div
                key={p._id}
                className={`w-8 h-8 rounded-full bg-gradient-to-br ${
                  AVATAR_GRADIENTS[p.color] ?? "from-slate-400 to-slate-600"
                } flex items-center justify-center text-white text-xs font-bold shadow-sm`}
                title={p.name}
              >
                {p.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        )}
        <ThemeToggle />
        <button
          onClick={handleSignOut}
          className="w-full text-left text-xs font-medium text-text-muted hover:text-text transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
