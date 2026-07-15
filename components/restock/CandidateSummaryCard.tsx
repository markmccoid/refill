"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  CandidateDrawer,
  type CandidateSubjectKind,
} from "@/components/restock/CandidateDrawer";

/**
 * Subject-page summary: candidate count, short label preview, Manage opens the
 * shared CandidateDrawer (ADR-0009 / Variant C).
 */
export function CandidateSummaryCard({
  householdId,
  subjectKind,
  subjectId,
  subjectName,
}: {
  householdId: Id<"households">;
  subjectKind: CandidateSubjectKind;
  subjectId: Id<"supplements"> | Id<"groups">;
  subjectName: string;
}) {
  const [open, setOpen] = useState(false);
  const candidates = useQuery(
    api.candidateProducts.listBySubject,
    subjectKind === "supplement"
      ? { supplementId: subjectId as Id<"supplements"> }
      : { groupId: subjectId as Id<"groups"> }
  );

  const count = candidates?.length ?? 0;
  const preview = (candidates ?? [])
    .slice(0, 3)
    .map((c) => c.label)
    .filter(Boolean);

  return (
    <>
      <div className="rounded-lg bg-surface-alt border border-border p-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Restock options</p>
          {candidates === undefined ? (
            <p className="text-xs text-text-muted">Loading…</p>
          ) : count === 0 ? (
            <p className="text-xs text-text-muted">
              No saved product links yet
            </p>
          ) : (
            <p className="text-xs text-text-muted truncate">
              {count} saved {count === 1 ? "link" : "links"}
              {preview.length > 0 ? ` · ${preview.join(" · ")}` : ""}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-3 py-1.5 text-sm font-semibold border border-border-strong rounded-lg hover:bg-text/5 shrink-0"
        >
          Manage →
        </button>
      </div>

      <CandidateDrawer
        open={open}
        onClose={() => setOpen(false)}
        householdId={householdId}
        subjectKind={subjectKind}
        subjectId={subjectId}
        subjectName={subjectName}
        openedFrom="subject"
      />
    </>
  );
}
