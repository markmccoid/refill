"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useDemoHousehold } from "@/hooks/useDemoHousehold";
import { SupplementListItem } from "@/components/SupplementListItem";

export default function SupplementsPage() {
  const householdId = useDemoHousehold();
  const supplements = useQuery(
    api.supplements.list,
    householdId ? { householdId } : "skip"
  );

  if (!householdId) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!supplements) {
    return <div className="text-center py-12">Loading supplements...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Supplements</h1>
          <p className="text-text-muted text-sm mt-1">
            {supplements.length} supplements in your shelf
          </p>
        </div>
        <Link href="/supplements/new" className="btn-primary">
          + Add supplement
        </Link>
      </div>

      <div className="space-y-2">
        {supplements.map((supplement) => (
          <SupplementListItem key={supplement._id} supplement={supplement} />
        ))}
      </div>

      {supplements.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <p>No supplements yet. Start by adding one!</p>
        </div>
      )}
    </div>
  );
}
