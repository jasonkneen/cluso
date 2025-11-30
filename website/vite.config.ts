import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Force Babel JSX transform with _debugSource for source location tracking
// By default, Vite uses esbuild which is faster but doesn't add _debugSource
export default defineConfig({
  plugins: [
    react({
      // Use Babel for all JSX to get _debugSource in dev mode
      babel: {
        plugins: [
          // This plugin adds __source prop to all JSX elements in dev mode
          ['@babel/plugin-transform-react-jsx-development', { runtime: 'automatic' }],
        ],
      },
    }),
  ],
  server: {
    port: 4000,
    host: '0.0.0.0',
  },
  build: {
    sourcemap: true,
  },
});
