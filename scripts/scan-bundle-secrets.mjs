// scripts/scan-bundle-secrets.mjs
//
// Key-absence scan for the production client bundle (NFR-04, AC-06).
//
// After `vite build` the client bundle lives in dist/. The API key
// (COC_API_TOKEN) must never appear there: the browser talks to our own
// same-origin /api/* routes, and the key lives only in the serverless tier's
// environment (docs/concept/04-api-strategy section 7). This script greps
// every file under dist/ for two things:
//
//   1. the env var name "COC_API_TOKEN". This is the primary check and works
//      with no secret configured. Any client code that references the key
//      via import.meta.env.COC_API_TOKEN would let Vite inline the value into
//      the bundle at build time, and the name itself would appear in the
//      generated code. Catching the name catches the leak before the value
//      is even shipped.
//
//   2. the actual token value, when COC_API_TOKEN is present in the
//      environment (for example, set as a GitHub Actions secret). This is
//      the belt-and-suspenders check; it confirms no value leak even if the
//      name somehow avoided detection. The value is read from env, never
//      printed to stdout.
//
// Exit codes:
//   0  bundle is clean (no matches)
//   1  leak detected, or dist/ is missing/unreadable
//
// Run locally with:  npm run build && npm run scan:secrets

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const TOKEN_ENV_NAME = 'COC_API_TOKEN';
const distDir = resolve(process.cwd(), 'dist');

function fail(message) {
  console.error(`[scan:secrets] FAIL: ${message}`);
  process.exit(1);
}

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
  fail(`dist/ not found at ${distDir}. Run "npm run build" before the scan.`);
}

const nameNeedle = Buffer.from(TOKEN_ENV_NAME, 'utf8');
const tokenValue = process.env[TOKEN_ENV_NAME] ?? '';
const valueNeedle = tokenValue.length > 0 ? Buffer.from(tokenValue, 'utf8') : null;

const files = listFiles(distDir);
const nameHits = [];
const valueHits = [];

for (const file of files) {
  let buf;
  try {
    buf = readFileSync(file);
  } catch (err) {
    fail(`could not read ${relative(distDir, file)}: ${err.message}`);
  }
  if (buf.length === 0) continue;
  if (buf.includes(nameNeedle)) {
    nameHits.push(relative(distDir, file));
  }
  if (valueNeedle && buf.includes(valueNeedle)) {
    valueHits.push(relative(distDir, file));
  }
}

if (nameHits.length > 0) {
  console.error(`[scan:secrets] FAIL: the env var name "${TOKEN_ENV_NAME}" was found in the client bundle.`);
  console.error('  This means client code references the API key via import.meta.env,');
  console.error('  which Vite inlines into the bundle at build time. The key boundary is broken.');
  console.error('  Files with hits:');
  for (const f of nameHits) console.error(`    - ${f}`);
}

if (valueHits.length > 0) {
  console.error('[scan:secrets] FAIL: the COC_API_TOKEN value was found in the client bundle.');
  console.error('  The API key string itself is in the production bundle.');
  console.error('  Files with hits:');
  for (const f of valueHits) console.error(`    - ${f}`);
}

if (nameHits.length > 0 || valueHits.length > 0) {
  console.error('[scan:secrets] the key boundary is broken; refusing to pass the gate.');
  process.exit(1);
}

const valueStatus = valueNeedle
  ? 'the COC_API_TOKEN value (read from env)'
  : 'the COC_API_TOKEN value (skipped: COC_API_TOKEN not set in this environment; configure it as a CI secret to enable the value check)';

console.log(`[scan:secrets] OK: scanned ${files.length} file(s) under dist/.`);
console.log(`[scan:secrets] OK: zero occurrences of the env var name "${TOKEN_ENV_NAME}".`);
console.log(`[scan:secrets] OK: zero occurrences of ${valueStatus}.`);
console.log('[scan:secrets] OK: bundle is clean. NFR-04 / AC-06 verified.');
