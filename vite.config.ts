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
        }),
        // DISABLED - Corrupts code (AST transformation issue)
        // clusoMetadataPlugin()
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.VITE_GOOGLE_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GOOGLE_API_KEY),
        // Buffer polyfill for browser (needed by @google/genai Live API)
        'global': 'globalThis',
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          // Workspace packages (dev): point to source so we don't require a prebuilt dist/.
          '@ai-cluso/shared-tools': path.resolve(__dirname, 'packages/shared-tools/src/index.ts'),
          '@ai-cluso/shared-inspector': path.resolve(__dirname, 'packages/shared-inspector/src/index.ts'),
          '@ai-cluso/shared-types': path.resolve(__dirname, 'packages/shared-types/src/index.ts'),
          '@ai-cluso/shared-audio': path.resolve(__dirname, 'packages/shared-audio/src/index.ts'),
          // Buffer polyfill for browser
          'buffer': 'buffer/',
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
        include: ['shiki', 'buffer'],
        // Don't try to prebundle workspace packages via their package.json exports.
        exclude: [
          '@ai-cluso/shared-tools',
          '@ai-cluso/shared-inspector',
          '@ai-cluso/shared-types',
          '@ai-cluso/shared-audio',
        ],
      },
      css: {
        devSourcemap: true,
      }
    };
});
