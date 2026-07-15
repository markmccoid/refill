const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");

function loadTsModule(relativePath) {
  const filename = path.join(__dirname, "..", relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;

  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(output, filename);
  return mod.exports;
}

const {
  buildBasketLines,
  computeRetailerBasket,
  cheapestBasketRetailerIds,
} = loadTsModule("lib/restock-basket-math.ts");
const { lookupCandidatePrice } = loadTsModule("lib/candidate-price-utils.ts");

/**
 * Mirrors server-side basket derivation in convex/restock.ts plan query.
 * Fixtures: two items at different retailers; Amazon basket incomplete (no price).
 */
function derivePlanBaskets(items, retailers) {
  const retailerById = new Map(retailers.map((r) => [r.id, r]));
  const groups = new Map();

  for (const item of items) {
    if (!item.selectedCandidateId) continue;
    const candidate = item.candidates.find(
      (c) => c.id === item.selectedCandidateId
    );
    if (!candidate) continue;
    const lines = groups.get(candidate.retailerId) ?? [];
    lines.push({ item, candidate });
    groups.set(candidate.retailerId, lines);
  }

  const baskets = [];
  const nudgeInputs = [];

  for (const [retailerId, group] of groups) {
    const retailer = retailerById.get(retailerId);
    const lineInputs = group.map(({ item, candidate }) => ({
      qty: item.qty,
      enteredPrice: lookupCandidatePrice(item.candidatePrices, candidate.id),
      candidateCount: candidate.count,
    }));
    const built = buildBasketLines(lineInputs);
    const math = computeRetailerBasket(lineInputs, {
      freeShippingThreshold: retailer.freeShippingThreshold,
      standardShippingCost: retailer.standardShippingCost,
    });

    const basket = {
      retailerId,
      retailerName: retailer.name,
      lines: group.map(({ item, candidate }, i) => ({
        itemId: item.id,
        itemName: item.name,
        candidateId: candidate.id,
        lineTotal: built[i].lineTotal,
      })),
      ...math,
      cheapest: false,
    };
    baskets.push(basket);
    nudgeInputs.push({
      retailerId,
      complete: basket.complete,
      shippingUnknown: basket.shippingUnknown,
      allIn: basket.allIn,
    });
  }

  const cheapestIds = new Set(cheapestBasketRetailerIds(nudgeInputs));
  for (const basket of baskets) {
    basket.cheapest = cheapestIds.has(basket.retailerId);
  }

  return baskets;
}

test("plan projection: two retailer baskets, one incomplete, cheapest on complete", () => {
  const retailers = [
    {
      id: "amazon",
      name: "Amazon",
      freeShippingThreshold: 35,
      standardShippingCost: 5.99,
    },
    {
      id: "iherb",
      name: "iHerb",
      freeShippingThreshold: 30,
      standardShippingCost: 4,
    },
  ];

  const items = [
    {
      id: "item1",
      name: "Vitamin D",
      qty: 2,
      candidatePrices: [{ candidateId: "cand-amazon", price: 12 }],
      selectedCandidateId: "cand-amazon",
      candidates: [
        {
          id: "cand-amazon",
          retailerId: "amazon",
          label: "Nature Made D3",
          count: 100,
        },
        {
          id: "cand-iherb",
          retailerId: "iherb",
          label: "NOW D3",
          count: 120,
        },
      ],
    },
    {
      id: "item2",
      name: "Fish Oil",
      qty: 1,
      candidatePrices: [], // incomplete — no sticker yet
      selectedCandidateId: "cand-amazon2",
      candidates: [
        {
          id: "cand-amazon2",
          retailerId: "amazon",
          label: "Nordic Naturals",
          count: 90,
        },
      ],
    },
    {
      id: "item3",
      name: "Magnesium",
      qty: 1,
      candidatePrices: [{ candidateId: "cand-iherb", price: 18 }],
      selectedCandidateId: "cand-iherb",
      candidates: [
        {
          id: "cand-iherb",
          retailerId: "iherb",
          label: "Doctor's Best",
          count: 120,
        },
      ],
    },
  ];

  const baskets = derivePlanBaskets(items, retailers);

  assert.equal(baskets.length, 2);

  const amazon = baskets.find((b) => b.retailerId === "amazon");
  const iherb = baskets.find((b) => b.retailerId === "iherb");

  assert.ok(amazon);
  assert.ok(iherb);

  // Amazon: priced line 2×12=24 + unpriced line → incomplete
  assert.equal(amazon.subtotal, 24);
  assert.equal(amazon.complete, false);
  assert.equal(amazon.allIn, null);
  assert.equal(amazon.lines.length, 2);
  assert.equal(amazon.cheapest, false);

  // iHerb: single priced line, below threshold → shipping applied
  assert.equal(iherb.subtotal, 18);
  assert.equal(iherb.complete, true);
  assert.equal(iherb.appliedShipping, 4);
  assert.equal(iherb.allIn, 22);
  assert.equal(iherb.gapToFreeShipping, 12);
  assert.equal(iherb.cheapest, false);

  // Only one eligible complete basket → no cheapest nudge (needs ≥2)
  assert.deepEqual(
    cheapestBasketRetailerIds([
      {
        retailerId: "amazon",
        complete: false,
        shippingUnknown: false,
        allIn: null,
      },
      {
        retailerId: "iherb",
        complete: true,
        shippingUnknown: false,
        allIn: 22,
      },
    ]),
    []
  );
});

test("plan projection: subtotal uses shared math for multi-line complete basket", () => {
  const retailers = [
    {
      id: "vitacost",
      name: "Vitacost",
      freeShippingThreshold: 49,
      standardShippingCost: 6.95,
    },
  ];

  const items = [
    {
      id: "a",
      name: "Zinc",
      qty: 2,
      candidatePrices: [{ candidateId: "c1", price: 10 }],
      selectedCandidateId: "c1",
      candidates: [{ id: "c1", retailerId: "vitacost", label: "Zinc A", count: 100 }],
    },
    {
      id: "b",
      name: "C",
      qty: 1,
      candidatePrices: [{ candidateId: "c2", price: 15 }],
      selectedCandidateId: "c2",
      candidates: [{ id: "c2", retailerId: "vitacost", label: "C Complex", count: 90 }],
    },
  ];

  const [basket] = derivePlanBaskets(items, retailers);

  assert.equal(basket.subtotal, 35);
  assert.equal(basket.complete, true);
  assert.equal(basket.appliedShipping, 6.95);
  assert.equal(basket.allIn, 41.95);
  assert.equal(basket.gapToFreeShipping, 14);
});
