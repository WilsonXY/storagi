import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  // Build the future stylesheet now without loading it into the current dashboard.
  build: { assetsInlineLimit: 0, rollupOptions: { input: {
    app: fileURLToPath(new URL('index.html', import.meta.url)),
    tokens: fileURLToPath(new URL('src/tokens.css', import.meta.url)),
  } } },
  server: { host: '127.0.0.1', fs: { allow: [fileURLToPath(new URL('.', import.meta.url))] } },
  test: { environment: 'jsdom', clearMocks: true, env: { TZ: 'America/New_York' } },
});
