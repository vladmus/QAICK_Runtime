import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    alias: {
      '@qaick/executor': resolve(import.meta.dirname, '../QAICK_Executor/dist/index.js'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
