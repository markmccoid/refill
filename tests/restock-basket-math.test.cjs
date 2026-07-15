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

const { retailerAccent } = loadTsModule("lib/retailer-accent.ts");

// --- buildBasketLines ---

test("subtotal-priced lines only: unpriced line has null lineTotal", () => {
  const lines = buildBasketLines([
    { qty: 2, enteredPrice: 10, candidateCount: 100 },
    { qty: 1, enteredPrice: null, candidateCount: 60 },
  ]);

  assert.equal(lines[0].lineTotal, 20);
  assert.equal(lines[0].perPill, 0.1);
  assert.equal(lines[1].lineTotal, null);
  assert.equal(lines[1].unitPrice, null);
  assert.equal(lines[1].perPill, null);
});

test("$/pill is sticker-only and never allocates shipping", () => {
  const [line] = buildBasketLines([
    { qty: 3, enteredPrice: 30, candidateCount: 100 },
  ]);
  // 30/100 = 0.3 — shipping elsewhere must not change this
  assert.equal(line.perPill, 0.3);
  assert.equal(line.lineTotal, 90);
});

test("$/pill is null when count missing even if price present", () => {
  const [line] = buildBasketLines([
    { qty: 1, enteredPrice: 12, candidateCount: null },
  ]);
  assert.equal(line.lineTotal, 12);
  assert.equal(line.perPill, null);
});

// --- computeRetailerBasket ---

test("subtotal sums priced lines only; incomplete when any line unpriced", () => {
  const basket = computeRetailerBasket(
    [
      { qty: 2, enteredPrice: 10, candidateCount: 100 },
      { qty: 1, enteredPrice: null, candidateCount: 50 },
    ],
    { freeShippingThreshold: 35, standardShippingCost: 5.99 }
  );

  assert.equal(basket.subtotal, 20);
  assert.equal(basket.complete, false);
  assert.equal(basket.allIn, null);
});

test("applies standard shipping when below threshold", () => {
  const basket = computeRetailerBasket(
    [{ qty: 1, enteredPrice: 20, candidateCount: 100 }],
    { freeShippingThreshold: 35, standardShippingCost: 5.99 }
  );

  assert.equal(basket.subtotal, 20);
  assert.equal(basket.complete, true);
  assert.equal(basket.appliedShipping, 5.99);
  assert.equal(basket.allIn, 25.99);
  assert.equal(basket.shippingUnknown, false);
  assert.equal(basket.freeShippingMet, false);
  assert.equal(basket.gapToFreeShipping, 15);
  assert.equal(basket.thresholdUnset, false);
});

test("applied shipping is $0 when free-shipping threshold met", () => {
  const basket = computeRetailerBasket(
    [{ qty: 2, enteredPrice: 20, candidateCount: 100 }],
    { freeShippingThreshold: 35, standardShippingCost: 5.99 }
  );

  assert.equal(basket.subtotal, 40);
  assert.equal(basket.appliedShipping, 0);
  assert.equal(basket.allIn, 40);
  assert.equal(basket.freeShippingMet, true);
  assert.equal(basket.gapToFreeShipping, null);
  assert.equal(basket.shippingUnknown, false);
});

test("applies shipping when threshold unset but standard cost is set", () => {
  const basket = computeRetailerBasket(
    [{ qty: 1, enteredPrice: 15, candidateCount: 60 }],
    { standardShippingCost: 4.95 }
  );

  assert.equal(basket.thresholdUnset, true);
  assert.equal(basket.appliedShipping, 4.95);
  assert.equal(basket.allIn, 19.95);
  assert.equal(basket.shippingUnknown, false);
  assert.equal(basket.gapToFreeShipping, null);
});

test("shipping unknown when below threshold and no standard cost", () => {
  const basket = computeRetailerBasket(
    [{ qty: 1, enteredPrice: 20, candidateCount: 100 }],
    { freeShippingThreshold: 49 }
  );

  assert.equal(basket.shippingUnknown, true);
  assert.equal(basket.appliedShipping, null);
  assert.equal(basket.allIn, null);
  assert.equal(basket.gapToFreeShipping, 29);
});

test("shipping unknown when threshold unset and no standard cost", () => {
  const basket = computeRetailerBasket(
    [{ qty: 1, enteredPrice: 20, candidateCount: 100 }],
    {}
  );

  assert.equal(basket.thresholdUnset, true);
  assert.equal(basket.shippingUnknown, true);
  assert.equal(basket.appliedShipping, null);
  assert.equal(basket.allIn, null);
});

test("gap to free shipping uses subtotal only (shipping excluded)", () => {
  const basket = computeRetailerBasket(
    [{ qty: 1, enteredPrice: 30, candidateCount: 100 }],
    { freeShippingThreshold: 35, standardShippingCost: 5.99 }
  );

  // Gap is 5 on subtotal 30 — not 5.99 or all-in
  assert.equal(basket.gapToFreeShipping, 5);
  assert.equal(basket.appliedShipping, 5.99);
  assert.equal(basket.allIn, 35.99);
});

// --- cheapestBasketRetailerIds ---

test("cheapest-basket nudge excludes incomplete and shipping-unknown; ties return all", () => {
  const winners = cheapestBasketRetailerIds([
    {
      retailerId: "amazon",
      complete: true,
      shippingUnknown: false,
      allIn: 40,
    },
    {
      retailerId: "vitacost",
      complete: true,
      shippingUnknown: false,
      allIn: 40,
    },
    {
      retailerId: "iherb",
      complete: true,
      shippingUnknown: true,
      allIn: null,
    },
    {
      retailerId: "walmart",
      complete: false,
      shippingUnknown: false,
      allIn: null,
    },
    {
      retailerId: "cvs",
      complete: true,
      shippingUnknown: false,
      allIn: 55,
    },
  ]);

  assert.deepEqual(winners.sort(), ["amazon", "vitacost"]);
});

test("cheapest-basket returns empty when fewer than 2 eligible", () => {
  assert.deepEqual(
    cheapestBasketRetailerIds([
      {
        retailerId: "amazon",
        complete: true,
        shippingUnknown: false,
        allIn: 40,
      },
      {
        retailerId: "iherb",
        complete: true,
        shippingUnknown: true,
        allIn: null,
      },
    ]),
    []
  );
});

// --- retailerAccent ---

test("retailerAccent is stable for the same id", () => {
  const a = retailerAccent("retailer_abc123");
  const b = retailerAccent("retailer_abc123");
  assert.deepEqual(a, b);
  assert.ok(a.basketBorder.startsWith("border-l-"));
});

test("retailerAccent can differ across ids (palette coverage)", () => {
  const accents = new Set(
    ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8"].map(
      (id) => retailerAccent(id).basketBorder
    )
  );
  assert.ok(accents.size >= 2);
});
