// Flat ESLint config (ESLint v9). The concept doc's definition of done is
// "ESLint clean"; this config is the M0 baseline. It runs JS recommended
// plus typescript-eslint recommended across the client, the serverless
// tier, and the dev scripts, so a single `npm run lint` gates every line of
// code that ships or runs in CI. React-specific rules are deliberately out
// of scope for M0; a later card can add eslint-plugin-react once the
// RN-for-Web interaction is pinned down.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src/assets/**',
      'coverage/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mjs,js,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // The build already enforces strict TS (noUnusedLocals,
      // noUnusedParameters); we keep the lint layer focused on patterns the
      // compiler cannot catch.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Allow _-prefixed unused vars (intentional skips in tests/scripts).
    },
  },
  {
    // Server-side code runs on Node (process.env, fs, etc.); the dev scripts
    // are .mjs Node scripts too.
    files: ['server/**/*.{ts,tsx}', 'api/**/*.{ts,tsx}', 'scripts/**/*.{ts,mjs,js}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        queueMicrotask: 'readonly',
      },
    },
  },
);
