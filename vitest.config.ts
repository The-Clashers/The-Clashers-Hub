import { defineConfig } from 'vitest/config';

// Unit tests cover the tier's pure parts under server/ (cache, upstream
// client, tag handling, error mapping); no React or RN Web imports here, so
// the config stays independent of the app's vite.config.ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts'],
  },
});
