// Platform simulator: mounts the api default exports the way the deployed
// Vercel Node launcher invokes them, as plain (req, res) calls, on a plain
// Node http server. Running scripts/verify-tier.sh against this proves the
// exact platform call contract works before we push. Started ad hoc, not
// part of the normal dev flow.
//
// Usage: node scripts/platform-sim.mjs   (listens on 8789)

import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

// Same .env loading as dev-api.mjs so the simulator sees the real tier env.
const envUrl = new URL('../.env', import.meta.url);
if (existsSync(envUrl)) {
  for (const line of readFileSync(envUrl, 'utf8').split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^['"]|['"]$/g, '');
    if (!(match[1] in process.env)) process.env[match[1]] = value;
  }
}

const outfile = 'node_modules/.cache/platform-sim.mjs';
mkdirSync('node_modules/.cache', { recursive: true });

await build({
  entryPoints: ['scripts/platform-sim-inner.ts'],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'warning',
});

const child = spawn(process.execPath, [outfile], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
