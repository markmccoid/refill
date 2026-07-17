"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useHousehold } from "@/hooks/useHousehold";
import {
  SupplementListItem,
  getSupplementListMetrics,
} from "@/components/SupplementListItem";
import {
  GroupListItem,
  getGroupListMetrics,
} from "@/components/GroupListItem";
import { CreateGroupDialog } from "@/components/CreateGroupDialog";
import { Doc, Id } from "@/convex/_generated/dataModel";
import type { BottleLike, SupplementStatus } from "@/lib/supplement-utils";

type Filter = "all" | "attention" | "groups";

type SupplementRow = Doc<"supplements"> & {
  consumptionRate: number;
  bottles: BottleLike[];
  dosages: (Doc<"dosages">)[];
};

type GroupRow = Doc<"groups"> & {
  consumptionRate: number;
  members: {
    supplement: Doc<"supplements">;
    bottles: (BottleLike & { _id: Id<"bottles"> })[];
  }[];
  dosages: Doc<"dosages">[];
  takers: { personId: Id<"people">; pillsPerWeek: number }[];
};

type Subject =
  | {
      kind: "supplement";
      id: Id<"supplements">;
      daysLeft: number;
      status: SupplementStatus;
      searchText: string;
      supplement: SupplementRow;
    }
  | {
      kind: "group";
      id: Id<"groups">;
      daysLeft: number;
      status: SupplementStatus;
      searchText: string;
      group: GroupRow;
    };

function isAttention(status: SupplementStatus) {
  return status === "critical" || status === "low";
}

export default function SupplementsPage() {
  const householdId = useHousehold();
  const supplements = useQuery(
    api.supplements.list,
    householdId ? { householdId } : "skip"
  );
  const groups = useQuery(
    api.groups.list,
    householdId ? { householdId } : "skip"
  );
  const people = useQuery(
    api.people.list,
    householdId ? { householdId } : "skip"
  );
  const addRestockItem = useMutation(api.restock.addItem);

  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [restocked, setRestocked] = useState<Set<string>>(new Set());

  const subjects = useMemo((): Subject[] => {
    if (!supplements || !groups) return [];
    const ungrouped = supplements.filter((s) => !s.groupId);
    const list: Subject[] = [];

    for (const s of ungrouped) {
      const { daysLeft, status } = getSupplementListMetrics(s);
      list.push({
        kind: "supplement",
        id: s._id,
        daysLeft,
        status,
        searchText: [s.name, s.brand, s.form].filter(Boolean).join(" ").toLowerCase(),
        supplement: s,
      });
    }
    for (const g of groups) {
      const { daysLeft, status } = getGroupListMetrics(g);
      const memberText = g.members
        .map((m) => [m.supplement.name, m.supplement.brand].filter(Boolean).join(" "))
        .join(" ");
      list.push({
        kind: "group",
        id: g._id,
        daysLeft,
        status,
        searchText: `${g.name} ${memberText}`.toLowerCase(),
        group: g,
      });
    }

    list.sort((a, b) => {
      const aInf = !Number.isFinite(a.daysLeft);
      const bInf = !Number.isFinite(b.daysLeft);
      if (aInf && bInf) return 0;
      if (aInf) return 1;
      if (bInf) return -1;
      return a.daysLeft - b.daysLeft;
    });
    return list;
  }, [supplements, groups]);

  if (!householdId || !supplements || !groups || !people) {
    return <div className="text-center py-12">Loading...</div>;
  }

  const ungrouped = supplements.filter((s) => !s.groupId);
  const activePeople = people.filter((p) => p.status !== "disabled");
  const attentionCount = subjects.filter((s) => isAttention(s.status)).length;
  const q = search.trim().toLowerCase();

  const filtered = subjects.filter((s) => {
    if (filter === "attention" && !isAttention(s.status)) return false;
    if (filter === "groups" && s.kind !== "group") return false;
    if (q && !s.searchText.includes(q)) return false;
    return true;
  });

  const needsAttention = filtered.filter((s) => isAttention(s.status));
  const onTrack = filtered.filter((s) => !isAttention(s.status));

  const subtitle =
    attentionCount > 0
      ? `${subjects.length} supplement${subjects.length === 1 ? "" : "s"} — ${attentionCount} running low`
      : `${subjects.length} supplement${subjects.length === 1 ? "" : "s"}`;

  async function handleRestock(
    key: string,
    args: { supplementId?: Id<"supplements">; groupId?: Id<"groups"> }
  ) {
    await addRestockItem({ householdId: householdId!, ...args });
    setRestocked((prev) => new Set(prev).add(key));
  }

  function renderSubject(s: Subject, showRestock: boolean) {
    const key = `${s.kind}:${s.id}`;
    const label = restocked.has(key) ? "Added ✓" : "Restock";
    if (s.kind === "supplement") {
      return (
        <SupplementListItem
          key={key}
          supplement={s.supplement}
          people={activePeople}
          showRestock={showRestock}
          restockLabel={label}
          onRestock={() =>
            handleRestock(key, { supplementId: s.supplement._id })
          }
        />
      );
    }
    return (
      <GroupListItem
        key={key}
        group={s.group}
        householdId={householdId!}
        showRestock={showRestock}
        restockLabel={label}
        onRestock={() => handleRestock(key, { groupId: s.group._id })}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Supplements</h1>
          <p className="text-text-muted text-sm mt-1">{subtitle}</p>
        </div>
        <Link href="/supplements/new" className="btn-primary flex-shrink-0">
          ＋ Add supplement
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <label className="flex-1 flex items-center gap-2 bg-surface border border-border-strong rounded-lg px-3 py-2">
          <span className="text-text-faint text-sm">⌕</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search supplements & brands…"
            className="flex-1 bg-transparent border-0 outline-none text-sm min-h-0 p-0 focus:ring-0"
          />
        </label>
        <div className="flex gap-1.5 flex-wrap">
          {(
            [
              ["all", "All", subjects.length],
              ["attention", "Needs attention", attentionCount],
              ["groups", "Groups", groups.length],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`chip ${filter === id ? "chip-active" : ""}`}
            >
              {label}{" "}
              <span className="font-mono text-[11px] opacity-75">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {subjects.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <p>No supplements yet. Start by adding one!</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <p>No matches for this filter.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {needsAttention.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wider text-critical">
                <span>Needs attention</span>
                <span className="flex-1 h-px bg-border-strong" />
              </div>
              <div className="space-y-2">
                {needsAttention.map((s) => renderSubject(s, true))}
              </div>
            </section>
          )}

          {onTrack.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wider text-text-label">
                <span>On track</span>
                <span className="flex-1 h-px bg-border-strong" />
              </div>
              <div className="space-y-2">
                {onTrack.map((s) => renderSubject(s, false))}
              </div>
            </section>
          )}
        </div>
      )}

      {ungrouped.length >= 2 && (
        <div className="border border-dashed border-border-strong rounded-xl p-4 flex gap-3 items-start bg-surface/50">
          <div className="text-sm text-text-muted">
            <span className="font-semibold text-text">
              Tip — group interchangeable brands.
            </span>{" "}
            Taking more than one brand of the same thing? Group them and Refill
            treats them as one supply: finish one bottle, start the next, one
            shared dosage.{" "}
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="text-primary font-semibold hover:underline"
            >
              Create a group
            </button>
          </div>
        </div>
      )}

      {creating && (
        <CreateGroupDialog
          householdId={householdId}
          candidates={ungrouped.map((s) => ({
            _id: s._id,
            name: s.name,
            brand: s.brand,
          }))}
          people={activePeople.map((p) => ({ _id: p._id, name: p.name }))}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}
