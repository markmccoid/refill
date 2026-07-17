"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { DosageInput } from "@/components/DosageInput";
import { SupplementThumb } from "@/components/SupplementThumb";
import { CandidateSummaryCard } from "@/components/restock/CandidateSummaryCard";
import {
  getGroupStateForDosages,
  getDaysLeft,
  getSupplementStatus,
  getSpendRatePerDay,
  isBottleAvailable,
  type BottleLike,
} from "@/lib/supplement-utils";

interface GroupMemberView {
  supplement: {
    _id: Id<"supplements">;
    name: string;
    brand?: string;
    imageUrl?: string;
    iconId?: string;
  };
  bottles: (BottleLike & { _id: Id<"bottles"> })[];
}

interface GroupView {
  _id: Id<"groups">;
  name: string;
  category?: string;
  anchoredAt: number;
  consumptionRate: number;
  members: GroupMemberView[];
  dosages: {
    personId: Id<"people">;
    pillsPerWeek?: number;
    pausedAt?: number;
    pauseUntil?: number;
  }[];
  takers: { personId: Id<"people">; pillsPerWeek: number }[];
}

type MemberState = "open" | "next" | "incoming" | "empty";

function shortBrand(m: GroupMemberView): string {
  return m.supplement.brand || m.supplement.name.split(/\s+/)[0] || m.supplement.name;
}

