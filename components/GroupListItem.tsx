"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { DosageInput } from "@/components/DosageInput";
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

const perDay = (weekly: number) => Math.round((weekly / 7) * 100) / 100;

export function GroupListItem({
  group,
  householdId,
}: {
  group: GroupView;
  householdId: Id<"households">;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingDosage, setEditingDosage] = useState(false);

  const people = useQuery(api.people.list, { householdId });
  const setDosage = useMutation(api.groups.setDosage);
  const removeMember = useMutation(api.groups.removeMember);

  const rate = group.consumptionRate;
  const memberInput = group.members.map((m) => ({
    supplementId: m.supplement._id as string,
    bottles: m.bottles,
  }));
  const ledger = getGroupStateForDosages(
    memberInput,
    group.anchoredAt,
    group.dosages
  );
  const daysLeft = getDaysLeft(ledger.onHand, rate);
  const status = getSupplementStatus(daysLeft);
  const monthlySpend = getSpendRatePerDay(rate, ledger.openCostPerPill) * 30;

  // Per-member remaining (Σ its bottles) + queue order (earliest bottle first).
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
  const image = openMember?.supplement.imageUrl;

  const takerName = (id: Id<"people">) =>
    people?.find((p) => p._id === id)?.name ?? "Unknown";
  const takersLabel = group.takers
    .map((t) => `${takerName(t.personId)} ${t.pillsPerWeek}/wk`)
    .join(" · ");

  return (
    <div className="card overflow-hidden">
      {/* Collapsed summary row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full p-4 flex items-center gap-4 text-left hover:bg-surface-alt transition-colors"
      >
        <div
          className={`w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border border-border-strong bg-surface-alt ${
            !image ? "img-placeholder" : ""
          }`}
        >
          {image && (
            <img src={image} alt={group.name} className="w-full h-full object-cover" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-text-muted text-xs">{expanded ? "▾" : "▸"}</span>
            <h3 className="font-semibold">{group.name}</h3>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 rounded px-1.5 py-0.5">
              Group
            </span>
          </div>
          <p className="text-sm text-text-muted mt-1">
            {group.members.length} brands ·{" "}
            {openMember ? (
              <>
                <span className="font-medium">{openMember.supplement.name}</span> open
              </>
            ) : (
              "none open"
            )}{" "}
            · <span className="font-mono">{ledger.onHand} on hand</span>
            {ledger.incomingCount > 0 && (
              <span className="font-mono">
                {" "}
                · +{ledger.incomingCount} incoming
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div
            className={`px-3 py-1 rounded-full text-sm font-semibold status-${status} whitespace-nowrap`}
          >
            {status === "critical" || status === "low"
              ? `${daysLeft} days`
              : status === "on-track"
              ? "On track"
              : "Stocked"}
          </div>
          <div className="text-right w-16">
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
      </button>

      {/* Expanded breakdown */}
      {expanded && (
        <div className="border-t border-border-strong p-4 space-y-4">
          <CandidateSummaryCard
            householdId={householdId}
            subjectKind="group"
            subjectId={group._id}
            subjectName={group.name}
          />

          <div>
            <p className="text-xs font-semibold text-text-label uppercase tracking-wide mb-2">
              Consuming in this order (oldest purchase first)
            </p>
            <div className="space-y-1.5">
              {orderedMembers.map((m) => {
                const remaining = Math.round(
                  remainingByMember.get(m.supplement._id) ?? 0
                );
                const incoming = Math.round(
                  incomingByMember.get(m.supplement._id) ?? 0
                );
                const isOpen = m.supplement._id === ledger.openSupplementId;
                const state =
                  remaining > 0
                    ? isOpen
                      ? "open"
                      : "frozen"
                    : incoming > 0
                      ? "incoming"
                      : "empty";
                return (
                  <div
                    key={m.supplement._id}
                    className="flex items-center justify-between gap-3 border border-border-strong rounded-lg p-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 ${
                          state === "open"
                            ? "bg-on-track/15 text-on-track"
                            : state === "frozen"
                            ? "bg-black/[0.06] text-text-muted"
                            : state === "incoming"
                            ? "bg-primary-light text-primary"
                            : "bg-black/[0.04] text-text-faint"
                        }`}
                      >
                        {state === "open"
                          ? "● open"
                          : state === "frozen"
                            ? "○ next"
                            : state === "incoming"
                              ? "incoming"
                              : "empty"}
                      </span>
                      <Link
                        href={`/supplements/${m.supplement._id}`}
                        className="font-medium truncate hover:text-primary hover:underline"
                      >
                        {m.supplement.name}
                        {m.supplement.brand && (
                          <span className="text-text-muted font-normal">
                            {" "}· {m.supplement.brand}
                          </span>
                        )}{" "}
                        <span className="text-text-muted">↗</span>
                      </Link>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-mono text-sm">
                        {remaining} left
                        {state === "frozen" && (
                          <span className="text-text-faint"> · frozen</span>
                        )}
                        {incoming > 0 && (
                          <span className="text-text-faint">
                            {" "}
                            · +{incoming} incoming
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => removeMember({ supplementId: m.supplement._id })}
                        className="text-xs text-critical hover:text-critical/80"
                        title="Unlink from group (auto-dissolves at one member)"
                      >
                        Unlink
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Group dosage */}
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-text-label uppercase tracking-wide">
                Dosage (group)
              </p>
              <button
                onClick={() => setEditingDosage((v) => !v)}
                className="text-sm text-primary hover:underline"
              >
                {editingDosage ? "Done" : "Edit"}
              </button>
            </div>
            {!editingDosage ? (
              <p className="text-sm mt-1">
                {takersLabel || <span className="text-text-muted">No takers yet.</span>}
              </p>
            ) : (
              <div className="mt-2 space-y-3">
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

          <p className="text-xs text-text-muted">
            Spend steps to the open brand&apos;s cost as the queue rolls ·{" "}
            {perDay(rate * 7)} pills/day pooled
          </p>
        </div>
      )}
    </div>
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
