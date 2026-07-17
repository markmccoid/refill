"use client";

import type { BottleFieldsValue } from "@/components/BottleFields";
import { SupplementThumb } from "@/components/SupplementThumb";
import {
  bottleCapLabel,
  bottleFillPct,
  formatLongDate,
  formatShortDate,
  isIncomingBottle,
  storeLabel,
} from "@/lib/add-supplement-utils";
import { Id } from "@/convex/_generated/dataModel";

interface PersonLine {
  _id: Id<"people">;
  name: string;
  pillsPerWeek: number;
}

export function BottleGlyph({
  bottle,
  faded,
}: {
  bottle: BottleFieldsValue;
  faded?: boolean;
}) {
  const pct = bottleFillPct(bottle);
  return (
    <div
      className={`relative w-[34px] h-[52px] border-2 border-text-label rounded-[7px_7px_9px_9px] overflow-hidden bg-surface flex-shrink-0 ${
        faded ? "opacity-55" : ""
      }`}
    >
      <div
        className="absolute -top-2 left-2 right-2 h-2 border-2 border-text-label border-b-0 rounded-t"
        aria-hidden
      />
      <div
        className="absolute left-0 right-0 bottom-0 bg-primary opacity-75"
        style={{ height: `${pct}%` }}
      />
    </div>
  );
}

export function BottleCard({
  bottle,
  onRemove,
}: {
  bottle: BottleFieldsValue;
  onRemove: () => void;
}) {
  const incoming = isIncomingBottle(bottle);
  const cap = bottleCapLabel(bottle);
  const countLabel =
    bottle.remaining < bottle.count && !incoming
      ? `${bottle.remaining} / ${bottle.count}`
      : `${bottle.count}`;

  return (
    <div
      className={`relative border rounded-xl p-3.5 bg-surface ${
        incoming
          ? "border-dashed border-border-strong bg-surface-alt"
          : "border-border-strong"
      }`}
    >
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-2 right-2.5 text-text-faint hover:text-critical text-[15px] leading-none"
        aria-label="Remove bottle"
      >
        ✕
      </button>
      <div className="flex items-end gap-2.5 mb-2.5">
        <BottleGlyph bottle={bottle} faded={incoming} />
        <div>
          <div className="font-mono text-[17px] font-semibold">
            {countLabel}{" "}
            <span className="text-xs font-normal">pills</span>
          </div>
          <div
            className={`text-[11.5px] ${
              incoming ? "text-primary font-semibold" : "text-text-faint"
            }`}
          >
            {cap}
          </div>
        </div>
      </div>
      <div className="text-[12.5px] text-text-muted flex flex-col gap-0.5">
        {bottle.price > 0 || bottle.purchaseUrl ? (
          <span className="font-mono text-xs">
            {bottle.price > 0 ? `$${bottle.price.toFixed(2)}` : "—"}
            {bottle.purchaseUrl ? ` · ${storeLabel(bottle.purchaseUrl)}` : ""}
          </span>
        ) : null}
        <span>
          {incoming
            ? "Won't be counted until it arrives"
            : `Bought ${formatLongDate(bottle.purchasedAt)}`}
        </span>
      </div>
    </div>
  );
}

export function SummaryRail({
  supplementName,
  imageUrl,
  iconId,
  bottles,
  groupMode,
  groupName,
  memberCount,
  joinExisting,
  dosageLines,
  dosageFromGroup,
}: {
  supplementName: string;
  imageUrl?: string;
  iconId?: string;
  bottles: BottleFieldsValue[];
  groupMode: "solo" | "group";
  groupName?: string;
  memberCount?: number;
  joinExisting: boolean;
  dosageLines: PersonLine[];
  dosageFromGroup: boolean;
}) {
  const displayName = supplementName.trim() || "Untitled supplement";

  return (
    <aside className="hidden md:block sticky top-[76px]">
      <div className="card p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-text-label mb-3">
          You&apos;re adding
        </div>
        <div className="text-[13px]">
          {groupMode === "group" && groupName && (
            <div className="mb-2.5 pb-2.5 border-b border-dashed border-border-strong text-[12.5px] text-text-muted">
              {joinExisting ? (
                <>
                  Joins group
                  <br />
                  <b className="text-primary">
                    🗂️ {groupName}
                    {memberCount !== undefined
                      ? ` (${memberCount + 1}${ordinal(memberCount + 1)} brand)`
                      : ""}
                  </b>
                </>
              ) : (
                <>
                  Starts new group
                  <br />
                  <b className="text-primary">🗂️ {groupName} (1st brand)</b>
                </>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 font-bold">
            <SupplementThumb
              iconId={iconId}
              imageUrl={imageUrl}
              name={displayName}
              size="sm"
            />
            <span className="truncate">{displayName}</span>
          </div>
          {bottles.length > 0 ? (
            <ul className="list-none mt-2 ml-3.5 border-l-[1.5px] border-border-strong pl-0">
              {bottles.map((b, i) => {
                const incoming = isIncomingBottle(b);
                const partial =
                  !incoming && b.remaining < b.count && b.remaining > 0;
                const label = incoming
                  ? `🍶 ${b.count}ct — arriving ${formatShortDate(b.purchasedAt)}`
                  : partial
                    ? `🍶 ${b.remaining}/${b.count} — in use${b.price > 0 ? ` · $${b.price.toFixed(2)}` : ""}`
                    : `🍶 ${b.count}ct — full${b.price > 0 ? ` · $${b.price.toFixed(2)}` : ""}`;
                return (
                  <li
                    key={i}
                    className={`relative py-1 pl-4 text-[12.5px] before:content-[''] before:absolute before:left-0 before:top-3.5 before:w-[11px] before:h-[1.5px] before:bg-border-strong ${
                      incoming ? "text-text-faint italic" : "text-text-muted"
                    }`}
                  >
                    <b className="text-text font-semibold">{label}</b>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[12.5px] text-text-faint italic mt-2 ml-1">
              No bottles yet
            </p>
          )}
          <ul className="list-none mt-2.5 border-l-0 ml-0">
            <li className="py-1 text-[12.5px] text-text-muted">
              👤{" "}
              {dosageFromGroup ? (
                <>
                  Dosage: from group
                  {dosageLines.length > 0 && (
                    <span className="block text-xs mt-0.5">
                      {dosageLines
                        .map((p) => `${p.name} ${p.pillsPerWeek}/wk`)
                        .join(" · ")}
                    </span>
                  )}
                </>
              ) : dosageLines.length > 0 ? (
                <>
                  Dosage:{" "}
                  {dosageLines
                    .map((p) => `${p.name} ${p.pillsPerWeek}/wk`)
                    .join(" · ")}
                </>
              ) : (
                <span className="text-text-faint italic">No dosage set</span>
              )}
            </li>
          </ul>
        </div>
      </div>
      <p className="text-xs text-text-faint mt-2.5 px-1 leading-relaxed">
        One <b className="text-text font-semibold">supplement</b> (the product)
        can hold many <b className="text-text font-semibold">bottles</b> (your
        jars). Groups pool several brands into one supply.
      </p>
    </aside>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
