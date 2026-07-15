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
  validateSubjectXor,
  normalizeCandidateUrl,
  hasDuplicateUrl,
} = loadTsModule("lib/candidate-product-utils.ts");

// --- validateSubjectXor ---

test("validateSubjectXor accepts supplementId only", () => {
  assert.equal(
    validateSubjectXor({ supplementId: "supp_1", groupId: undefined }),
    "supplement"
  );
});

test("validateSubjectXor accepts groupId only", () => {
  assert.equal(
    validateSubjectXor({ supplementId: undefined, groupId: "grp_1" }),
    "group"
  );
});

test("validateSubjectXor rejects both ids", () => {
  assert.throws(
    () =>
      validateSubjectXor({ supplementId: "supp_1", groupId: "grp_1" }),
    /Exactly one of supplementId or groupId is required/
  );
});

test("validateSubjectXor rejects neither id", () => {
  assert.throws(
    () => validateSubjectXor({}),
    /Exactly one of supplementId or groupId is required/
  );
});

test("validateSubjectXor rejects null pair (neither set)", () => {
  assert.throws(
    () => validateSubjectXor({ supplementId: null, groupId: null }),
    /Exactly one of supplementId or groupId is required/
  );
});

// --- normalizeCandidateUrl ---

test("normalizeCandidateUrl trims whitespace", () => {
  assert.equal(
    normalizeCandidateUrl("  https://shop.example/item  "),
    "https://shop.example/item"
  );
});

// --- hasDuplicateUrl ---

test("hasDuplicateUrl matches literal trimmed URL on subject", () => {
  const candidates = [
    { _id: "c1", url: "https://a.com/x" },
    { _id: "c2", url: "  https://b.com/y  " },
  ];

  assert.equal(hasDuplicateUrl(candidates, "https://a.com/x"), true);
  assert.equal(hasDuplicateUrl(candidates, "  https://b.com/y"), true);
  assert.equal(hasDuplicateUrl(candidates, "https://c.com/z"), false);
});

test("hasDuplicateUrl excludes self when updating", () => {
  const candidates = [{ _id: "c1", url: "https://a.com/x" }];

  assert.equal(hasDuplicateUrl(candidates, "https://a.com/x", "c1"), false);
  assert.equal(hasDuplicateUrl(candidates, "https://a.com/x", "c2"), true);
});

test("hasDuplicateUrl ignores empty trimmed URL", () => {
  const candidates = [{ _id: "c1", url: "https://a.com/x" }];
  assert.equal(hasDuplicateUrl(candidates, "   "), false);
});
