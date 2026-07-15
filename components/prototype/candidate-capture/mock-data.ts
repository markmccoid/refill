export type MockCandidate = {
  id: string;
  retailer: string;
  label: string;
  url: string;
  count: number | null;
  lastPrice: number | null;
};

export type MockSubject = {
  kind: "solo" | "group";
  name: string;
  onHand: number;
  daysLeft: number;
  members?: string[];
};

export const mockSubject: MockSubject = {
  kind: "group",
  name: "Fish Oil",
  onHand: 42,
  daysLeft: 18,
  members: ["Nordic Naturals", "Carlson"],
};

export const initialCandidates: MockCandidate[] = [
  {
    id: "c1",
    retailer: "Amazon",
    label: "Nordic Naturals Ultimate Omega 128ct",
    url: "https://amazon.com/dp/example-nordic",
    count: 128,
    lastPrice: 34.99,
  },
  {
    id: "c2",
    retailer: "Vitacost",
    label: "Carlson Elite Omega-3 Gems 120ct",
    url: "https://vitacost.com/example-carlson",
    count: 120,
    lastPrice: 28.5,
  },
  {
    id: "c3",
    retailer: "iHerb",
    label: "Sports Research Triple Strength 180ct",
    url: "https://iherb.com/example-sr",
    count: 180,
    lastPrice: null,
  },
];

export function storeLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function perPill(price: number, count: number) {
  const n = price / count;
  return n >= 1 ? `$${n.toFixed(2)}` : `${(n * 100).toFixed(1)}¢`;
}
