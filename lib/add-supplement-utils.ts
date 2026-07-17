import { isBottleAvailable } from "@/lib/supplement-utils";
import type { BottleFieldsValue } from "@/components/BottleFields";

export function toDateInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function fromDateInput(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0).getTime();
}

export function storeLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function formatShortDate(dateInput: string): string {
  const d = new Date(fromDateInput(dateInput));
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatLongDate(dateInput: string): string {
  const d = new Date(fromDateInput(dateInput));
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function isIncomingBottle(bottle: BottleFieldsValue): boolean {
  return !isBottleAvailable(fromDateInput(bottle.purchasedAt));
}

export function bottleFillPct(bottle: BottleFieldsValue): number {
  if (bottle.count <= 0) return 0;
  return Math.round((bottle.remaining / bottle.count) * 100);
}

export function bottleCapLabel(bottle: BottleFieldsValue): string {
  if (isIncomingBottle(bottle)) {
    return `⏳ arriving ${formatShortDate(bottle.purchasedAt)}`;
  }
  if (bottle.remaining >= bottle.count) return "full · unopened";
  if (bottle.remaining <= 0) return "empty";
  return "partially used";
}

export const emptyBottleDraft = (count: number): BottleFieldsValue => ({
  count,
  price: 0,
  purchaseUrl: "",
  purchasedAt: toDateInput(Date.now()),
  remaining: count,
});

export function resolveJarSize(
  dsldSuggestion: number | undefined | null,
  bottles: BottleFieldsValue[],
  fallback = 120
): number {
  if (dsldSuggestion && dsldSuggestion > 0) return dsldSuggestion;
  if (bottles.length > 0 && bottles[0].count > 0) return bottles[0].count;
  return fallback;
}

export function dailyEquivalent(pillsPerWeek: number): string {
  const perDay = pillsPerWeek / 7;
  const rounded = Number.isInteger(perDay)
    ? perDay
    : Math.round(perDay * 10) / 10;
  const unit = rounded === 1 ? "pill" : "pills";
  if (rounded === 0) return "Doesn't take this";
  if (Number.isInteger(rounded) && rounded > 0) {
    return `${rounded} ${unit} every day`;
  }
  return `≈ ${rounded} ${unit} per day`;
}
