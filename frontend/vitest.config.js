import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.js'],
    onConsoleLog: () => false,
    silent: true,
    pool: 'threads',
    teardownTimeout: 10000,
  },
});
