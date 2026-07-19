// Playwright config — serves the static site and runs smoke tests against it.
import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import path from 'node:path';

export default defineConfig({
  testDir: './tests',
  // Keep repeated Windows runs independent from stale .last-run.json handles.
  outputDir: path.join(tmpdir(), 'staticvault-playwright', String(process.pid)),
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
