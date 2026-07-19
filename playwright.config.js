// Playwright config — serves the static site and runs smoke tests against it.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45000,
  retries: 1,
  use: {
    baseURL: 'http://127.0.0.1:8931',
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'node serve.js',
    env: { PORT: '8931' },
    url: 'http://127.0.0.1:8931',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
