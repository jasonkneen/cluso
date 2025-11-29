import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
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
        sourcemap: true, // Enable source maps for production builds
      },
      // Enable source maps in dev mode (should be on by default but let's be explicit)
      css: {
        devSourcemap: true,
      }
    };
});
