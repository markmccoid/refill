"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { colorValue } from "@/lib/person-colors";

type CostRow = {
  personId: string;
  supplementId: string;
  /** Group rows have no supplement detail route, so they aren't linked. */
  isGroup?: boolean;
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

type SortKey =
  | "person"
  | "name"
  | "pillsPerWeek"
  | "costPerPill"
  | "perDay"
  | "perMonth";
type SortDirection = "asc" | "desc";

/** Text columns read best ascending first; numeric ones biggest-first. */
const DEFAULT_DIRECTION: Record<SortKey, SortDirection> = {
  person: "asc",
  name: "asc",
  pillsPerWeek: "desc",
  costPerPill: "desc",
  perDay: "desc",
  perMonth: "desc",
};

export function CostByPersonReport({
  rows,
  people,
  lifetime,
}: {
  rows: CostRow[];
  people: PersonTotal[];
  lifetime: number;
}) {
  // null = household view (everyone); otherwise focus a single person.
  const [focusedPersonId, setFocusedPersonId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("perMonth");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const focused = people.find((p) => p.personId === focusedPersonId) ?? null;

  const visibleRows = useMemo(() => {
    const personName = (personId: string) =>
      people.find((candidate) => candidate.personId === personId)?.name ?? "";
    const filtered = focused
      ? rows.filter((row) => row.personId === focused.personId)
      : rows;
    const factor = sortDirection === "asc" ? 1 : -1;
    return filtered.slice().sort((a, b) => {
      let comparison: number;
      if (sortKey === "person") {
        comparison = personName(a.personId).localeCompare(personName(b.personId));
      } else if (sortKey === "name") {
        comparison = a.name.localeCompare(b.name);
      } else {
        comparison = a[sortKey] - b[sortKey];
      }
      // Stable-feeling tiebreak so equal values keep a predictable order.
      if (comparison === 0) comparison = a.name.localeCompare(b.name);
      return comparison * factor;
    });
  }, [rows, people, focused, sortKey, sortDirection]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection(DEFAULT_DIRECTION[key]);
    }
  };

  const sortHeaderProps = (key: SortKey) => ({
    active: sortKey === key,
    direction: sortDirection,
    onSort: () => toggleSort(key),
  });

  return (
    <section className="space-y-5" aria-labelledby="cost-report-title">
      <div>
        <h2 id="cost-report-title" className="text-xl font-bold tracking-tight">
          Per-person cost breakdown
        </h2>
        <p className="text-sm text-text-muted mt-1">
          Current-rate estimate using active dosages and each subject&apos;s open bottle cost.
          Select a person to focus on just their detail.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((person) => {
          const isFocused = focused?.personId === person.personId;
          return (
            <button
              type="button"
              key={person.personId}
              onClick={() => {
                setFocusedPersonId(isFocused ? null : person.personId);
                // The Person column disappears when focused; don't strand the sort there.
                if (!isFocused && sortKey === "person") {
                  setSortKey("perMonth");
                  setSortDirection(DEFAULT_DIRECTION.perMonth);
                }
              }}
              aria-pressed={isFocused}
              className={`card p-4 text-left transition hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary ${
                isFocused ? "border-primary ring-1 ring-primary" : ""
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: colorValue(person.color) }}
                />
                {person.name}
              </div>
              <div className="mt-2 font-mono text-2xl font-bold">{money(person.perMonth)}</div>
              <div className="text-xs text-text-muted">per month · {money(person.perDay)}/day</div>
              <div className="mt-2 text-xs font-medium text-primary">
                {isFocused ? "Focused — click to show everyone" : "Focus this person"}
              </div>
            </button>
          );
        })}
        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-text-label">Lifetime paid</div>
          <div className="mt-2 font-mono text-2xl font-bold">{money(lifetime)}</div>
          <div className="text-xs text-text-muted">All logged bottles; not allocated by person</div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h3 className="font-semibold">
            {focused
              ? `${focused.name}’s supplements`
              : "Detail by person and supplement"}
          </h3>
          {focused && (
            <button
              type="button"
              onClick={() => setFocusedPersonId(null)}
              className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
            >
              Show all people
            </button>
          )}
        </div>
        {visibleRows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            {focused
              ? `${focused.name} has no active dosages to cost yet.`
              : "No active dosages to cost yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full text-sm ${focused ? "min-w-[560px]" : "min-w-[720px]"}`}>
              <caption className="sr-only">
                {focused
                  ? `Current estimated cost by supplement for ${focused.name}`
                  : "Current estimated cost by person and supplement"}
              </caption>
              <thead className="border-b border-border-strong text-left text-xs font-semibold text-text-label">
                <tr>
                  {!focused && (
                    <SortableHeader label="Person" {...sortHeaderProps("person")} />
                  )}
                  <SortableHeader label="Supplement / group" {...sortHeaderProps("name")} />
                  <SortableHeader label="Pills/week" align="right" {...sortHeaderProps("pillsPerWeek")} />
                  <SortableHeader label="Cost/pill" align="right" {...sortHeaderProps("costPerPill")} />
                  <SortableHeader label="Per day" align="right" {...sortHeaderProps("perDay")} />
                  <SortableHeader label="Per month" align="right" {...sortHeaderProps("perMonth")} />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleRows.map((row, index) => {
                  const person = people.find((candidate) => candidate.personId === row.personId);
                  return (
                    <tr key={`${row.personId}-${row.supplementId}-${index}`}>
                      {!focused && (
                        <td className="px-4 py-3 font-medium">{person?.name ?? "Unknown person"}</td>
                      )}
                      <td className="px-4 py-3">
                        {row.isGroup ? (
                          <span>
                            {row.name}
                            <span className="ml-2 text-xs text-text-faint">group</span>
                          </span>
                        ) : (
                          <Link
                            href={`/supplements/${row.supplementId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {row.name} <span aria-hidden="true">↗</span>
                            <span className="sr-only">(opens in a new tab)</span>
                          </Link>
                        )}
                      </td>
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

/** A column header that sorts the detail table; click again to reverse. */
function SortableHeader({
  label,
  align = "left",
  active,
  direction,
  onSort,
}: {
  label: string;
  align?: "left" | "right";
  active: boolean;
  direction: SortDirection;
  onSort: () => void;
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-2 ${align === "right" ? "text-right" : ""}`}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={onSort}
        className={`inline-flex items-center gap-1 rounded hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary ${
          align === "right" ? "flex-row-reverse" : ""
        } ${active ? "text-text" : ""}`}
      >
        {label}
        <span aria-hidden="true" className={active ? "" : "text-text-faint"}>
          {active ? (direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}
