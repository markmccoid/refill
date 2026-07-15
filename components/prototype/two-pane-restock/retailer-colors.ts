/** Stable accent per retailer — basket border, selected chip, and selected row share the same hue. */
export type RetailerAccent = {
  basketBorder: string;
  basketRing: string;
  chipSelected: string;
  selectedRow: string;
};

const PALETTE: RetailerAccent[] = [
  {
    basketBorder: "border-l-orange-500",
    basketRing: "ring-orange-300/50",
    chipSelected: "border-orange-500 bg-orange-50 text-orange-950 font-semibold",
    selectedRow: "border-orange-400 bg-orange-50/60",
  },
  {
    basketBorder: "border-l-emerald-500",
    basketRing: "ring-emerald-300/50",
    chipSelected: "border-emerald-600 bg-emerald-50 text-emerald-950 font-semibold",
    selectedRow: "border-emerald-500 bg-emerald-50/60",
  },
  {
    basketBorder: "border-l-violet-500",
    basketRing: "ring-violet-300/50",
    chipSelected: "border-violet-600 bg-violet-50 text-violet-950 font-semibold",
    selectedRow: "border-violet-500 bg-violet-50/60",
  },
  {
    basketBorder: "border-l-sky-500",
    basketRing: "ring-sky-300/50",
    chipSelected: "border-sky-600 bg-sky-50 text-sky-950 font-semibold",
    selectedRow: "border-sky-500 bg-sky-50/60",
  },
  {
    basketBorder: "border-l-rose-500",
    basketRing: "ring-rose-300/50",
    chipSelected: "border-rose-600 bg-rose-50 text-rose-950 font-semibold",
    selectedRow: "border-rose-500 bg-rose-50/60",
  },
];

const knownIndex: Record<string, number> = {
  "r-amazon": 0,
  "r-vitacost": 1,
  "r-iherb": 2,
};

export function retailerAccent(retailerId: string): RetailerAccent {
  const idx =
    knownIndex[retailerId] ??
    Math.abs(retailerId.split("").reduce((h, c) => h + c.charCodeAt(0), 0)) %
      PALETTE.length;
  return PALETTE[idx];
}
