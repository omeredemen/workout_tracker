import { defineConfig } from "@playwright/test";

const supabaseEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

export default defineConfig({
  testDir: "e2e",
  use: {
    // Uses the installed Chrome, so no browser download is needed.
    channel: "chrome",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  },
  projects: [
    // App behaviour, against the dev server.
    {
      name: "app",
      testIgnore: /pwa\.spec/,
      use: { baseURL: "http://localhost:3100" },
    },
    // Service worker and offline, against a production build (the worker only registers there).
    {
      name: "pwa",
      testMatch: /pwa\.spec/,
      use: { baseURL: "http://localhost:3200" },
    },
  ],
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
      env: supabaseEnv,
    },
    {
      command:
        "node_modules/.bin/next build && node_modules/.bin/next start --port 3200",
      url: "http://localhost:3200",
      reuseExistingServer: false,
      timeout: 240_000,
      env: { ...supabaseEnv, NEXT_DIST_DIR: ".next-e2e" },
    },
  ],
});