function arrivingLabel(bottles: BottleLike[]): string {
  const future = bottles
    .filter((b) => !isBottleAvailable(b.purchasedAt))
    .map((b) => b.purchasedAt);
  if (future.length === 0) return "Arriving";
  const soonest = Math.min(...future);
  const d = new Date(soonest);
  return `Arriving ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function capacityOf(m: GroupMemberView): number {
  return m.bottles.reduce((sum, b) => sum + b.count, 0);
}

export function getGroupListMetrics(group: GroupView) {
  const memberInput = group.members.map((m) => ({
    supplementId: m.supplement._id as string,
    bottles: m.bottles,
  }));
  const ledger = getGroupStateForDosages(
    memberInput,
    group.anchoredAt,
    group.dosages
  );
  const daysLeft = getDaysLeft(ledger.onHand, group.consumptionRate);
  const status = getSupplementStatus(daysLeft);
  return { daysLeft, status, ledger };
}

export function GroupListItem({
  group,
  householdId,
  showRestock,
  restockLabel = "Restock",
  onRestock,
}: {
  group: GroupView;
  householdId: Id<"households">;
  showRestock?: boolean;
  restockLabel?: string;
  onRestock?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingDosage, setEditingDosage] = useState(false);

  const people = useQuery(api.people.list, { householdId });
  const setDosage = useMutation(api.groups.setDosage);
  const removeMember = useMutation(api.groups.removeMember);

  const rate = group.consumptionRate;
  const { daysLeft, status, ledger } = getGroupListMetrics(group);
  const monthlySpend = getSpendRatePerDay(rate, ledger.openCostPerPill) * 30;

  const remainingByMember = new Map<string, number>();
  const incomingByMember = new Map<string, number>();
  for (const s of ledger.states) {
    const id = s.bottle.supplementId;
    if (isBottleAvailable(s.bottle.purchasedAt)) {
      remainingByMember.set(id, (remainingByMember.get(id) ?? 0) + s.remaining);
    } else {
      incomingByMember.set(id, (incomingByMember.get(id) ?? 0) + s.remaining);
    }
  }
  const earliestByMember = new Map<string, number>();
  for (const m of group.members) {
    const times = m.bottles.map((b) => b.purchasedAt);
    earliestByMember.set(
      m.supplement._id,
      times.length ? Math.min(...times) : Infinity
    );
  }
  const orderedMembers = [...group.members].sort(
    (a, b) =>
      (earliestByMember.get(a.supplement._id) ?? 0) -
      (earliestByMember.get(b.supplement._id) ?? 0)
  );

  const openMember = group.members.find(
    (m) => m.supplement._id === ledger.openSupplementId
  );

  const stackMembers = (() => {
    const ordered = [...orderedMembers];
    if (openMember) {
      return [
        openMember,
        ...ordered.filter((m) => m.supplement._id !== openMember.supplement._id),
      ].slice(0, 3);
    }
    return ordered.slice(0, 3);
  })();

  const memberState = (m: GroupMemberView): MemberState => {
    const remaining = remainingByMember.get(m.supplement._id) ?? 0;
    const incoming = incomingByMember.get(m.supplement._id) ?? 0;
    if (remaining > 0) {
      return m.supplement._id === ledger.openSupplementId ? "open" : "next";
    }
    if (incoming > 0) return "incoming";
    return "empty";
  };

  const takerName = (id: Id<"people">) =>
    people?.find((p) => p._id === id)?.name ?? "Unknown";
  const takersLabel = group.takers
    .map((t) => `${takerName(t.personId)} ${t.pillsPerWeek}/wk`)
    .join(" · ");

  const openRemaining = openMember
    ? Math.round(remainingByMember.get(openMember.supplement._id) ?? 0)
    : 0;

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full p-4 flex items-center gap-3 sm:gap-4 text-left hover:bg-surface-alt transition-colors"
      >
        <ThumbStack members={stackMembers} alt={group.name} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{group.name}</h3>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 rounded px-1.5 py-0.5">
              Group · {group.members.length} brands
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1 text-sm min-w-0">
            <span className="w-2 h-2 rounded-full bg-on-track shadow-[0_0_0_3px] shadow-on-track/20 flex-shrink-0" />
            <span className="truncate">
              {openMember ? (
                <>
                  Now taking{" "}
                  <span className="font-medium">{openMember.supplement.name}</span>
                  {" — "}
                  <span className="font-mono">{openRemaining} left</span>
                </>
              ) : (
                <span className="text-text-muted">No bottle open yet</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {orderedMembers.map((m, i) => {
              const state = memberState(m);
              const remaining = Math.round(
                remainingByMember.get(m.supplement._id) ?? 0
              );
              const incoming = Math.round(
                incomingByMember.get(m.supplement._id) ?? 0
              );
              const qty =
                state === "incoming"
                  ? Math.round(incoming)
                  : Math.round(remaining);
              return (
                <span key={m.supplement._id} className="contents">
                  {i > 0 && (
                    <span className="text-text-faint text-[11px]">→</span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1 text-xs rounded-md px-2 py-0.5 border ${
                      state === "open"
                        ? "border-on-track/40 bg-on-track-light text-on-track font-semibold"
                        : state === "incoming"
                          ? "border-dashed border-primary/40 bg-primary-light text-primary"
                          : "border-border-strong bg-surface-alt text-text-muted"
                    }`}
                  >
                    {state === "open" ? "● " : state === "incoming" ? "⏳ " : ""}
                    {shortBrand(m)}{" "}
                    <span className="font-mono">{qty}</span>
                  </span>
                </span>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
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
      </button>

      {expanded && (
        <div className="border-t border-border-strong p-4 space-y-4 bg-surface-alt">
          <CandidateSummaryCard
            householdId={householdId}
            subjectKind="group"
            subjectId={group._id}
            subjectName={group.name}
          />

          <div className="space-y-1.5">
            {orderedMembers.map((m) => {
              const remaining = Math.round(
                remainingByMember.get(m.supplement._id) ?? 0
              );
              const incoming = Math.round(
                incomingByMember.get(m.supplement._id) ?? 0
              );
              const state = memberState(m);
              const cap = capacityOf(m);
              return (
                <div
                  key={m.supplement._id}
                  className="flex items-center justify-between gap-3 border border-border-strong rounded-lg p-2.5 bg-surface"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <StateChip state={state} bottles={m.bottles} />
                    <SupplementThumb
                      iconId={m.supplement.iconId}
                      imageUrl={m.supplement.imageUrl}
                      name={m.supplement.name}
                      size="sm"
                    />
                    <Link
                      href={`/supplements/${m.supplement._id}`}
                      className="font-medium truncate hover:text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {m.supplement.name}
                      {m.supplement.brand && (
                        <span className="text-text-muted font-normal">
                          {" "}
                          · {m.supplement.brand}
                        </span>
                      )}
                    </Link>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-mono text-sm">
                      {state === "incoming"
                        ? `${incoming} incoming`
                        : state === "empty"
                          ? "empty"
                          : remaining === cap && cap > 0
                            ? `${remaining} sealed`
                            : `${remaining}${cap > 0 ? ` / ${cap}` : ""} left`}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        removeMember({ supplementId: m.supplement._id })
                      }
                      className="text-xs text-critical hover:text-critical/80"
                      title="Unlink from group"
                    >
                      Unlink
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-text-muted">
              Taken by:{" "}
              {takersLabel ? (
                <span className="text-text font-medium">{takersLabel}</span>
              ) : (
                <span>No takers yet</span>
              )}
            </p>
            <div className="flex gap-2">
              <Link
                href={`/supplements/new?groupId=${group._id}`}
                className="text-sm font-semibold text-primary hover:underline px-1"
              >
                ＋ Add a brand
              </Link>
              <button
                type="button"
                onClick={() => setEditingDosage((v) => !v)}
                className="text-sm font-semibold text-primary hover:underline px-1"
              >
                {editingDosage ? "Done" : "Edit dosage"}
              </button>
            </div>
          </div>

          {editingDosage && (
            <div className="space-y-3">
              {(people ?? [])
                .filter((p) => p.status !== "disabled")
                .map((p) => {
                  const current =
                    group.takers.find((t) => t.personId === p._id)
                      ?.pillsPerWeek ?? 0;
                  return (
                    <GroupDosageRow
                      key={p._id}
                      name={p.name}
                      value={current}
                      onSave={(weekly) =>
                        setDosage({
                          groupId: group._id,
                          personId: p._id,
                          pillsPerWeek: weekly,
                        })
                      }
                    />
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ThumbStack({
  members,
  alt,
}: {
  members: GroupMemberView[];
  alt: string;
}) {
  const slots =
    members.length > 0
      ? members
      : [
          {
            supplement: { _id: "x" as Id<"supplements">, name: alt },
            bottles: [],
          },
        ];
  return (
    <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0">
      {slots.slice(0, 3).map((m, i) => (
        <div
          key={m.supplement._id + String(i)}
          className="absolute"
          style={{
            left: i * 5,
            top: i === 0 ? 8 : i === 1 ? 4 : 0,
            zIndex: 3 - i,
            transform: i === 0 ? undefined : `rotate(${i * 4}deg)`,
            opacity: i === 0 ? 1 : i === 1 ? 0.92 : 0.8,
          }}
        >
          <SupplementThumb
            iconId={m.supplement.iconId}
            imageUrl={m.supplement.imageUrl}
            name={i === 0 ? alt : m.supplement.name}
            size="sm"
          />
        </div>
      ))}
    </div>
  );
}

function StateChip({
  state,
  bottles,
}: {
  state: MemberState;
  bottles: BottleLike[];
}) {
  const label =
    state === "open"
      ? "● Open"
      : state === "next"
        ? "Up next"
        : state === "incoming"
          ? arrivingLabel(bottles)
          : "Empty";
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 flex-shrink-0 ${
        state === "open"
          ? "bg-on-track/15 text-on-track"
          : state === "next"
            ? "bg-text/5 text-text-muted"
            : state === "incoming"
              ? "bg-primary-light text-primary"
              : "bg-text/5 text-text-faint"
      }`}
    >
      {label}
    </span>
  );
}

function GroupDosageRow({
  name,
  value,
  onSave,
}: {
  name: string;
  value: number;
  onSave: (weekly: number) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const dirty = draft !== value;
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-sm font-medium">{name}</span>
      <div className="flex-1">
        <DosageInput value={draft} onChange={setDraft} />
      </div>
      <button
        type="button"
        disabled={!dirty || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onSave(draft);
          } finally {
            setBusy(false);
          }
        }}
        className="btn-primary text-sm py-1.5 px-3 disabled:opacity-40"
      >
        {busy ? "…" : "Save"}
      </button>
    </div>
  );
}
