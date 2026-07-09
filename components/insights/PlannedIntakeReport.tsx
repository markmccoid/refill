"use client";

import { useMemo, useState } from "react";

export const PLANNED_INTAKE_PRESETS = [30, 90, 180, 365] as const;

export type PlannedIntakeRangePreset = (typeof PLANNED_INTAKE_PRESETS)[number];

export type PlannedIntakeViewMode = "chart" | "table";

export type PlannedIntakeFilterOption = {
  value: string;
  label: string;
  description?: string;
};

export type PlannedIntakeSeriesItem = {
  personId: string;
  estimatedPills: number;
};

export type PlannedIntakePoint = {
  dateLabel: string;
  totalEstimatedPills: number;
  series: PlannedIntakeSeriesItem[];
};

export type PlannedIntakeSummary = {
  estimatedPills: number;
  averagePillsPerDay: number;
  activeDays: number;
  pausedDays: number;
};

export type PlannedIntakeReportProps = {
  title?: string;
  subtitle?: string;
  caveat?: string;
  loading?: boolean;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  coverageNote?: string;
  rangeDays: PlannedIntakeRangePreset;
  onRangeDaysChange: (rangeDays: PlannedIntakeRangePreset) => void;
  personFilter: string;
  onPersonFilterChange: (value: string) => void;
  personOptions: PlannedIntakeFilterOption[];
  subjectFilter: string;
  onSubjectFilterChange: (value: string) => void;
  subjectOptions: PlannedIntakeFilterOption[];
  summary?: PlannedIntakeSummary;
  points: PlannedIntakePoint[];
  defaultView?: PlannedIntakeViewMode;
};

function formatPills(value: number): string {
  const rounded =
    Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(rounded);
}

function formatRangeLabel(days: PlannedIntakeRangePreset): string {
  return `${days}-day`;
}

function filterName(options: PlannedIntakeFilterOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? "All";
}

