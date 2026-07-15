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
  lookupCandidatePrice,
  upsertCandidatePrice,
  clearCandidatePrice,
  remapAndMergeCandidatePrices,
  lowestPricePerPillCandidateIds,
} = loadTsModule("lib/candidate-price-utils.ts");

test("candidate prices remain independent and clear one at a time", () => {
  const prices = upsertCandidatePrice(
    upsertCandidatePrice([], "a", 12),
    "b",
    18
  );
  assert.equal(lookupCandidatePrice(prices, "a"), 12);
  assert.equal(lookupCandidatePrice(prices, "b"), 18);
  assert.deepEqual(clearCandidatePrice(prices, "a"), [
    { candidateId: "b", price: 18 },
  ]);
});

test("lookup resolves only the requested candidate price", () => {
  const prices = [{ candidateId: "a", price: 12 }];
  assert.equal(lookupCandidatePrice(prices, "a"), 12);
  assert.equal(lookupCandidatePrice(prices, "b"), null);
});

test("lowest price per pill returns every priced valid-count tie", () => {
  assert.deepEqual(
    lowestPricePerPillCandidateIds([
      { candidateId: "a", price: 10, count: 100 },
      { candidateId: "b", price: 12, count: 120 },
      { candidateId: "c", price: null, count: 200 },
      { candidateId: "d", price: 1, count: 0 },
      { candidateId: "e", price: 20, count: 100 },
    ]),
    ["a", "b"]
  );
});

test("lowest price per pill requires two comparable options", () => {
  assert.deepEqual(
    lowestPricePerPillCandidateIds([
      { candidateId: "a", price: 10, count: 100 },
      { candidateId: "b", price: null, count: 120 },
    ]),
    []
  );
});

test("remap removes deleted candidates without leaking their prices", () => {
  const result = remapAndMergeCandidatePrices(
    [],
    [{
      candidateId: "keep",
      price: 8,
    }],
    undefined,
    (candidateId) => (candidateId === "keep" ? "keep" : undefined)
  );
  const withDeleted = remapAndMergeCandidatePrices(
    result,
    [{ candidateId: "deleted", price: 9 }],
    undefined,
    (candidateId) => (candidateId === "keep" ? "keep" : undefined)
  );
  assert.deepEqual(withDeleted, [{ candidateId: "keep", price: 8 }]);
});

test("merge keeps the retained target cycle price", () => {
  const target = [{ candidateId: "target", price: 10 }];
  const remap = () => "target";

  assert.deepEqual(
    remapAndMergeCandidatePrices(
      target,
      [{ candidateId: "source", price: 12 }],
      "source",
      remap
    ),
    target
  );
});

test("selected source wins a collision within one discarded cycle", () => {
  assert.deepEqual(
    remapAndMergeCandidatePrices(
      [],
      [
        { candidateId: "other", price: 10 },
        { candidateId: "selected", price: 12 },
      ],
      "selected",
      () => "target"
    ),
    [{ candidateId: "target", price: 12 }]
  );
});
