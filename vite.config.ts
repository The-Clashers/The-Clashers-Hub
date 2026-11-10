import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// The app is written in the React Native component model and rendered to the
// browser through react-native-web, so 'react-native' resolves to
// react-native-web here and .web.* files win over their platform-neutral
// twins, mirroring how a native bundler would pick them.
//
// The second alias is the asset-registry shim (src/shims/assets-registry.ts
// owns the why): react-native-svg's web build imports the Metro asset
// registry that React Native 0.88 no longer ships, and this app never
// passes it a numeric asset source, so the shim keeps the graph resolving.
export default defineConfig({
  plugins: [react()],
  server: {
    // Local dev proxies /api to the tier's dev server (npm run dev:api),
    // same-origin exactly like the deploy.
    proxy: {
      '/api': 'http://localhost:8788',
    },
  },
  preview: {
    proxy: {
      '/api': 'http://localhost:8788',
    },
  },
  optimizeDeps: {
    exclude: ['react-native-svg'],
  },
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: 'react-native-web' },
      { find: /^react-native-svg$/, replacement: 'react-native-svg/lib/module/ReactNativeSVG.web.js' },
      {
        find: '@react-native/assets-registry/registry',
        replacement: fileURLToPath(new URL('./src/shims/assets-registry.ts', import.meta.url)),
      },
    ],
    extensions: [
      '.web.tsx',
      '.web.ts',
      '.web.jsx',
      '.web.js',
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
      '.css',
      '.json',
    ],
  },
  define: { global: 'globalThis' },
});
