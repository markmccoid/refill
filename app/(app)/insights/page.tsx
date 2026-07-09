"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useHousehold } from "@/hooks/useHousehold";
import { CostByPersonReport } from "@/components/insights/CostByPersonReport";
import { PersonDetail } from "@/components/insights/PersonDetail";
import { colorValue } from "@/lib/person-colors";

type ReportId = "cost" | "intake" | "regimen" | "inventory" | "nutrients";

const reportCards: { id: ReportId; title: string; description: string; basis: string }[] = [
  { id: "cost", title: "Per-person costs", description: "See which supplements drive each person’s current monthly cost.", basis: "Current-rate estimate" },
  { id: "intake", title: "Planned intake over time", description: "Review estimated scheduled pills across a selected historical range.", basis: "Estimated planned intake" },
  { id: "regimen", title: "Current regimen", description: "Compare who takes what, including dosage and pause status.", basis: "Current snapshot" },
  { id: "inventory", title: "Inventory outlook", description: "Review run-out pressure and the supplements that need attention.", basis: "Current snapshot" },
  { id: "nutrients", title: "Nutrient coverage", description: "Compare current label-based nutrient intake by person.", basis: "Current dosage + label data" },
];

const money = (value: number) => `$${value.toFixed(2)}`;

export default function InsightsPage() {
  const householdId = useHousehold();
  const searchParams = useSearchParams();
  const [selectedReport, setSelectedReport] = useState<ReportId | null>(null);
  const [activePerson, setActivePerson] = useState(0);
  const summary = useQuery(api.insights.summary, householdId ? { householdId } : "skip");
  const costs = useQuery(api.costs.summary, householdId ? { householdId } : "skip");
  const urgentCount = useQuery(api.restock.badgeCount, householdId ? { householdId } : "skip");

  useEffect(() => {
    if (searchParams.get("view") === "overview") {
      setSelectedReport(null);
    }
  }, [searchParams]);

  if (!householdId || !summary || !costs || urgentCount === undefined) {
    return <div className="text-center py-12">Loading insights…</div>;
  }

  const people = summary.people;

  return (
    <div className="space-y-7 max-w-6xl">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
        <p className="text-text-muted text-sm mt-1">
          Plan the household regimen, understand its cost, and see what needs attention.
        </p>
      </header>

      <section aria-label="Household KPIs" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Monthly cost" value={money(costs.household.perMonth)} detail="current-rate estimate" />
        <Kpi label="Lifetime paid" value={money(costs.household.lifetime)} detail="all logged bottles" />
        <Kpi label="Active people" value={String(people.length)} detail="included in current costs" />
        <Kpi label="Needs attention" value={String(urgentCount)} detail="within forecast window" accent={urgentCount > 0} />
      </section>

      {!selectedReport ? (
        <section aria-labelledby="report-list-title" className="space-y-3">
          <div>
            <h2 id="report-list-title" className="text-lg font-bold">Reports</h2>
            <p className="text-sm text-text-muted">Choose a report to explore the details.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {reportCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => setSelectedReport(card.id)}
                className="card p-5 text-left transition hover:border-primary hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">{card.title}</h3>
                    <p className="mt-1 text-sm text-text-muted">{card.description}</p>
                  </div>
                  <span className="text-text-muted" aria-hidden="true">→</span>
                </div>
                <div className="mt-4 text-xs font-medium text-primary">{card.basis}</div>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="space-y-5">
          <button
            type="button"
            onClick={() => setSelectedReport(null)}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
            aria-label="Back to Insights reports"
          >
            <span aria-hidden="true">←</span> Back to reports
          </button>
          {selectedReport === "cost" && (
            <CostByPersonReport rows={costs.perPersonSupplement ?? []} people={costs.perPerson} lifetime={costs.household.lifetime} />
          )}
          {selectedReport === "nutrients" && <NutrientReport people={people} activePerson={activePerson} setActivePerson={setActivePerson} />}
          {selectedReport === "regimen" && <ComingSoon title="Current regimen" description="This report will show each person’s active, paused, and planned supplement schedule." />}
          {selectedReport === "intake" && <ComingSoon title="Planned intake over time" description="This report will use dosage events to show estimated planned pills over the selected historical range." />}
          {selectedReport === "inventory" && <ComingSoon title="Inventory outlook" description="This report will bring the run-out timeline and current cost into one planning view." />}
        </section>
      )}
    </div>
  );
}

function Kpi({ label, value, detail, accent = false }: { label: string; value: string; detail: string; accent?: boolean }) {
  return <div className="card p-4 space-y-1"><div className="text-xs font-semibold text-text-label">{label}</div><div className={`text-2xl font-mono font-bold ${accent ? "text-critical" : ""}`}>{value}</div><div className="text-xs text-text-muted">{detail}</div></div>;
}

function NutrientReport({ people, activePerson, setActivePerson }: { people: Array<{ personId: string; name: string; color: string; nutrients: Parameters<typeof PersonDetail>[0]["person"]["nutrients"]; noDv: Parameters<typeof PersonDetail>[0]["person"]["noDv"]; skipped: Parameters<typeof PersonDetail>[0]["person"]["skipped"] }>; activePerson: number; setActivePerson: (index: number) => void }) {
  const anyoneHasData = people.some((p) => p.nutrients.length > 0 || p.noDv.length > 0);
  if (!anyoneHasData) return <ComingSoon title="Nutrient coverage" description="Add Supplement Facts to see label-based nutrient coverage." />;
  return <div className="space-y-5"><div><h2 className="text-xl font-bold">Nutrient coverage</h2><p className="text-sm text-text-muted mt-1">Current nutrient intake from recorded labels and dosages.</p></div><div className="flex gap-2 border-b border-border-strong">{people.map((p, i) => <button key={p.personId} onClick={() => setActivePerson(i)} className={`px-3 py-2 text-sm border-b-2 ${activePerson === i ? "border-primary text-text" : "border-transparent text-text-muted"}`}><span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: colorValue(p.color) }} />{p.name}</button>)}</div><PersonDetail person={people[activePerson] ?? people[0]} /></div>;
}

function ComingSoon({ title, description }: { title: string; description: string }) {
  return <div className="card p-8"><h2 className="text-xl font-bold">{title}</h2><p className="mt-2 text-sm text-text-muted">{description}</p><p className="mt-4 text-xs text-text-faint">The report card is reserved in the new Insights layout while its data projection is completed.</p></div>;
}
