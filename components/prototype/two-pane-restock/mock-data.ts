export type MockRetailer = {
  id: string;
  name: string;
  freeShippingThreshold?: number;
  standardShippingCost?: number;
};

export type MockCandidate = {
  id: string;
  retailerId: string;
  label: string;
  url: string;
  count: number | null;
};

export type MockPlanItem = {
  id: string;
  subjectName: string;
  subjectKind: "solo" | "group";
  onHand: number;
  daysLeft: number;
  qty: number;
  recommendedQty: number;
  candidates: MockCandidate[];
  selectedCandidateId: string | null;
  /** Cycle-scoped prices keyed by candidate id (accumulate as user explores). */
  priceByCandidateId: Record<string, number>;
};

export const mockRetailers: MockRetailer[] = [
  { id: "r-amazon", name: "Amazon", freeShippingThreshold: 35, standardShippingCost: 5.99 },
  { id: "r-vitacost", name: "Vitacost", freeShippingThreshold: 49, standardShippingCost: 4.95 },
  { id: "r-iherb", name: "iHerb" },
];

export const initialPlanItems: MockPlanItem[] = [
  {
    id: "item-fish",
    subjectName: "Fish Oil",
    subjectKind: "group",
    onHand: 42,
    daysLeft: 18,
    qty: 2,
    recommendedQty: 2,
    selectedCandidateId: "c-fish-amazon",
    priceByCandidateId: { "c-fish-amazon": 34.99, "c-fish-vitacost": 28.5 },
    candidates: [
      {
        id: "c-fish-amazon",
        retailerId: "r-amazon",
        label: "Nordic Naturals Ultimate Omega 128ct",
        url: "https://amazon.com/dp/example-nordic",
        count: 128,
      },
      {
        id: "c-fish-vitacost",
        retailerId: "r-vitacost",
        label: "Carlson Elite Omega-3 Gems 120ct",
        url: "https://vitacost.com/example-carlson",
        count: 120,
      },
      {
        id: "c-fish-iherb",
        retailerId: "r-iherb",
        label: "Sports Research Triple Strength 180ct",
        url: "https://iherb.com/example-sr",
        count: 180,
      },
    ],
  },
  {
    id: "item-vitd",
    subjectName: "Vitamin D3",
    subjectKind: "solo",
    onHand: 88,
    daysLeft: 45,
    qty: 1,
    recommendedQty: 1,
    selectedCandidateId: "c-vitd-amazon",
    priceByCandidateId: { "c-vitd-amazon": 12.49, "c-vitd-vitacost": 11.99 },
    candidates: [
      {
        id: "c-vitd-amazon",
        retailerId: "r-amazon",
        label: "NOW Foods D3 5000 IU 120ct",
        url: "https://amazon.com/dp/example-d3",
        count: 120,
      },
      {
        id: "c-vitd-vitacost",
        retailerId: "r-vitacost",
        label: "Life Extension D3 5000 IU 60ct",
        url: "https://vitacost.com/example-d3",
        count: 60,
      },
    ],
  },
  {
    id: "item-mag",
    subjectName: "Magnesium Glycinate",
    subjectKind: "solo",
    onHand: 15,
    daysLeft: 8,
    qty: 1,
    recommendedQty: 2,
    selectedCandidateId: "c-mag-vitacost",
    priceByCandidateId: {},
    candidates: [
      {
        id: "c-mag-vitacost",
        retailerId: "r-vitacost",
        label: "Doctor's Best 240ct",
        url: "https://vitacost.com/example-mag",
        count: 240,
      },
      {
        id: "c-mag-amazon",
        retailerId: "r-amazon",
        label: "Pure Encapsulations 180ct",
        url: "https://amazon.com/dp/example-mag",
        count: 180,
      },
    ],
  },
];

export const money = (n: number) => `$${n.toFixed(2)}`;

export function perPill(price: number, count: number) {
  const n = price / count;
  return n >= 1 ? `$${n.toFixed(2)}` : `${(n * 100).toFixed(1)}¢`;
}

export function itemPrice(item: MockPlanItem, candidateId: string): number | null {
  return item.priceByCandidateId[candidateId] ?? null;
}

export function selectedCandidate(item: MockPlanItem) {
  if (!item.selectedCandidateId) return null;
  return item.candidates.find((c) => c.id === item.selectedCandidateId) ?? null;
}

export function retailerName(id: string, retailers = mockRetailers) {
  return retailers.find((r) => r.id === id)?.name ?? id;
}
