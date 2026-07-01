"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import {
  getSupplementStatus,
  getDaysLeft,
  getConsumptionRate,
  getBottleStates,
  getSpendRatePerDay,
  getDosageWeekly,
  type BottleLike,
} from "@/lib/supplement-utils";

interface SupplementListItemProps {
  supplement: {
    _id: Id<"supplements">;
    name: string;
    brand?: string;
    form?: string;
    jarSize: number;
    quantityAnchor?: number;
    anchoredAt?: number;
    remaining?: number;
    createdAt?: number;
    price?: number;
    imageUrl?: string;
    householdId: Id<"households">;
    bottles?: BottleLike[];
  };
}

const PLACEHOLDER_BG =
  "linear-gradient(45deg, #f0f0f0 25%, #e0e0e0 25%, #e0e0e0 50%, #f0f0f0 50%, #f0f0f0 75%, #e0e0e0 75%, #e0e0e0)";

export function SupplementListItem({ supplement }: SupplementListItemProps) {
  const dosages = useQuery(
    api.dosages.listBySupplementId,
    { supplementId: supplement._id }
  );

  const people = useQuery(
    api.people.list,
    { householdId: supplement.householdId }
  );

  // Disabled people are paused: their dosages don't count toward the rate.
  const activeDosages = (dosages ?? []).filter((d) => d.personActive);
  const rate = getConsumptionRate(activeDosages);
  const anchoredAt =
    supplement.anchoredAt ?? supplement.createdAt ?? Date.now();
  const ledger = getBottleStates(supplement.bottles ?? [], anchoredAt, rate);
  const daysLeft = getDaysLeft(ledger.onHand, rate);
  const status = getSupplementStatus(daysLeft);
  const monthlySpend = getSpendRatePerDay(rate, ledger.openCostPerPill) * 30;

  // "Taken by" summarizes active takers only (paused people are shown on the
  // supplement detail page, not in this list row).
  const dosagesByPerson = activeDosages.map((dosage) => {
    const person = people?.find((p) => p._id === dosage.personId);
    return {
      personName: person?.name || "Unknown",
      perWeek: getDosageWeekly(dosage),
    };
  });

  return (
    <Link
      href={`/supplements/${supplement._id}`}
      className="card p-4 flex items-center gap-4 hover:bg-surface-alt transition-colors cursor-pointer"
    >
      {/* Image Thumbnail */}
      <div
        className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border border-black/10 bg-gray-100"
        style={!supplement.imageUrl ? { backgroundImage: PLACEHOLDER_BG } : {}}
      >
        {supplement.imageUrl && (
          <img
            src={supplement.imageUrl}
            alt={supplement.name}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold">{supplement.name}</h3>
        <p className="text-sm text-text-muted mt-1">
          {supplement.brand && `${supplement.brand} · `}
          {supplement.form && `${supplement.form} · `}
          <span className="font-mono">
            {ledger.onHand} on hand
          </span>
          {ledger.bottleCount > 1 && (
            <span className="font-mono"> · {ledger.bottleCount} bottles</span>
          )}
        </p>

        {/* Users Taking It */}
        {dosagesByPerson.length > 0 && (
          <div className="text-xs text-text-muted mt-2">
            Taken by:{" "}
            {dosagesByPerson.map((d, idx) => (
              <span key={idx}>
                {d.personName} ({d.perWeek}/wk)
                {idx < dosagesByPerson.length - 1 ? ", " : ""}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Status & Price */}
      <div className="flex items-center gap-4">
        <div
          className={`px-3 py-1 rounded-full text-sm font-semibold status-${status} whitespace-nowrap`}
        >
          {status === "critical" && `${daysLeft} days`}
          {status === "low" && `${daysLeft} days`}
          {status === "on-track" && "On track"}
          {status === "stocked" && "Stocked"}
        </div>

        <div className="text-right">
          {monthlySpend > 0 ? (
            <>
              <p className="font-mono text-sm">${monthlySpend.toFixed(2)}</p>
              <p className="text-xs text-text-muted">/mo</p>
            </>
          ) : (
            <p className="font-mono text-sm text-text-muted">—</p>
          )}
        </div>
      </div>
    </Link>
  );
}
