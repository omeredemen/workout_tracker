import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: "http://localhost:3100",
    // Uses the installed Chrome, so no browser download is needed.
    channel: "chrome",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  },
  webServer: {
    command: "node_modules/.bin/next dev --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
