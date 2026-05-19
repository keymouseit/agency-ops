import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.test') })

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Run tests serially to avoid database conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid database race conditions
  reporter: process.env.CI ? 'github' : 'html',
  globalSetup: require.resolve('./tests/setup/global-setup'),
  globalTeardown: require.resolve('./tests/setup/global-teardown'),

  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3004',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run dev server before tests
  webServer: {
    command: process.env.CI ? 'npm run build && npm run start' : 'PORT=3004 npm run dev',
    url: 'http://localhost:3004',
    reuseExistingServer: !process.env.CI, // Reuse existing server locally, fresh in CI
    timeout: 120 * 1000,
    env: {
      PORT: '3004',
      NODE_ENV: 'test',
      ...(process.env.DATABASE_URL && { DATABASE_URL: process.env.DATABASE_URL }),
    },
  },
})
