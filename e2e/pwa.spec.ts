import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const MONDAY = new Date("2026-10-19T10:00:00");
const LAT = "Lat Pulldown (Normal Grip)";

async function signIn(page: Page, email: string) {
  await page.goto("/settings");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.getByLabel("Sign-in code").fill("123456");
  await page.getByRole("button", { name: "Sign in with code" }).click();
  await expect(page.getByText(email)).toBeVisible();
}

async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The worker claims open pages; a reload makes sure this one is controlled.
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null),
    )
    .toBe(true);
}

test("is installable", async ({ page }) => {
  await page.goto("/");
  const manifestHref = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href");
  const manifest = await (await page.request.get(manifestHref!)).json();
  expect(manifest).toMatchObject({ display: "standalone", start_url: "/" });
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual([
    "192x192",
    "512x512",
    "512x512",
  ]);
  for (const icon of manifest.icons)
    expect((await page.request.get(icon.src)).ok()).toBe(true);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
});

test("a set logged in airplane mode syncs when back online", async ({
  browser,
}) => {
  const phoneContext: BrowserContext = await browser.newContext();
  const phone = await phoneContext.newPage();
  await phone.clock.install({ time: MONDAY });

  await phone.goto("/programs");
  await waitForServiceWorker(phone);
  await phone.getByRole("button", { name: "Start program" }).click();
  await signIn(phone, "offline@example.com");
  await phone.getByRole("button", { name: "Sync now" }).click();
  await expect(phone.getByRole("status").last()).toHaveText(/^Synced/);

  // Airplane mode: the app still opens and navigates from the cache.
  await phoneContext.setOffline(true);
  await phone.goto("/");
  await expect(
    phone.getByText("Offline · everything you log is saved on this device"),
  ).toBeVisible();
  await phone.getByRole("link", { name: "Start workout" }).click();
  await expect(
    phone.getByRole("heading", { name: "Üst Vücut A" }),
  ).toBeVisible();
  await phone.getByLabel(`${LAT} set 1 weight in kg`).fill("60");
  await phone.getByRole("button", { name: `Save ${LAT} set 1` }).click();
  await expect(
    phone.getByRole("button", { name: `${LAT} set 1 saved` }),
  ).toBeVisible();

  await phone.getByRole("link", { name: "Settings" }).click();
  await expect(phone.getByText(/change.* waiting/)).toBeVisible();

  // Back online: the queued set is pushed without doing anything.
  await phoneContext.setOffline(false);
  await expect(phone.getByText(/change.* waiting/)).toBeHidden({
    timeout: 15_000,
  });
  await expect(phone.getByRole("status").last()).toHaveText(/^Synced/);

  // And another device gets it.
  const laptopContext = await browser.newContext();
  const laptop = await laptopContext.newPage();
  await laptop.clock.install({ time: MONDAY });
  await signIn(laptop, "offline@example.com");
  await laptop.getByRole("button", { name: "Sync now" }).click();
  await expect(laptop.getByRole("status").last()).toHaveText(/^Synced/);
  await laptop.goto("/workout?date=2026-10-19");
  await expect(laptop.getByLabel(`${LAT} set 1 weight in kg`)).toHaveValue(
    "60",
  );
});
