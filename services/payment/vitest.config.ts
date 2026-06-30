import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Property-based suites run >=100 iterations each; give them room.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
