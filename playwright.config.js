import { defineConfig, devices } from '@playwright/test';

const PORT = 4410;

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  // SMTP_HOST empty on purpose: test submissions land in data/contact-requests.jsonl,
  // never in the real inbox
  webServer: {
    command: 'node server.js',
    url: `http://127.0.0.1:${PORT}`,
    env: { PORT: String(PORT), SMTP_HOST: '', CONTACT_RATE_LIMIT: '1000' },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 15'] } },
  ],
});
