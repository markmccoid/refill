const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");

function loadSupplementUtils() {
  const filename = path.join(__dirname, "..", "lib", "supplement-utils.ts");
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
  getBottleStates,
  getBottleStatesForDosages,
  getConsumptionRate,
  getGroupState,
} = loadSupplementUtils();

const day = 86_400_000;
const jan1 = Date.UTC(2026, 0, 1, 12);

function bottle(count, availableOffsetDays, remaining = count) {
  return {
    count,
    price: count,
    purchasedAt: jan1 + availableOffsetDays * day,
    remainingAtAnchor: remaining,
  };
}

test("future bottles are incoming and do not deplete before available date", () => {
  const ledger = getBottleStates([bottle(30, 3)], jan1, 2, jan1 + 2 * day);

  assert.equal(ledger.onHand, 0);
  assert.equal(ledger.incomingCount, 30);
  assert.equal(ledger.bottleCount, 0);
  assert.equal(ledger.openCostPerPill, 0);
});

test("future bottles do not accrue pill debt while unavailable", () => {
  const ledger = getBottleStates([bottle(30, 3)], jan1, 2, jan1 + 5 * day);

  assert.equal(ledger.onHand, 26);
  assert.equal(ledger.incomingCount, 0);
  assert.equal(ledger.openRemaining, 26);
});

test("available bottles drain before future bottles join the queue", () => {
  const ledger = getBottleStates(
    [bottle(10, 0), bottle(30, 5)],
    jan1,
    2,
    jan1 + 6 * day
  );

  assert.equal(ledger.onHand, 28);
  assert.equal(ledger.states[0].remaining, 0);
  assert.equal(ledger.states[1].remaining, 28);
});

test("group state treats member future bottles as incoming", () => {
  const ledger = getGroupState(
    [
      { supplementId: "a", bottles: [bottle(10, 0)] },
      { supplementId: "b", bottles: [bottle(30, 3)] },
    ],
    jan1,
    2,
    jan1 + day
  );

  assert.equal(ledger.onHand, 8);
  assert.equal(ledger.incomingCount, 30);
  assert.equal(ledger.openSupplementId, "a");
});

test("active pauses contribute zero current consumption", () => {
  const rate = getConsumptionRate(
    [{ pillsPerWeek: 7, pausedAt: jan1 }],
    jan1 + day
  );

  assert.equal(rate, 0);
});

test("expired pauses resume current consumption", () => {
  const rate = getConsumptionRate(
    [{ pillsPerWeek: 7, pausedAt: jan1, pauseUntil: jan1 + day }],
    jan1 + 2 * day
  );

  assert.equal(rate, 1);
});

test("pause-aware bottle ledger skips paused intervals", () => {
  const ledger = getBottleStatesForDosages(
    [bottle(30, 0)],
    jan1,
    [{ pillsPerWeek: 7, pausedAt: jan1 + day, pauseUntil: jan1 + 4 * day }],
    jan1 + 6 * day
  );

  assert.equal(ledger.onHand, 27);
});
