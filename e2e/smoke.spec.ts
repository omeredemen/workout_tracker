import { expect, test } from "@playwright/test";

// Monday of week 1, so "today" is a workout day (Upper A, 7 exercises, 21 sets).
const MONDAY = new Date("2026-10-19T10:00:00");

test("set up the program, log a full workout, and see it completed after reload", async ({
  page,
}) => {
  await page.clock.install({ time: MONDAY });

  await page.goto("/");
  await page.getByRole("link", { name: "Choose start date" }).click();
  await page.getByRole("button", { name: "This week" }).click();
  await expect(page.getByText("Week 1 starts Monday 19 October")).toBeVisible();
  await page.getByRole("button", { name: "Start program" }).click();

  await expect(
    page.getByRole("heading", { name: "Üst Vücut A" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Start workout" }).click();

  await expect(page.getByText("Superset A · back to back")).toBeVisible();
  // Each set shows its target as the reps placeholder.
  await expect(
    page.getByLabel("Lat Pulldown (Normal Grip) set 1 reps"),
  ).toHaveAttribute("placeholder", "10");

  // Log every set: type a weight on the first set of each exercise, accept the target reps.
  const saveButtons = page.getByRole("button", { name: /^Save / });
  await expect(saveButtons).toHaveCount(21);
  for (let remaining = 21; remaining > 0; remaining--) {
    const button = saveButtons.first();
    const label = (await button.getAttribute("aria-label"))!.replace(
      /^Save /,
      "",
    );
    const weight = page.getByLabel(`${label} weight in kg`);
    if ((await weight.inputValue()) === "") await weight.fill("40,5");
    await button.click();
    await expect(
      page.getByRole("button", { name: `${label} saved` }),
    ).toBeVisible();
  }
  await expect(page.getByText("21 of 21 sets logged")).toBeVisible();

  await page.getByRole("button", { name: "Finish workout" }).click();
  await expect(page.getByText("Workout completed ✓")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Workout completed ✓")).toBeVisible();
  await expect(
    page.getByLabel("Lat Pulldown (Normal Grip) set 1 weight in kg"),
  ).toHaveValue("40.5");
  await expect(
    page.getByLabel("Lat Pulldown (Normal Grip) set 2 weight in kg"),
  ).toHaveValue("40.5");

  await page.goto("/calendar");
  await expect(
    page.getByRole("heading", { name: "October 2026" }),
  ).toBeVisible();
  await expect(page.getByLabel("Monday 19 October, Completed")).toBeVisible();
  await expect(page.getByLabel("Tuesday 20 October, Planned")).toBeVisible();
  await expect(page.getByText("Week 1 ·")).toBeVisible();
});

test("past workouts with nothing logged show as missed", async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await page.goto("/programs");
  await page.getByRole("button", { name: "Start program" }).click();
  await expect(
    page.getByRole("heading", { name: "Üst Vücut A" }),
  ).toBeVisible();

  await page.clock.setSystemTime(new Date("2026-10-21T10:00:00"));
  await page.goto("/calendar");
  await expect(page.getByLabel("Monday 19 October, Missed")).toBeVisible();
  await expect(page.getByLabel("Tuesday 20 October, Missed")).toBeVisible();
  await expect(page.getByLabel("Wednesday 21 October, Rest")).toBeVisible();
});
