import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    // Ensure consistent module resolution
    deps: {
      inline: [/@testing-library/],
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['electron/ai-sdk-wrapper.cjs', 'hooks/useAIChatV2.ts'],
    },
  },
})
