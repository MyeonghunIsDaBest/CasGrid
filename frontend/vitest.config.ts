import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts so the production build (`tsc -b && vite build`)
// is never affected by test tooling. Test files are also excluded from
// tsconfig.app.json, so `tsc` doesn't type-check them.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
