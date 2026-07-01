"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useHousehold } from "@/hooks/useHousehold";

const money = (n: number) => `$${n.toFixed(2)}`;

export default function CostsPage() {
  const householdId = useHousehold();
  const summary = useQuery(
    api.costs.summary,
    householdId ? { householdId } : "skip"
  );

  if (!householdId || !summary) {
    return <div className="text-center py-12">Loading costs...</div>;
  }

  const { perPerson, perSupplement, household } = summary;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Costs</h1>
        <p className="text-text-muted text-sm mt-1">
          What each person&apos;s supplements cost at today&apos;s dosages and
          open-bottle prices.
        </p>
      </div>

      {/* Household totals */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4 space-y-1">
          <div className="text-xs text-text-label font-semibold">Per day</div>
          <div className="text-xl font-mono font-bold">
            {money(household.perDay)}
          </div>
        </div>
        <div className="card p-4 space-y-1">
          <div className="text-xs text-text-label font-semibold">Per week</div>
          <div className="text-xl font-mono font-bold">
            {money(household.perWeek)}
          </div>
        </div>
        <div className="card p-4 space-y-1">
          <div className="text-xs text-text-label font-semibold">Per month</div>
          <div className="text-xl font-mono font-bold">
            {money(household.perMonth)}
          </div>
        </div>
        <div className="card p-4 space-y-1">
          <div className="text-xs text-text-label font-semibold">
            Lifetime spent
          </div>
          <div className="text-xl font-mono font-bold">
            {money(household.lifetime)}
          </div>
        </div>
      </div>

      {/* Per person */}
      <div>
        <h2 className="text-lg font-bold mb-3">Per person</h2>
        <div className="card divide-y divide-black/10">
          <div className="grid grid-cols-4 gap-2 px-4 py-2 text-xs font-semibold text-text-label">
            <span>Person</span>
            <span className="text-right">Day</span>
            <span className="text-right">Week</span>
            <span className="text-right">Month</span>
          </div>
          {perPerson.map((p) => (
            <div
              key={p.personId}
              className="grid grid-cols-4 gap-2 px-4 py-3 items-center"
            >
              <span className="flex items-center gap-2 font-medium">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                {p.name}
              </span>
              <span className="text-right font-mono text-sm">
                {money(p.perDay)}
              </span>
              <span className="text-right font-mono text-sm">
                {money(p.perWeek)}
              </span>
              <span className="text-right font-mono text-sm">
                {money(p.perMonth)}
              </span>
            </div>
          ))}
          {perPerson.length === 0 && (
            <div className="px-4 py-6 text-sm text-text-muted text-center">
              No people yet.
            </div>
          )}
        </div>
      </div>

      {/* Per supplement */}
      <div>
        <h2 className="text-lg font-bold mb-3">Per supplement</h2>
        <div className="card divide-y divide-black/10">
          <div className="grid grid-cols-3 gap-2 px-4 py-2 text-xs font-semibold text-text-label">
            <span>Supplement</span>
            <span className="text-right">Per month</span>
            <span className="text-right">Lifetime</span>
          </div>
          {perSupplement.map((s) => (
            <div
              key={s.supplementId}
              className="grid grid-cols-3 gap-2 px-4 py-3 items-center"
            >
              <span className="font-medium truncate">{s.name}</span>
              <span className="text-right font-mono text-sm">
                {s.perMonth > 0 ? money(s.perMonth) : "—"}
              </span>
              <span className="text-right font-mono text-sm">
                {money(s.lifetime)}
              </span>
            </div>
          ))}
          {perSupplement.length === 0 && (
            <div className="px-4 py-6 text-sm text-text-muted text-center">
              No supplements yet.
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-text-muted">
        Monthly figures are a current-rate estimate (30-day), not a bill.
        Lifetime is the total paid for every bottle logged, including empty ones.
      </p>
    </div>
  );
}
