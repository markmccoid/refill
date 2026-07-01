import { SupplementStatus } from "@/lib/supplement-utils";

interface PillBottleProps {
  fillPct: number;
  status: SupplementStatus;
}

const statusBgColor = {
  critical: "bg-critical",
  low: "bg-low",
  "on-track": "bg-on-track",
  stocked: "bg-stocked",
};

export function PillBottle({ fillPct, status }: PillBottleProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-32">
        {/* Cap */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-10 h-3 bg-surface-alt rounded-t-full border border-black/13"></div>

        {/* Bottle Body */}
        <div className="absolute top-3 left-0 right-0 w-full h-28 bg-surface-alt border-2 border-black/13 rounded-b-md overflow-hidden">
          {/* Fill */}
          <div
            className={`absolute bottom-0 left-0 right-0 w-full ${statusBgColor[status]} opacity-85 transition-all`}
            style={{ height: `${fillPct}%` }}
          />

          {/* Fill Percentage Label */}
          <div className="absolute inset-0 flex items-center justify-center text-xs font-mono font-bold text-text mix-blend-multiply">
            {Math.round(fillPct)}%
          </div>
        </div>
      </div>
    </div>
  );
}
