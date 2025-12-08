import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react({
          jsxRuntime: 'automatic',
          // Vite automatically adds __source in dev mode, no need for Babel plugin
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.VITE_GOOGLE_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GOOGLE_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: true,
      },
      optimizeDeps: {
        // Pre-bundle shiki to avoid 504 errors during HMR
        // Shiki dynamically imports themes/languages which can cause stale dep issues
        include: ['shiki'],
      },
      css: {
        devSourcemap: true,
      }
    };
});
