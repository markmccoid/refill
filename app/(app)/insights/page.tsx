"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useHousehold } from "@/hooks/useHousehold";
import { colorValue } from "@/lib/person-colors";
import { PersonColumn } from "@/components/insights/PersonColumn";
import { PersonDetail } from "@/components/insights/PersonDetail";

export default function InsightsPage() {
  const householdId = useHousehold();
  const summary = useQuery(
    api.insights.summary,
    householdId ? { householdId } : "skip"
  );

  const [mode, setMode] = useState<"compare" | "detail">("compare");
  const [activePerson, setActivePerson] = useState(0);

  if (!householdId || !summary) {
    return <div className="text-center py-12">Loading insights…</div>;
  }

  const { people } = summary;

  // No people at all.
  if (people.length === 0) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Header />
        <div className="card p-8 text-center">
          <p className="text-text-muted">
            Add people and supplements to see a per-person nutrient breakdown.
          </p>
        </div>
      </div>
    );
  }

  // Nobody has any data.
  const anyoneHasData = people.some(
    (p) => p.nutrients.length > 0 || p.noDv.length > 0
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <Header />

      {/* Mode toggle */}
      <div className="flex items-center gap-1 p-1 bg-surface-alt rounded-lg w-fit border border-border">
        <button
          onClick={() => setMode("compare")}
          className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
            mode === "compare"
              ? "bg-surface shadow-sm text-text"
              : "text-text-muted hover:text-text"
          }`}
        >
          Compare
        </button>
        <button
          onClick={() => setMode("detail")}
          className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
            mode === "detail"
              ? "bg-surface shadow-sm text-text"
              : "text-text-muted hover:text-text"
          }`}
        >
          Detail
        </button>
      </div>

      {!anyoneHasData && (
        <div className="card p-6 text-sm text-text-muted">
          None of your supplements have label data yet. Open a supplement and
          add its Supplement Facts — pull them from DSLD with{" "}
          <span className="font-medium text-text">Find details</span> or enter
          them manually — that&apos;s what these charts are built from.
        </div>
      )}

      {mode === "compare" && (
        <div
          className="grid gap-6"
          style={{
            gridTemplateColumns: `repeat(${people.length}, minmax(0, 1fr))`,
          }}
        >
          {people.map((p) => (
            <PersonColumn key={p.personId} person={p} />
          ))}
        </div>
      )}

      {mode === "detail" && (
        <div className="space-y-5">
          {/* Person tabs */}
          <div className="flex gap-2 border-b border-border-strong">
            {people.map((p, i) => (
              <button
                key={p.personId}
                onClick={() => setActivePerson(i)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activePerson === i
                    ? "border-primary text-text"
                    : "border-transparent text-text-muted hover:text-text"
                }`}
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: colorValue(p.color) }}
                />
                {p.name}
              </button>
            ))}
          </div>
          <PersonDetail person={people[activePerson] ?? people[0]} />
        </div>
      )}

      <p className="text-[11px] text-text-faint pt-4 border-t border-border">
        Sums each supplement&apos;s label %DV scaled by how many servings/day the
        person takes. Grouped supplements count only the currently-open brand.
        For informational use only — not medical advice, and %DV has limits for
        supplements without an established Daily Value.
      </p>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
      <p className="text-text-muted text-sm mt-1">
        Each person&apos;s daily nutrient intake across their supplements — %DV
        at current dosages, with stacking called out.
      </p>
    </div>
  );
}
