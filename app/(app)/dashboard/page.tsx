"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useHousehold } from "@/hooks/useHousehold";
import { RunOutTimeline } from "@/components/RunOutTimeline";
import {
  getSupplementStatus,
  getDaysLeft,
  getBottleStatesForDosages,
  getGroupStateForDosages,
  getSpendRatePerDay,
} from "@/lib/supplement-utils";

export default function DashboardPage() {
  const householdId = useHousehold();

  const inventory = useQuery(
    api.inventory.listForHousehold,
    householdId ? { householdId } : "skip"
  );

  const people = useQuery(
    api.people.list,
    householdId ? { householdId } : "skip"
  );
  const activePeopleCount = (people ?? []).filter(
    (p) => p.status !== "disabled"
  ).length;

  if (!householdId) {
    return <div className="text-center py-12">Loading household...</div>;
  }

  if (!inventory) {
    return <div className="text-center py-12">Loading supplements...</div>;
  }

  const { solos: supplements, groups } = inventory;

  // Ungrouped supplements deplete independently (unchanged).
  const soloDerived = supplements.map((s) => {
      const anchoredAt = s.anchoredAt ?? s.createdAt ?? Date.now();
      const breakdown = getBottleStatesForDosages(
        s.bottles ?? [],
        anchoredAt,
        s.dosages ?? []
      );
      const daysLeft = getDaysLeft(breakdown.onHand, s.consumptionRate);
      const monthlySpend =
        getSpendRatePerDay(s.consumptionRate, breakdown.openCostPerPill) * 30;
      const capacity = (s.bottles ?? []).reduce((sum, b) => sum + b.count, 0);
      return {
        id: s._id as string,
        name: s.name,
        href: undefined as string | undefined,
        buyHref: "/restock",
        onHand: breakdown.onHand,
        incomingCount: breakdown.incomingCount,
        nextIncomingAt: breakdown.nextIncomingAt,
        daysLeft,
        capacity,
        monthlySpend,
        status: getSupplementStatus(daysLeft),
      };
    });

  // Each group is one pooled row — consumed one brand at a time (ADR-0004).
  const groupDerived = groups.map((g) => {
    const memberInput = g.members.map((m) => ({
      supplementId: m.supplement._id as string,
      bottles: m.bottles,
    }));
    const ledger = getGroupStateForDosages(
      memberInput,
      g.anchoredAt,
      g.dosages ?? []
    );
    const daysLeft = getDaysLeft(ledger.onHand, g.consumptionRate);
    const monthlySpend =
      getSpendRatePerDay(g.consumptionRate, ledger.openCostPerPill) * 30;
    const capacity = g.members.reduce(
      (sum, m) => sum + m.bottles.reduce((s, b) => s + b.count, 0),
      0
    );
    // Link to the open brand's detail page (what's being taken now).
    const openId = ledger.openSupplementId ?? g.members[0]?.supplement._id;
    return {
      id: g._id as string,
      name: g.name,
      href: openId ? `/supplements/${openId}` : "/supplements",
      buyHref: "/restock",
      onHand: ledger.onHand,
      incomingCount: ledger.incomingCount,
      nextIncomingAt: ledger.nextIncomingAt,
      daysLeft,
      capacity,
      monthlySpend,
      status: getSupplementStatus(daysLeft),
    };
  });

  const derived = [...soloDerived, ...groupDerived].sort(
    (a, b) => a.daysLeft - b.daysLeft
  );
  const itemCount = derived.length;

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
            {itemCount} supplements · {activePeopleCount}{" "}
            {activePeopleCount === 1 ? "person" : "people"} · tracked as of{" "}
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
          <div className="text-xs text-text-muted">of {itemCount}</div>
        </div>

        <div className="card p-4 space-y-2">
          <div className="text-xs text-text-label font-semibold">
            Next to run out
          </div>
          {nextToRunOut && (
            <>
              <div className="font-semibold text-sm leading-tight">
                {nextToRunOut.name}
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
              {nextToRunOut.name} runs out in {nextToRunOut.daysLeft} days —
              only {nextToRunOut.onHand} left.
            </div>
          </div>
          <Link href={nextToRunOut.buyHref} className="btn-primary bg-critical hover:bg-critical/90">
            Find best price
          </Link>
        </div>
      )}

      {/* Run-out timeline */}
      <RunOutTimeline
        rows={derived.map((d) => ({
          id: d.id,
          name: d.name,
          href: d.href,
          onHand: d.onHand,
          incomingCount: d.incomingCount,
          nextIncomingAt: d.nextIncomingAt,
          capacity: d.capacity,
          daysLeft: d.daysLeft,
          status: d.status,
        }))}
      />
    </div>
  );
}
