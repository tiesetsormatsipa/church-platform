import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC compiles decorators with metadata, which Nest's dependency injection needs.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts'],
  },
});
