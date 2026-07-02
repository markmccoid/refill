"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { useHousehold } from "@/hooks/useHousehold";

const nav = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Supplements", href: "/supplements" },
  { label: "People", href: "/people" },
  { label: "Costs", href: "/costs" },
  { label: "Restock", href: "/restock" },
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
    <aside className="w-48 bg-surface-alt border-r border-black/7 p-4 flex flex-col">
      {/* Brand */}
      <div className="mb-1 pb-1 border-b border-black/7 ">
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
      <nav className="flex-1 space-y-0.5">
        {nav.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-primary-light text-primary font-semibold"
                  : "text-text-muted hover:text-text hover:bg-black/5 font-medium"
              }`}
              style={{
                fontSize: "13.5px",
                padding: "9px 11px",
                borderRadius: "8px",
              }}
            >
              <span className="flex items-center justify-between">
                {item.label}
                {item.href === "/restock" &&
                  typeof restockBadge === "number" &&
                  restockBadge > 0 && (
                    <span className="ml-2 min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center">
                      {restockBadge}
                    </span>
                  )}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* People + sign out */}
      <div className="pt-4 border-t border-black/7 space-y-3">
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
