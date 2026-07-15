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
  MAX_BOTTLES_PER_PURCHASE,
  validatePurchaseActuals,
} = loadTsModule("lib/purchase-actuals-utils.ts");

const validLine = {
  itemId: "item_1",
  qty: 2,
  pricePerBottle: 12.5,
  countPerBottle: 60,
};

test("validatePurchaseActuals accepts valid actuals", () => {
  assert.doesNotThrow(() => validatePurchaseActuals(Date.now(), [validLine]));
});

test("validatePurchaseActuals rejects invalid numeric actuals", () => {
  for (const qty of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(
      () => validatePurchaseActuals(Date.now(), [{ ...validLine, qty }]),
      /Quantity must be a finite positive integer/
    );
  }
  for (const countPerBottle of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(
      () =>
        validatePurchaseActuals(Date.now(), [
          { ...validLine, countPerBottle },
        ]),
      /Count per bottle must be a finite positive integer/
    );
  }
  for (const pricePerBottle of [-1, NaN, Infinity]) {
    assert.throws(
      () =>
        validatePurchaseActuals(Date.now(), [
          { ...validLine, pricePerBottle },
        ]),
      /Price per bottle must be finite and nonnegative/
    );
  }
  assert.throws(
    () => validatePurchaseActuals(NaN, [validLine]),
    /Invalid purchase date/
  );
});

test("validatePurchaseActuals rejects duplicate item ids", () => {
  assert.throws(
    () =>
      validatePurchaseActuals(Date.now(), [
        validLine,
        { ...validLine, qty: 1 },
      ]),
    /Each restock item may appear only once per purchase/
  );
});

test("validatePurchaseActuals enforces the total bottle cap", () => {
  assert.doesNotThrow(() =>
    validatePurchaseActuals(Date.now(), [
      { ...validLine, qty: MAX_BOTTLES_PER_PURCHASE },
    ])
  );
  assert.throws(
    () =>
      validatePurchaseActuals(Date.now(), [
        { ...validLine, qty: MAX_BOTTLES_PER_PURCHASE },
        { ...validLine, itemId: "item_2", qty: 1 },
      ]),
    new RegExp(`at most ${MAX_BOTTLES_PER_PURCHASE} bottles`)
  );
});