export function PlannedIntakeReport({
  title = "Estimated planned intake",
  subtitle = "A read-only estimate reconstructed from dosage changes and pauses.",
  caveat = "Based on recorded dosage changes and pauses; this does not confirm what was actually taken.",
  loading = false,
  emptyStateTitle = "No estimated planned intake available",
  emptyStateDescription = "There are no dosage intervals in this range yet, or the selected filters remove all rows.",
  coverageNote,
  rangeDays,
  onRangeDaysChange,
  personFilter,
  onPersonFilterChange,
  personOptions,
  subjectFilter,
  onSubjectFilterChange,
  subjectOptions,
  summary,
  points,
  defaultView = "chart",
}: PlannedIntakeReportProps) {
  const [view, setView] = useState<PlannedIntakeViewMode>(defaultView);

  const visiblePeople = useMemo(() => {
    const fromPoints = new Map<string, { personId: string; estimatedPills: number }>();
    for (const point of points) {
      for (const item of point.series) {
        const existing = fromPoints.get(item.personId);
        if (existing) {
          existing.estimatedPills += item.estimatedPills;
        } else {
          fromPoints.set(item.personId, {
            personId: item.personId,
            estimatedPills: item.estimatedPills,
          });
        }
      }
    }

    const selectedPeople =
      personFilter === "all"
        ? personOptions
        : personOptions.filter((option) => option.value === personFilter);

    return selectedPeople.filter((option) => {
      if (personFilter === "all") return true;
      return fromPoints.has(option.value) || points.length === 0;
    });
  }, [personFilter, personOptions, points]);

  const maxValue = useMemo(() => {
    if (points.length === 0) return 0;
    return Math.max(
      ...points.map((point) =>
        personFilter === "all"
          ? point.series.reduce((sum, item) => sum + item.estimatedPills, 0)
          : point.series
              .filter((item) => item.personId === personFilter)
              .reduce((sum, item) => sum + item.estimatedPills, 0)
      )
    );
  }, [personFilter, points]);

  const currentPersonLabel = filterName(personOptions, personFilter);
  const currentSubjectLabel = filterName(subjectOptions, subjectFilter);

  const tableColumns =
    personFilter === "all"
      ? personOptions
      : personOptions.filter((option) => option.value === personFilter);

  const hasData = points.length > 0;

  if (loading) {
    return (
      <section className="space-y-5 max-w-6xl" aria-busy="true">
        <Header title={title} subtitle={subtitle} caveat={caveat} />
        <LoadingState />
      </section>
    );
  }

  return (
    <section className="space-y-5 max-w-6xl" aria-labelledby="planned-intake-report-title">
      <Header title={title} subtitle={subtitle} caveat={caveat} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-border bg-surface-alt px-3 py-1 text-xs font-medium text-text-muted">
          Estimated data
        </span>
        <span className="text-xs text-text-faint">
          {formatRangeLabel(rangeDays)} report
        </span>
        <span className="text-xs text-text-faint">
          Person: <span className="text-text">{currentPersonLabel}</span>
        </span>
        <span className="text-xs text-text-faint">
          Supplement/group: <span className="text-text">{currentSubjectLabel}</span>
        </span>
      </div>

      {coverageNote && (
        <div
          role="status"
          className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-text"
        >
          {coverageNote}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_auto_auto_auto]">
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-label">
            Range
          </span>
          <div className="flex flex-wrap gap-2">
            {PLANNED_INTAKE_PRESETS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => onRangeDaysChange(days)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  rangeDays === days
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-surface hover:border-primary/50 hover:bg-primary-light"
                }`}
              >
                {days} days
              </button>
            ))}
          </div>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-label">
            Person
          </span>
          <select
            value={personFilter}
            onChange={(event) => onPersonFilterChange(event.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
          >
            <option value="all">All people</option>
            {personOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-label">
            Supplement/group
          </span>
          <select
            value={subjectFilter}
            onChange={(event) => onSubjectFilterChange(event.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
          >
            <option value="all">All subjects</option>
            {subjectOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end gap-2">
          <div className="inline-flex rounded-lg border border-border bg-surface-alt p-1">
            <button
              type="button"
              aria-pressed={view === "chart"}
              onClick={() => setView("chart")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "chart"
                  ? "bg-surface text-text shadow-sm"
                  : "text-text-muted hover:text-text"
              }`}
            >
              Chart
            </button>
            <button
              type="button"
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "table"
                  ? "bg-surface text-text shadow-sm"
                  : "text-text-muted hover:text-text"
              }`}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      <SummaryRow summary={summary} />

      {!hasData ? (
        <EmptyState
          title={emptyStateTitle}
          description={emptyStateDescription}
          personLabel={currentPersonLabel}
          subjectLabel={currentSubjectLabel}
          rangeDays={rangeDays}
        />
      ) : view === "chart" ? (
        <div className="card p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="planned-intake-report-title" className="text-base font-semibold">
                Estimated planned intake by day
              </h2>
              <p className="text-sm text-text-muted">
                Grouped by person. Each bar reflects scheduled intake, not confirmed ingestion.
              </p>
            </div>
            <Legend personOptions={visiblePeople.length > 0 ? visiblePeople : personOptions} />
          </div>

          <Chart
            points={points}
            people={personFilter === "all" ? personOptions : tableColumns}
            maxValue={maxValue}
          />
        </div>
      ) : (
        <div className="card p-4 space-y-3">
          <div>
            <h2 className="text-base font-semibold">Estimated planned intake table</h2>
            <p className="text-sm text-text-muted">
              Precise values for screen readers and quick scanning.
            </p>
          </div>
          <Table
            points={points}
            people={tableColumns}
            personFilter={personFilter}
          />
        </div>
      )}
    </section>
  );
}

function Header({
  title,
  subtitle,
  caveat,
}: {
  title: string;
  subtitle: string;
  caveat: string;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <h1 id="planned-intake-report-title" className="text-2xl font-bold tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-text-muted">{subtitle}</p>
      </div>
      <div className="rounded-lg border border-border bg-surface-alt px-4 py-3">
        <p className="text-sm text-text">{caveat}</p>
      </div>
    </div>
  );
}

function SummaryRow({ summary }: { summary?: PlannedIntakeSummary }) {
  if (!summary) return null;

  const cards = [
    {
      label: "Estimated pills",
      value: formatPills(summary.estimatedPills),
    },
    {
      label: "Average per day",
      value: formatPills(summary.averagePillsPerDay),
    },
    {
      label: "Active days",
      value: String(summary.activeDays),
    },
    {
      label: "Paused days",
      value: String(summary.pausedDays),
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="card px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-text-faint">
            {card.label}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{card.value}</div>
        </div>
      ))}
    </div>
  );
}

function Legend({
  personOptions,
}: {
  personOptions: PlannedIntakeFilterOption[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {personOptions.map((option, index) => (
        <span
          key={option.value}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-muted"
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: legendColor(index) }}
          />
          {option.label}
        </span>
      ))}
    </div>
  );
}

function Chart({
  points,
  people,
  maxValue,
}: {
  points: PlannedIntakePoint[];
  people: PlannedIntakeFilterOption[];
  maxValue: number;
}) {
  const max = Math.max(maxValue, 1);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid items-end gap-3" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
          {points.map((point) => {
            const selectedSeries = people.map((person, index) => {
              const value = point.series.find((item) => item.personId === person.value)?.estimatedPills ?? 0;
              return { ...person, value, color: legendColor(index) };
            });
            const total = point.totalEstimatedPills;

            return (
              <div key={point.dateLabel} className="space-y-2">
                <div
                  className="relative flex h-64 items-end overflow-hidden rounded-xl border border-border bg-surface-alt px-2 py-2"
                  role="img"
                  aria-label={`${point.dateLabel}: ${formatPills(total)} estimated pills`}
                >
                  <div className="flex h-full w-full items-end gap-1">
                    {selectedSeries.map((person) => {
                      const heightPct = total > 0 ? (person.value / max) * 100 : 0;
                      return (
                        <div
                          key={person.value + person.label}
                          className="flex-1 self-end rounded-t-md"
                          style={{
                            backgroundColor: person.color,
                            height: `${Math.max(heightPct, person.value > 0 ? 4 : 0)}%`,
                            opacity: person.value > 0 ? 0.92 : 0.15,
                          }}
                          title={`${person.label}: ${formatPills(person.value)}`}
                        />
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1 text-center">
                  <div className="text-sm font-semibold tabular-nums">{formatPills(total)}</div>
                  <div className="text-[11px] text-text-muted">{point.dateLabel}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-text-muted">
          {people.map((person, index) => (
            <span key={person.value} className="inline-flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: legendColor(index) }}
              />
              {person.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Table({
  points,
  people,
  personFilter,
}: {
  points: PlannedIntakePoint[];
  people: PlannedIntakeFilterOption[];
  personFilter: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Estimated planned intake table for the selected range and filters.
        </caption>
        <thead>
          <tr className="border-b border-border-strong text-left text-xs uppercase tracking-wide text-text-faint">
            <th className="py-2 pr-3 font-semibold">Date</th>
            <th className="py-2 pr-3 font-semibold">Total</th>
            {people.map((person) => (
              <th key={person.value} className="py-2 pr-3 font-semibold">
                {person.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.dateLabel} className="border-b border-border/70 align-top">
              <td className="py-3 pr-3 font-medium">{point.dateLabel}</td>
              <td className="py-3 pr-3 tabular-nums">{formatPills(point.totalEstimatedPills)}</td>
              {people.map((person, index) => {
                const value = point.series.find((item) => item.personId === person.value)?.estimatedPills ?? 0;
                return (
                  <td key={person.value} className="py-3 pr-3 tabular-nums">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: legendColor(index) }}
                      />
                      {formatPills(value)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {personFilter === "all" && (
        <p className="mt-2 text-xs text-text-faint">
          Values are grouped by person so the table can be read independently of the chart.
        </p>
      )}
    </div>
  );
}

function EmptyState({
  title,
  description,
  personLabel,
  subjectLabel,
  rangeDays,
}: {
  title: string;
  description: string;
  personLabel: string;
  subjectLabel: string;
  rangeDays: PlannedIntakeRangePreset;
}) {
  return (
    <div className="card p-8 text-center space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-text-muted max-w-2xl mx-auto">{description}</p>
      <div className="text-xs text-text-faint">
        Range: {rangeDays} days · Person: {personLabel} · Supplement/group: {subjectLabel}
      </div>
      <p className="text-xs text-text-faint">
        Estimated planned intake is reconstructed from saved dosage history and paused intervals.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card p-4 space-y-3 animate-pulse">
            <div className="h-3 w-24 rounded bg-text/10" />
            <div className="h-8 w-28 rounded bg-text/10" />
          </div>
        ))}
      </div>

      <div className="card p-4 space-y-3 animate-pulse">
        <div className="h-4 w-56 rounded bg-text/10" />
        <div className="h-3 w-80 rounded bg-text/10" />
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-56 rounded-xl bg-text/5" />
          ))}
        </div>
      </div>
    </div>
  );
}

function legendColor(index: number): string {
  const palette = [
    "rgb(59 130 246)",
    "rgb(34 197 94)",
    "rgb(168 85 247)",
    "rgb(245 158 11)",
    "rgb(239 68 68)",
    "rgb(14 165 233)",
    "rgb(244 114 182)",
    "rgb(20 184 166)",
  ];

  return palette[index % palette.length];
}
