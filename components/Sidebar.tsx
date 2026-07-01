"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Supplements", href: "/supplements" },
  { label: "People", href: "/people" },
  { label: "Costs", href: "/costs" },
  { label: "Buy", href: "/buy" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-48 bg-surface-alt border-r border-black/7 p-4 flex flex-col">
      {/* Brand */}
      <div className="mb-6 pb-4 border-b border-black/7">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary flex-shrink-0" />
          <span className="font-bold text-sm text-text tracking-tight">Refill</span>
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
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Avatars */}
      <div className="pt-4 border-t border-black/7 flex items-center gap-2">
        {/* Mark - Green */}
        <div
          className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white text-xs font-bold shadow-sm"
          title="Mark"
        >
          M
        </div>
        {/* Lori - Amber */}
        <div
          className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-xs font-bold shadow-sm"
          title="Lori"
        >
          L
        </div>
      </div>
    </aside>
  );
}
