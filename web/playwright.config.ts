import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3999',
    headless: true,
  },
  webServer: {
    command: 'npx serve -p 3999 -s .',
    url: 'http://localhost:3999',
    reuseExistingServer: false,
    timeout: 10000,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})
