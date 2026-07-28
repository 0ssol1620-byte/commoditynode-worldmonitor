import { defineConfig, devices } from '@playwright/test';

const chromiumLaunchOptions = {
  args: ['--use-angle=swiftshader', '--use-gl=swiftshader'],
};

export default defineConfig({
  testDir: './e2e',
  testMatch: 'commoditynode-browser-matrix.spec.ts',
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 30_000,
  },
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    colorScheme: 'dark',
    // Regression guard: CommodityNode must remain English-first even when the
    // visitor's browser/OS locale is Korean.
    locale: 'ko-KR',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: chromiumLaunchOptions,
      },
    },
    {
      name: 'firefox-desktop',
      use: devices['Desktop Firefox'],
    },
    {
      name: 'webkit-desktop',
      use: devices['Desktop Safari'],
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 5'],
        launchOptions: chromiumLaunchOptions,
      },
    },
    {
      name: 'webkit-mobile',
      use: devices['iPhone 13'],
    },
    {
      name: 'chromium-phone-landscape',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 844, height: 390 },
        launchOptions: chromiumLaunchOptions,
      },
    },
  ],
  webServer: {
    command: 'cross-env VITE_E2E=1 npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/tests/map-harness.html',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
