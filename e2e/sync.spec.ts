import { expect, test, type Browser, type Page } from "@playwright/test";

const MONDAY = new Date("2026-10-19T10:00:00");
const LAT = "Lat Pulldown (Normal Grip)";

async function newDevice(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.clock.install({ time: MONDAY });
  return page;
}

async function signIn(page: Page, email: string) {
  await page.goto("/settings");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.getByLabel("Sign-in code").fill("123456");
  await page.getByRole("button", { name: "Sign in with code" }).click();
  await expect(page.getByText(email)).toBeVisible();
}

async function syncNow(page: Page) {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.getByRole("status")).toHaveText(/^Synced/, {
    timeout: 15_000,
  });
}

test("data logged on the phone appears on the laptop, and stays private", async ({
  browser,
}) => {
  // Phone: used locally first, then signs in — local data is uploaded.
  const phone = await newDevice(browser);
  await phone.goto("/programs");
  await phone.getByRole("button", { name: "Start program" }).click();
  await phone.getByRole("link", { name: "Start workout" }).click();
  await phone.getByLabel(`${LAT} set 1 weight in kg`).fill("52,5");
  await phone.getByRole("button", { name: `Save ${LAT} set 1` }).click();
  await expect(
    phone.getByRole("button", { name: `${LAT} set 1 saved` }),
  ).toBeVisible();

  await signIn(phone, "me@example.com");
  await syncNow(phone);
  await expect(phone.getByRole("status")).not.toContainText("waiting");

  // Laptop: signs in and gets everything.
  const laptop = await newDevice(browser);
  await signIn(laptop, "me@example.com");
  await syncNow(laptop);
  await laptop.goto("/workout/2026-10-19");
  await expect(laptop.getByLabel(`${LAT} set 1 weight in kg`)).toHaveValue(
    "52.5",
  );

  // Laptop logs another set; the phone picks it up.
  await laptop.getByLabel(`${LAT} set 2 weight in kg`).fill("50");
  await laptop.getByRole("button", { name: `Save ${LAT} set 2` }).click();
  await expect(
    laptop.getByRole("button", { name: `${LAT} set 2 saved` }),
  ).toBeVisible();
  await syncNow(laptop);
  await syncNow(phone);
  await phone.goto("/workout/2026-10-19");
  await expect(phone.getByLabel(`${LAT} set 2 weight in kg`)).toHaveValue("50");

  // Someone else signing in on a fresh device sees none of it.
  const stranger = await newDevice(browser);
  await signIn(stranger, "someone@example.com");
  await syncNow(stranger);
  await stranger.goto("/");
  await expect(
    stranger.getByRole("heading", { name: "Set up your program" }),
  ).toBeVisible();

  // And on a device holding another account's data, they're asked before it's replaced.
  await phone.goto("/settings");
  await phone.getByRole("button", { name: "Sign out" }).click();
  await signInExpectingConflict(phone, "someone@example.com");
});

async function signInExpectingConflict(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.getByLabel("Sign-in code").fill("123456");
  await page.getByRole("button", { name: "Sign in with code" }).click();
  await expect(
    page.getByRole("heading", { name: "Different account" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Replace data on this device" })
    .click();
  await expect(page.getByText(email)).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Set up your program" }),
  ).toBeVisible();
}

test("settings without an account explains sync", async ({ page }) => {
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Sign in to sync" }),
  ).toBeVisible();
});
