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
  webServer: [
    {
      // Supabase stand-in (auth + REST on PGlite with the real migrations and RLS).
      command: "node e2e/fake-supabase.mts",
      url: "http://localhost:54321/auth/v1/user",
      reuseExistingServer: false,
    },
    {
      command: "node_modules/.bin/next dev --port 3100",
      url: "http://localhost:3100",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      },
    },
  ],
});
