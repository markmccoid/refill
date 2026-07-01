"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useDemoHousehold } from "@/hooks/useDemoHousehold";
import { PillBottle } from "@/components/PillBottle";
import {
  getSupplementStatus,
  getDaysLeft,
  getBottleStates,
  getSpendRatePerDay,
} from "@/lib/supplement-utils";

export default function DashboardPage() {
  const householdId = useDemoHousehold();

  const supplements = useQuery(
    api.supplements.list,
    householdId ? { householdId } : "skip"
  );

  if (!householdId) {
    return <div className="text-center py-12">Loading household...</div>;
  }

  if (!supplements) {
    return <div className="text-center py-12">Loading supplements...</div>;
  }

  // Derive live on-hand, bottle breakdown, run-out, and spend per supplement.
  const derived = supplements
    .map((s) => {
      const anchoredAt = s.anchoredAt ?? s.createdAt ?? Date.now();
      const breakdown = getBottleStates(
        s.bottles ?? [],
        anchoredAt,
        s.consumptionRate
      );
      const daysLeft = getDaysLeft(breakdown.onHand, s.consumptionRate);
      const monthlySpend =
        getSpendRatePerDay(s.consumptionRate, breakdown.openCostPerPill) * 30;
      return {
        s,
        breakdown,
        daysLeft,
        monthlySpend,
        status: getSupplementStatus(daysLeft),
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const needsAttention = derived.filter((d) => d.daysLeft <= 7).length;
  const nextToRunOut = derived[0];
  const monthlySpend = derived.reduce((sum, d) => sum + d.monthlySpend, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-text-muted text-sm mt-1">
            {supplements.length} supplements · 2 people · tracked as of{" "}
            {new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
        <Link href="/supplements/new" className="btn-primary">
          + Add supplement
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 space-y-2">
          <div className="text-xs text-text-label font-semibold">
            Need attention
          </div>
          <div className="text-2xl font-bold text-critical">{needsAttention}</div>
          <div className="text-xs text-text-muted">of {supplements.length}</div>
        </div>

        <div className="card p-4 space-y-2">
          <div className="text-xs text-text-label font-semibold">
            Next to run out
          </div>
          {nextToRunOut && (
            <>
              <div className="font-semibold text-sm leading-tight">
                {nextToRunOut.s.name}
              </div>
              <div className="text-lg font-mono font-bold text-critical">
                {isFinite(nextToRunOut.daysLeft)
                  ? `${nextToRunOut.daysLeft} days`
                  : "—"}
              </div>
            </>
          )}
        </div>

        <div className="card p-4 space-y-2">
          <div className="text-xs text-text-label font-semibold">
            Monthly spend
          </div>
          <div className="text-2xl font-mono font-bold">
            ${monthlySpend.toFixed(2)}
          </div>
          <div className="text-xs text-text-muted">household · consumption</div>
        </div>
      </div>

      {/* Critical Banner */}
      {nextToRunOut && nextToRunOut.daysLeft <= 7 && (
        <div className="status-critical p-4 rounded-md flex items-center justify-between">
          <div>
            <div className="font-semibold">
              <span className="inline-block w-2 h-2 rounded-full bg-current mr-2"></span>
              {nextToRunOut.s.name} runs out in {nextToRunOut.daysLeft} days —
              only {nextToRunOut.breakdown.onHand} left.
            </div>
          </div>
          <Link href={`/buy/${nextToRunOut.s._id}`} className="btn-primary bg-critical hover:bg-critical/90">
            Find best price
          </Link>
        </div>
      )}

      {/* Pill Jars Grid */}
      <div>
        <h2 className="text-xl font-bold tracking-tight mb-4">Your shelf</h2>
        <p className="text-text-muted text-sm mb-6">
          How full each jar is, and how long it'll last
        </p>
        <div className="grid grid-cols-5 gap-4">
          {derived.map(({ s, breakdown, daysLeft, status }) => (
            <div key={s._id} className="card p-4 flex flex-col items-center space-y-3">
              <PillBottle fillPct={breakdown.openFillPct} status={status} />
              <div className="text-center">
                <h3 className="font-bold text-sm">{s.name}</h3>
                <p className="text-xs font-mono text-text-muted mt-1">
                  {breakdown.onHand} on hand
                  {breakdown.bottleCount > 1 &&
                    ` · ${breakdown.bottleCount} bottles`}
                </p>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center justify-center w-full status-${status}`}>
                {status === "critical" && `Critical · ${daysLeft}d`}
                {status === "low" && `Low · ${daysLeft}d`}
                {status === "on-track" && `On track`}
                {status === "stocked" && `Stocked`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
