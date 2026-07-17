"use client";

import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import { SupplementThumb } from "@/components/SupplementThumb";
import { colorValue } from "@/lib/person-colors";
import {
  getSupplementStatus,
  getDaysLeft,
  getConsumptionRate,
  getBottleStatesForDosages,
  getSpendRatePerDay,
  getDosageWeekly,
  type BottleLike,
  type DosageLike,
  type SupplementStatus,
} from "@/lib/supplement-utils";

const COVERAGE_TARGET_DAYS = 90;

interface PersonLike {
  _id: Id<"people">;
  name: string;
  color: string;
  status?: "active" | "disabled";
}

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
    imageUrl?: string;
    iconId?: string;
    bottles?: BottleLike[];
    dosages?: (DosageLike & { personId: Id<"people"> })[];
  };
  people: PersonLike[];
  showRestock?: boolean;
  restockLabel?: string;
  onRestock?: () => void;
}

function supplyPct(daysLeft: number): number {
  if (!Number.isFinite(daysLeft) || daysLeft <= 0) return 0;
  return Math.min(100, (daysLeft / COVERAGE_TARGET_DAYS) * 100);
}

function fillClass(status: SupplementStatus): string {
  if (status === "critical") return "bg-critical";
  if (status === "low") return "bg-low";
  if (status === "stocked") return "bg-stocked";
  return "bg-on-track";
}

export function SupplementListItem({
  supplement,
  people,
  showRestock,
  restockLabel = "Restock",
  onRestock,
}: SupplementListItemProps) {
  const dosages = supplement.dosages ?? [];
  const rate = getConsumptionRate(dosages);
  const anchoredAt =
    supplement.anchoredAt ?? supplement.createdAt ?? Date.now();
  const ledger = getBottleStatesForDosages(
    supplement.bottles ?? [],
    anchoredAt,
    dosages
  );
  const daysLeft = getDaysLeft(ledger.onHand, rate);
  const status = getSupplementStatus(daysLeft);
  const monthlySpend = getSpendRatePerDay(rate, ledger.openCostPerPill) * 30;

  const takers = dosages
    .filter((d) => getDosageWeekly(d) > 0)
    .map((d) => {
      const person = people.find((p) => p._id === d.personId);
      return person
        ? { name: person.name, color: person.color }
        : { name: "?", color: "slate" };
    });

  const metaParts = [
    supplement.brand,
    supplement.form,
    `${Math.round(ledger.onHand)} pills left`,
  ].filter(Boolean);
  if (ledger.incomingCount > 0) {
    metaParts.push(`+${Math.round(ledger.incomingCount)} incoming`);
  }
  if (ledger.bottleCount > 1) {
    metaParts.push(`${ledger.bottleCount} bottles`);
  }

  return (
    <Link
      href={`/supplements/${supplement._id}`}
      className="card p-4 flex items-center gap-3 sm:gap-4 hover:bg-surface-alt transition-colors cursor-pointer"
    >
      <SupplementThumb
        iconId={supplement.iconId}
        imageUrl={supplement.imageUrl}
        name={supplement.name}
        size="md"
      />

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold truncate">{supplement.name}</h3>
        <p className="text-sm text-text-muted mt-0.5 truncate">
          {metaParts.join(" · ")}
        </p>
        <div className="supply-track mt-2 max-w-xs">
          <div
            className={`supply-fill ${fillClass(status)}`}
            style={{ width: `${supplyPct(daysLeft)}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {takers.length > 0 && (
          <div className="hidden sm:flex items-center -space-x-1.5">
            {takers.map((t, i) => (
              <span
                key={i}
                title={t.name}
                className="w-6 h-6 rounded-full text-[10px] font-bold text-white flex items-center justify-center border-2 border-surface"
                style={{ backgroundColor: colorValue(t.color) }}
              >
                {t.name.charAt(0).toUpperCase()}
              </span>
            ))}
          </div>
        )}

        <div className={`pill status-${status}`}>
          {status === "critical" || status === "low"
            ? `${daysLeft} days`
            : status === "on-track"
              ? "On track"
              : "Stocked"}
        </div>

        <div className="text-right w-14 hidden sm:block">
          {monthlySpend > 0 ? (
            <>
              <p className="font-mono text-sm">${monthlySpend.toFixed(2)}</p>
              <p className="text-xs text-text-muted">/mo</p>
            </>
          ) : (
            <p className="font-mono text-sm text-text-muted">—</p>
          )}
        </div>

        {showRestock && onRestock && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRestock();
            }}
            className="text-sm font-semibold text-primary hover:underline px-1"
          >
            {restockLabel}
          </button>
        )}
      </div>
    </Link>
  );
}

/** Compute list metrics for page-level sorting/sectioning. */
export function getSupplementListMetrics(supplement: {
  bottles?: BottleLike[];
  dosages?: DosageLike[];
  anchoredAt?: number;
  createdAt?: number;
  consumptionRate?: number;
}) {
  const dosages = supplement.dosages ?? [];
  const rate =
    typeof supplement.consumptionRate === "number"
      ? supplement.consumptionRate
      : getConsumptionRate(dosages);
  const anchoredAt =
    supplement.anchoredAt ?? supplement.createdAt ?? Date.now();
  const ledger = getBottleStatesForDosages(
    supplement.bottles ?? [],
    anchoredAt,
    dosages
  );
  const daysLeft = getDaysLeft(ledger.onHand, rate);
  const status = getSupplementStatus(daysLeft);
  return { daysLeft, status, ledger, rate };
}
