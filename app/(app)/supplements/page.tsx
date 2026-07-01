"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useDemoHousehold } from "@/hooks/useDemoHousehold";
import { SupplementListItem } from "@/components/SupplementListItem";
import { GroupListItem } from "@/components/GroupListItem";
import { CreateGroupDialog } from "@/components/CreateGroupDialog";

export default function SupplementsPage() {
  const householdId = useDemoHousehold();
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

  const [creating, setCreating] = useState(false);

  if (!householdId || !supplements || !groups || !people) {
    return <div className="text-center py-12">Loading...</div>;
  }

  // Grouped brands render inside their group row, not as standalone items.
  const ungrouped = supplements.filter((s) => !s.groupId);
  const activePeople = people.filter((p) => p.status !== "disabled");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Supplements</h1>
          <p className="text-text-muted text-sm mt-1">
            {ungrouped.length} loose ·{" "}
            {groups.length} {groups.length === 1 ? "group" : "groups"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCreating(true)}
            className="btn-outline"
            disabled={ungrouped.length < 2}
            title={
              ungrouped.length < 2
                ? "Need at least two ungrouped supplements"
                : "Group interchangeable brands"
            }
          >
            Group brands
          </button>
          <Link href="/supplements/new" className="btn-primary">
            + Add supplement
          </Link>
        </div>
      </div>

      <div className="space-y-2">
        {groups.map((group) => (
          <GroupListItem
            key={group._id}
            group={group}
            householdId={householdId}
          />
        ))}
        {ungrouped.map((supplement) => (
          <SupplementListItem key={supplement._id} supplement={supplement} />
        ))}
      </div>

      {supplements.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <p>No supplements yet. Start by adding one!</p>
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
