"use client";

import Link from "next/link";
import type { SupplementStatus } from "@/lib/supplement-utils";

const MS_PER_DAY = 86_400_000;

export interface TimelineRow {
  id: string;
  name: string;
  onHand: number; // pills left now
  capacity: number; // "of N" — the anchor / starting count for context
  daysLeft: number; // Infinity if nobody takes it
  status: SupplementStatus;
  href?: string; // link target; defaults to the supplement detail page
  incomingCount?: number;
  nextIncomingAt?: number | null;
}

// Three visual buckets for the legend (stocked folds into "on track").
const BAR_BG: Record<SupplementStatus, string> = {
  critical: "bg-critical",
  low: "bg-low",
  "on-track": "bg-on-track",
  stocked: "bg-stocked",
};

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function RunOutTimeline({ rows }: { rows: TimelineRow[] }) {
  const now = Date.now();

  // Horizon: end of the month the longest-lasting supplement runs out in,
  // but always show at least ~5 months so short runways don't look cramped.
  const finiteDays = rows.map((r) => r.daysLeft).filter((d) => isFinite(d));
  const maxDays = finiteDays.length ? Math.max(...finiteDays) : 0;
  const runOutHorizon = new Date(now + Math.max(maxDays, 120) * MS_PER_DAY);
  const minHorizon = addMonths(new Date(now), 5);
  const horizonDate = endOfMonth(
    runOutHorizon > minHorizon ? runOutHorizon : minHorizon
  );

  const start = now;
  const span = horizonDate.getTime() - start;
  const pct = (t: number) => Math.max(0, Math.min(100, ((t - start) / span) * 100));

  // Month tick labels: the 1st of each month that falls after "now".
  const ticks: { label: string; left: number }[] = [];
  let cursor = startOfMonth(new Date(now));
  while (cursor.getTime() <= horizonDate.getTime()) {
    if (cursor.getTime() >= start) {
      ticks.push({
        label: cursor.toLocaleDateString("en-US", { month: "short" }),
        left: pct(cursor.getTime()),
      });
    }
    cursor = addMonths(cursor, 1);
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold tracking-tight">Run-out timeline</h2>
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <LegendDot className="bg-critical" label="Critical" />
          <LegendDot className="bg-low" label="Low" />
          <LegendDot className="bg-on-track" label="On track" />
          <LegendDot className="bg-primary/40" label="Incoming" />
        </div>
      </div>

      {/* Column widths shared by the header and every row. */}
      <div className="grid grid-cols-[200px_1fr_64px] items-center">
        {/* Month header */}
        <div />
        <div className="relative h-5">
          {ticks.map((t) => (
            <span
              key={t.label}
              className="absolute top-0 text-xs text-text-faint"
              style={{ left: `${t.left}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
        <div />
      </div>

      <div className="space-y-2.5">
        {rows.map((r) => {
          const runOut = isFinite(r.daysLeft)
            ? new Date(now + r.daysLeft * MS_PER_DAY)
            : null;
          const incomingLeft =
            r.nextIncomingAt && r.incomingCount && r.incomingCount > 0
              ? pct(r.nextIncomingAt)
              : null;
          const barPct = runOut
            ? Math.max(6, pct(runOut.getTime()))
            : 100;
          const label = runOut
            ? runOut.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "—";

          return (
            <div
              key={r.id}
              className="grid grid-cols-[200px_1fr_64px] items-center"
            >
              <div className="pr-4">
                <Link
                  href={r.href ?? `/supplements/${r.id}`}
                  className="font-bold text-base hover:text-primary transition-colors"
                >
                  {r.name}
                </Link>
                <div className="text-xs font-mono text-text-faint mt-0.5">
                  {r.onHand} of {r.capacity} left
                  {!!r.incomingCount && r.incomingCount > 0 && (
                    <span> · +{r.incomingCount} incoming</span>
                  )}
                </div>
              </div>

              {/* Track + bar */}
              <div className="relative h-7 rounded-full bg-black/[0.04]">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full flex items-center justify-end px-3 ${
                    runOut ? BAR_BG[r.status] : "bg-text/10"
                  }`}
                  style={{ width: `${barPct}%`, minWidth: "3.5rem" }}
                >
                  <span
                    className={`text-xs font-bold whitespace-nowrap ${
                      runOut ? "text-white" : "text-text-faint"
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {incomingLeft !== null && (
                  <div
                    className="absolute inset-y-0 w-24 -translate-x-1/2 rounded-full border border-primary/40 bg-primary-light flex items-center justify-center px-2"
                    style={{ left: `${incomingLeft}%` }}
                    title={`${r.incomingCount} incoming`}
                  >
                    <span className="text-[10px] font-bold text-primary whitespace-nowrap">
                      Incoming
                    </span>
                  </div>
                )}
              </div>

              <div
                className={`text-xs font-mono text-right pl-3 ${
                  r.status === "critical"
                    ? "text-critical font-bold"
                    : r.status === "low"
                    ? "text-low"
                    : "text-text-muted"
                }`}
              >
                {isFinite(r.daysLeft) ? `${r.daysLeft} days` : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${className}`} />
      {label}
    </span>
  );
}
