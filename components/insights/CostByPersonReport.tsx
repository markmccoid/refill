"use client";

type CostRow = {
  personId: string;
  supplementId: string;
  name: string;
  pillsPerWeek: number;
  costPerPill: number;
  perDay: number;
  perMonth: number;
};

type PersonTotal = {
  personId: string;
  name: string;
  color: string;
  perDay: number;
  perWeek: number;
  perMonth: number;
};

const money = (value: number) => `$${value.toFixed(2)}`;

export function CostByPersonReport({
  rows,
  people,
  lifetime,
}: {
  rows: CostRow[];
  people: PersonTotal[];
  lifetime: number;
}) {
  return (
    <section className="space-y-5" aria-labelledby="cost-report-title">
      <div>
        <h2 id="cost-report-title" className="text-xl font-bold tracking-tight">
          Per-person cost breakdown
        </h2>
        <p className="text-sm text-text-muted mt-1">
          Current-rate estimate using active dosages and each subject&apos;s open bottle cost.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((person) => (
          <div className="card p-4" key={person.personId}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: person.color }} />
              {person.name}
            </div>
            <div className="mt-2 font-mono text-2xl font-bold">{money(person.perMonth)}</div>
            <div className="text-xs text-text-muted">per month · {money(person.perDay)}/day</div>
          </div>
        ))}
        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-text-label">Lifetime paid</div>
          <div className="mt-2 font-mono text-2xl font-bold">{money(lifetime)}</div>
          <div className="text-xs text-text-muted">All logged bottles; not allocated by person</div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-semibold">Detail by person and supplement</h3>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-muted">No active dosages to cost yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Current estimated cost by person and supplement</caption>
              <thead className="border-b border-border-strong text-left text-xs font-semibold text-text-label">
                <tr>
                  <th className="px-4 py-2">Person</th>
                  <th className="px-4 py-2">Supplement / group</th>
                  <th className="px-4 py-2 text-right">Pills/week</th>
                  <th className="px-4 py-2 text-right">Cost/pill</th>
                  <th className="px-4 py-2 text-right">Per day</th>
                  <th className="px-4 py-2 text-right">Per month</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, index) => {
                  const person = people.find((candidate) => candidate.personId === row.personId);
                  return (
                    <tr key={`${row.personId}-${row.supplementId}-${index}`}>
                      <td className="px-4 py-3 font-medium">{person?.name ?? "Unknown person"}</td>
                      <td className="px-4 py-3">{row.name}</td>
                      <td className="px-4 py-3 text-right font-mono">{row.pillsPerWeek}</td>
                      <td className="px-4 py-3 text-right font-mono">{money(row.costPerPill)}</td>
                      <td className="px-4 py-3 text-right font-mono">{money(row.perDay)}</td>
                      <td className="px-4 py-3 text-right font-mono">{money(row.perMonth)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-text-muted">
        Monthly figures are a 30-day current-rate estimate, not historical spending. Grouped brands appear as one consumed subject.
      </p>
    </section>
  );
}
