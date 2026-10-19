import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  server: { host: '127.0.0.1', fs: { allow: [fileURLToPath(new URL('.', import.meta.url))] } },
  test: { environment: 'jsdom', clearMocks: true },
});
