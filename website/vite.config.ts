import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      // Only use Babel JSX dev plugin in development mode
      ...(mode === 'development' && {
        babel: {
          plugins: [
            ['@babel/plugin-transform-react-jsx-development', { runtime: 'automatic' }],
          ],
        },
      }),
    }),
  ],
  server: {
    port: 4000,
    host: '0.0.0.0',
  },
  build: {
    sourcemap: true,
  },
}));
