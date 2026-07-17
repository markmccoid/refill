"use client";

import { DosageInput } from "@/components/DosageInput";
import { colorValue } from "@/lib/person-colors";
import { dailyEquivalent } from "@/lib/add-supplement-utils";
import { Id } from "@/convex/_generated/dataModel";

interface PersonRow {
  _id: Id<"people">;
  name: string;
  color: string;
}

export function PersonDosageCard({
  person,
  active,
  pillsPerWeek,
  onToggle,
  onChange,
}: {
  person: PersonRow;
  active: boolean;
  pillsPerWeek: number;
  onToggle: (on: boolean) => void;
  onChange: (pillsPerWeek: number) => void;
}) {
  const initial = person.name.trim().charAt(0).toUpperCase() || "?";

  if (!active) {
    return (
      <div className="border border-dashed border-border-strong rounded-xl px-4 py-3.5 flex items-center gap-3.5 bg-surface">
        <span
          className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-sm font-bold text-white border-[1.5px] border-surface flex-shrink-0"
          style={{ backgroundColor: colorValue(person.color) }}
        >
          {initial}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{person.name}</div>
          <div className="text-[12.5px] text-text-muted">Doesn&apos;t take this yet</div>
        </div>
        <button
          type="button"
          onClick={() => onToggle(true)}
          className="btn-outline text-sm py-1.5 px-3 flex-shrink-0"
        >
          + Assign
        </button>
      </div>
    );
  }

  return (
    <div className="border border-border-strong rounded-xl px-4 py-3.5 space-y-3 bg-surface">
      <div className="flex flex-wrap items-center gap-3.5">
        <span
          className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-sm font-bold text-white border-[1.5px] border-surface flex-shrink-0"
          style={{ backgroundColor: colorValue(person.color) }}
        >
          {initial}
        </span>
        <div className="flex-1 min-w-[120px]">
          <div className="font-semibold">{person.name}</div>
          <div className="text-[12.5px] text-text-muted">
            {dailyEquivalent(pillsPerWeek)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggle(false)}
          className="text-sm text-critical hover:underline flex-shrink-0"
        >
          Remove
        </button>
      </div>
      <DosageInput value={pillsPerWeek} onChange={onChange} />
    </div>
  );
}
