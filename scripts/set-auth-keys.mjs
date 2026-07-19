/**
 * Generate Convex Auth JWT keys and set them on the linked deployment.
 * Avoids PowerShell quote-stripping that corrupts JWKS / JWT_PRIVATE_KEY.
 *
 * Usage (from repo root):
 *   node scripts/set-auth-keys.mjs
 */
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = (await exportPKCS8(keys.privateKey))
  .trimEnd()
  .replace(/\n/g, " ");
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

function setEnv(name, value) {
  const file = join(tmpdir(), `convex-env-${name}-${Date.now()}.txt`);
  writeFileSync(file, value, "utf8");
  // stdin form: npx convex env set NAME < value
  const result = spawnSync(
    "npx",
    ["convex", "env", "set", name],
    {
      input: value,
      encoding: "utf8",
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  unlinkSync(file);
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`Failed to set ${name}`);
  }
  console.log(`Set ${name} OK`);
  console.log(result.stdout.trim());
}

setEnv("JWT_PRIVATE_KEY", privateKey);
setEnv("JWKS", jwks);
console.log("Done. Sign in again with a migrated account.");
