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

const { tokenize, scoreGroupMatch, suggestGroup } = loadTsModule(
  "lib/group-suggest.ts"
);

test("tokenize splits on non-alphanumeric and keeps nutrient codes", () => {
  assert.deepEqual(tokenize("Vitamin D3 NOW Foods"), [
    "vitamin",
    "d3",
    "now",
    "foods",
  ]);
  assert.deepEqual(tokenize("D3 Zn"), ["d3"]);
});

test("scoreGroupMatch scores overlapping supplement names", () => {
  const group = {
    _id: "g1",
    name: "Vitamin D3",
    members: [
      { name: "Thorne D3 5000 IU", brand: "Thorne" },
      { name: "NOW Foods D3", brand: "NOW Foods" },
    ],
  };
  assert.ok(scoreGroupMatch("Vitamin D3 NOW Foods", group) >= 3);
  assert.equal(scoreGroupMatch("Creatine Monohydrate", group), 0);
});

test("suggestGroup returns best match or null", () => {
  const groups = [
    {
      _id: "g1",
      name: "Vitamin D3",
      members: [{ name: "Thorne D3", brand: "Thorne" }],
    },
    {
      _id: "g2",
      name: "Fish Oil",
      members: [{ name: "Nordic Naturals", brand: "Nordic" }],
    },
  ];
  assert.equal(suggestGroup("NOW Foods Vitamin D3", groups)?._id, "g1");
  assert.equal(suggestGroup("Ashwagandha", groups), null);
});
