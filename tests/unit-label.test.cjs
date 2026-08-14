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

const { usesPillUnit, unitLabel, unitWord, remainingNowLabel } =
  loadTsModule("lib/unit-label.ts");

test("blank and missing form default to pill", () => {
  assert.equal(usesPillUnit(undefined), true);
  assert.equal(usesPillUnit(null), true);
  assert.equal(usesPillUnit(""), true);
  assert.equal(usesPillUnit("   "), true);
  assert.deepEqual(unitLabel(""), { singular: "pill", plural: "pills" });
});

test("discrete forms are pills, including DSLD-style phrases", () => {
  for (const form of [
    "Tablet",
    "capsule",
    "Softgel",
    "soft gel",
    "Capsule, gelatin coated",
    "Tablet, chewable",
    "Gummy",
    "Caplet",
    "Lozenge",
    "pill",
  ]) {
    assert.equal(usesPillUnit(form), true, form);
  }
});

test("powder, liquid, and other forms are servings", () => {
  for (const form of ["Powder", "Liquid", "Oil", "Packet", "Granules", "Tea"]) {
    assert.equal(usesPillUnit(form), false, form);
    assert.deepEqual(unitLabel(form), {
      singular: "serving",
      plural: "servings",
    });
  }
});

test("unitWord uses singular only for exactly one", () => {
  assert.equal(unitWord(1), "pill");
  assert.equal(unitWord(1, "Powder"), "serving");
  assert.equal(unitWord(0, "Powder"), "servings");
  assert.equal(unitWord(2, "Tablet"), "pills");
});

test("remainingNowLabel capitalizes the plural", () => {
  assert.equal(remainingNowLabel(), "Pills remaining now");
  assert.equal(remainingNowLabel("Liquid"), "Servings remaining now");
});
