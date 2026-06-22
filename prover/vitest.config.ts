import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,       // expose describe, test, expect globally
    include: ['src/__tests__/**/*.test.ts'],
  },
});
