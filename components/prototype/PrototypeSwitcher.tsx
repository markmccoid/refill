"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

type VariantMeta = { key: string; name: string };

export function PrototypeSwitcher({ variants }: { variants: VariantMeta[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentKey = searchParams.get("variant") ?? variants[0]?.key ?? "A";
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === currentKey)
  );
  const current = variants[index] ?? variants[0];

  const cycle = (delta: number) => {
    const next = variants[(index + delta + variants.length) % variants.length];
    const params = new URLSearchParams(searchParams.toString());
    params.set("variant", next.key);
    router.replace(`?${params.toString()}`);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.key === "ArrowLeft") cycle(-1);
      if (e.key === "ArrowRight") cycle(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-full border border-amber-400/60 bg-amber-950/95 px-3 py-2 text-amber-100 shadow-lg backdrop-blur">
      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80 mr-1">
        Prototype
      </span>
      <button
        type="button"
        onClick={() => cycle(-1)}
        className="rounded-full px-2 py-1 hover:bg-amber-800/60"
        aria-label="Previous variant"
      >
        ←
      </button>
      <span className="min-w-[10rem] text-center text-sm font-medium">
        {current.key} — {current.name}
      </span>
      <button
        type="button"
        onClick={() => cycle(1)}
        className="rounded-full px-2 py-1 hover:bg-amber-800/60"
        aria-label="Next variant"
      >
        →
      </button>
    </div>
  );
}
