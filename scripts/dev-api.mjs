// Runs the local api dev server: loads the repo .env (never committed),
// bundles scripts/dev-server.ts with esbuild (a devDependency, same one Vite
// uses), and starts it. Usage, from the repo root: npm run dev:api

import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

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

const outfile = 'node_modules/.cache/api-dev.mjs';
mkdirSync('node_modules/.cache', { recursive: true });

await build({
  entryPoints: ['scripts/dev-server.ts'],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'warning',
});

const child = spawn(process.execPath, [outfile], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
