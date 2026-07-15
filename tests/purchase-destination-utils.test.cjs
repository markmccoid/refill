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

const { assertExistingDestinationAllowed } = loadTsModule(
  "lib/purchase-destination-utils.ts"
);

test("assertExistingDestinationAllowed accepts solo subject supplement", () => {
  assertExistingDestinationAllowed({
    itemSubject: { kind: "supplement", supplementId: "supp_a" },
    destinationSupplementId: "supp_a",
    groupMemberIds: [],
  });
});

test("assertExistingDestinationAllowed rejects wrong solo destination", () => {
  assert.throws(
    () =>
      assertExistingDestinationAllowed({
        itemSubject: { kind: "supplement", supplementId: "supp_a" },
        destinationSupplementId: "supp_b",
        groupMemberIds: [],
      }),
    /not valid for this item's subject/
  );
});

test("assertExistingDestinationAllowed accepts group member destination", () => {
  assertExistingDestinationAllowed({
    itemSubject: { kind: "group", groupId: "grp_1" },
    destinationSupplementId: "supp_b",
    groupMemberIds: ["supp_a", "supp_b"],
  });
});

test("assertExistingDestinationAllowed rejects non-member on group subject", () => {
  assert.throws(
    () =>
      assertExistingDestinationAllowed({
        itemSubject: { kind: "group", groupId: "grp_1" },
        destinationSupplementId: "supp_x",
        groupMemberIds: ["supp_a", "supp_b"],
      }),
    /not valid for this item's subject/
  );
});
