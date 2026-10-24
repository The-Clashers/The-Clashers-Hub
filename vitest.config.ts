import { defineConfig } from 'vitest/config';

// Unit tests cover the pure parts of both halves: the tier under server/
// (cache, upstream client, tag handling, error mapping) and the browser-side
// clients under src/api/ (query building, payload parsing, error mapping).
// Neither imports React or RN Web, so the config stays independent of the
// app's vite.config.ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
