import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app is written in the React Native component model and rendered to the
// browser through react-native-web, so 'react-native' resolves to
// react-native-web here and .web.* files win over their platform-neutral
// twins, mirroring how a native bundler would pick them.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: /^react-native$/, replacement: 'react-native-web' }],
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
