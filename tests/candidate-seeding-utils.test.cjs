const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");

const moduleCache = new Map();

function loadTsModule(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/");
  if (moduleCache.has(normalized)) {
    return moduleCache.get(normalized);
  }

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
  const originalRequire = mod.require.bind(mod);
  mod.require = (id) => {
    if (id.startsWith(".")) {
      const resolved = path.resolve(path.dirname(filename), id);
      const tsPath = resolved.endsWith(".ts") ? resolved : `${resolved}.ts`;
      if (fs.existsSync(tsPath)) {
        const rel = path
          .relative(path.join(__dirname, ".."), tsPath)
          .replace(/\\/g, "/");
        return loadTsModule(rel);
      }
    }
    return originalRequire(id);
  };

  mod._compile(output, filename);
  moduleCache.set(normalized, mod.exports);
  return mod.exports;
}

const {
  collectSeedSourcesForSupplement,
  collectSeedSourcesForGroup,
  filterNovelSeedSources,
  countNovelSeedSources,
  pickBottleCount,
} = loadTsModule("lib/candidate-seeding-utils.ts");

const suppA = { id: "supp_a", name: "Fish Oil", jarSize: 120 };
const suppB = { id: "supp_b", name: "Krill Oil", jarSize: 60 };

test("collectSeedSourcesForSupplement uses saved link URL", () => {
  const sources = collectSeedSourcesForSupplement(
    suppA,
    [
      {
        supplementId: "supp_a",
        retailerId: "ret_1",
        url: "https://shop.example/fish",
      },
    ],
    []
  );

  assert.equal(sources.length, 1);
  assert.equal(sources[0].url, "https://shop.example/fish");
  assert.equal(sources[0].label, "Fish Oil");
  assert.equal(sources[0].count, 120);
});

test("collectSeedSourcesForSupplement falls back to most recent bottle URL", () => {
  const sources = collectSeedSourcesForSupplement(
    suppA,
    [],
    [
      {
        supplementId: "supp_a",
        retailerId: "ret_1",
        purchaseUrl: "https://shop.example/old",
        count: 90,
        purchasedAt: 1000,
      },
      {
        supplementId: "supp_a",
        retailerId: "ret_1",
        purchaseUrl: "https://shop.example/new",
        count: 100,
        purchasedAt: 2000,
      },
    ]
  );

  assert.equal(sources.length, 1);
  assert.equal(sources[0].url, "https://shop.example/new");
  assert.equal(sources[0].count, 100);
});

test("collectSeedSourcesForSupplement prefers saved link over bottle fallback", () => {
  const sources = collectSeedSourcesForSupplement(
    suppA,
    [
      {
        supplementId: "supp_a",
        retailerId: "ret_1",
        url: "https://shop.example/saved",
      },
    ],
    [
      {
        supplementId: "supp_a",
        retailerId: "ret_1",
        purchaseUrl: "https://shop.example/bottle",
        count: 100,
        purchasedAt: 2000,
      },
    ]
  );

  assert.equal(sources[0].url, "https://shop.example/saved");
});

test("collectSeedSourcesForGroup aggregates members and dedupes URLs", () => {
  const sources = collectSeedSourcesForGroup(
    [suppA, suppB],
    [
      {
        supplementId: "supp_a",
        retailerId: "ret_1",
        url: "https://shop.example/shared",
      },
      {
        supplementId: "supp_b",
        retailerId: "ret_2",
        url: "  https://shop.example/shared  ",
      },
      {
        supplementId: "supp_b",
        retailerId: "ret_3",
        url: "https://shop.example/krill",
      },
    ],
    []
  );

  assert.equal(sources.length, 2);
  assert.equal(sources[0].label, "Fish Oil");
  assert.equal(sources[0].url, "https://shop.example/shared");
  assert.equal(sources[1].url, "https://shop.example/krill");
});

test("filterNovelSeedSources skips existing and in-batch duplicate URLs", () => {
  const sources = [
    {
      supplementId: "supp_a",
      retailerId: "ret_1",
      url: "https://shop.example/a",
      label: "A",
    },
    {
      supplementId: "supp_a",
      retailerId: "ret_2",
      url: "https://shop.example/b",
      label: "B",
    },
    {
      supplementId: "supp_b",
      retailerId: "ret_3",
      url: "  https://shop.example/b  ",
      label: "B dup",
    },
  ];

  const novel = filterNovelSeedSources(sources, ["https://shop.example/a"]);
  assert.equal(novel.length, 1);
  assert.equal(novel[0].url, "https://shop.example/b");
});

test("countNovelSeedSources returns preview import count", () => {
  const sources = collectSeedSourcesForSupplement(suppA, [
    {
      supplementId: "supp_a",
      retailerId: "ret_1",
      url: "https://shop.example/one",
    },
    {
      supplementId: "supp_a",
      retailerId: "ret_2",
      url: "https://shop.example/two",
    },
  ], []);

  assert.equal(
    countNovelSeedSources(sources, ["https://shop.example/one"]),
    1
  );
  assert.equal(countNovelSeedSources(sources, []), 2);
});

test("pickBottleCount uses any recent bottle when retailer-specific bottle missing", () => {
  const count = pickBottleCount(
    suppA,
    [
      {
        supplementId: "supp_a",
        retailerId: "ret_other",
        count: 80,
        purchasedAt: 3000,
      },
    ],
    "ret_1"
  );
  assert.equal(count, 80);
});

test("pickBottleCount falls back to jar size", () => {
  const count = pickBottleCount(suppA, [], "ret_1");
  assert.equal(count, 120);
});
