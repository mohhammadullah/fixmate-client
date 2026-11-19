/**
 * FixMate client API-base configuration test (no network, no database).
 *
 * Verifies the production fail-fast rules in src/lib/api.ts:
 *  - missing NEXT_PUBLIC_API_URL fails a production build
 *  - malformed URLs fail
 *  - HTTP URLs are rejected in production
 *  - HTTPS URLs are normalized
 *  - local development keeps the localhost fallback
 *
 * Usage: node scripts/api-config-test.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

let failures = 0;
const pass = (msg) => console.log(`  PASS  ${msg}`);
const fail = (msg) => {
  failures += 1;
  console.log(`  FAIL  ${msg}`);
};
const check = (cond, msg) => (cond ? pass(msg) : fail(msg));

const IMPORT_SNIPPET =
  'import("./src/lib/api.ts").then(m => console.log(m.API_BASE)).catch(e => { console.error(e.message); process.exit(1); })';

function loadApiBase({ nodeEnv, apiUrl }) {
  const env = { ...process.env, NODE_ENV: nodeEnv };
  if (apiUrl === undefined) delete env.NEXT_PUBLIC_API_URL;
  else env.NEXT_PUBLIC_API_URL = apiUrl;

  return spawnSync(process.execPath, ["-e", IMPORT_SNIPPET], {
    cwd: ROOT,
    env,
    encoding: "utf8",
  });
}

console.log("API base configuration test\n");

const missingProd = loadApiBase({ nodeEnv: "production" });
check(
  missingProd.status !== 0 &&
    missingProd.stderr.includes("NEXT_PUBLIC_API_URL is required for production builds"),
  "production without NEXT_PUBLIC_API_URL fails clearly"
);

const invalidProd = loadApiBase({ nodeEnv: "production", apiUrl: "not-a-url" });
check(
  invalidProd.status !== 0 &&
    invalidProd.stderr.includes("must be an absolute http(s) URL"),
  "production with a malformed URL fails clearly"
);

const httpProd = loadApiBase({ nodeEnv: "production", apiUrl: "http://api.example.invalid" });
check(
  httpProd.status !== 0 && httpProd.stderr.includes("must use HTTPS in production builds"),
  "production HTTP URL is rejected"
);

const credentialsProd = loadApiBase({
  nodeEnv: "production",
  apiUrl: "https://user:pass@api.example.invalid",
});
check(
  credentialsProd.status !== 0 && credentialsProd.stderr.includes("must not contain credentials"),
  "URL credentials are rejected"
);

const httpsProd = loadApiBase({ nodeEnv: "production", apiUrl: "https://api.example.invalid/" });
check(
  httpsProd.status === 0 && httpsProd.stdout.trim() === "https://api.example.invalid",
  "production HTTPS URL is accepted and trailing slash removed"
);

const devDefault = loadApiBase({ nodeEnv: "development" });
check(
  devDefault.status === 0 && devDefault.stdout.trim() === "http://localhost:5000",
  "development without the variable keeps the localhost fallback"
);

console.log(`\n${failures === 0 ? "API CONFIG CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
