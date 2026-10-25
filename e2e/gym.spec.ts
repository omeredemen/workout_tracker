import { expect, test, type Page } from "@playwright/test";

// Program starts Mon 19 Oct 2026; week 9 (phase 3) starts Mon 14 Dec.
const WEEK_9_MONDAY = new Date("2026-12-14T10:00:00");
const LAT = "Lat Pulldown (Normal Grip)";

async function startProgram(page: Page) {
  await page.goto("/programs");
  await page.locator('input[type="date"]').fill("2026-10-19");
  await page.getByRole("button", { name: "Start program" }).click();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
}

async function saveSet(page: Page, label: string, weight?: string) {
  if (weight !== undefined)
    await page.getByLabel(`${label} weight in kg`).fill(weight);
  await page.getByRole("button", { name: `Save ${label}` }).click();
  await expect(
    page.getByRole("button", { name: `${label} saved` }),
  ).toBeVisible();
}

test("a full phase 3 workout: last time, RPT, rest timer, rest-pause, superset, swap", async ({
  page,
}) => {
  await page.clock.install({ time: WEEK_9_MONDAY });
  await startProgram(page);

  // Log a set in a past workout (week 1) so "last time" has something to show.
  await page.goto("/workout?date=2026-10-19");
  await saveSet(page, `${LAT} set 1`, "50");
  await expect(page.getByRole("timer")).toHaveCount(0); // not live, so no rest timer

  await page.goto("/");
  await page.getByRole("link", { name: "Start workout" }).click();
  await expect(
    page.getByText("Week 9 · Faz 3", { exact: false }),
  ).toBeVisible();

  // RPT: different target per set, last time's numbers and weight suggestion.
  await expect(page.getByLabel(`${LAT} set 1 reps`)).toHaveAttribute(
    "placeholder",
    "6",
  );
  await expect(page.getByLabel(`${LAT} set 2 reps`)).toHaveAttribute(
    "placeholder",
    "8",
  );
  await expect(page.getByLabel(`${LAT} set 3 reps`)).toHaveAttribute(
    "placeholder",
    "10",
  );
  await expect(page.getByLabel(`${LAT} set 1 last time`)).toHaveText(
    "Last time: 50 kg × 10",
  );
  await expect(page.getByLabel(`${LAT} set 1 weight in kg`)).toHaveValue("50");

  // Technique explanation.
  await page
    .getByRole("button", { name: "Reverse Pyramid Training ⓘ" })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText("First set heaviest");
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  // Saving a set starts a 2:00 rest; +30s adds time; Skip stops it.
  await saveSet(page, `${LAT} set 1`, "55");
  const timer = page.getByRole("timer");
  await expect(timer).toContainText("2:00");
  await timer.getByRole("button", { name: "+30s" }).click();
  await expect(timer).toContainText("2:30");
  await page.clock.runFor(150_000);
  await expect(timer).toContainText("Go!");
  await timer.getByRole("button", { name: "Dismiss" }).click();
  await expect(timer).toHaveCount(0);

  // Rest-pause on the last lateral raise set: mini-set inputs, saved with the set.
  const lateral = "DB Lateral Raise set 3";
  await page.getByLabel(`${lateral} weight in kg`).fill("8");
  for (const [i, reps] of ["4", "3", "3"].entries()) {
    await page
      .getByLabel(`${lateral} rest-pause mini-set ${i + 1} reps`)
      .fill(reps);
  }
  await saveSet(page, lateral);
  await page.getByRole("timer").getByRole("button", { name: "Skip" }).click();

  // Superset: no rest after the first exercise, rest after the second.
  await saveSet(page, "Rope Curl set 1", "20");
  await expect(page.getByRole("timer")).toHaveCount(0);
  await saveSet(page, "Straight Bar Pushdown set 1", "25");
  await expect(page.getByRole("timer")).toContainText("2:00");
  await page.getByRole("timer").getByRole("button", { name: "Skip" }).click();

  // Swap at the start of the phase: no mid-phase warning.
  await page.getByRole("button", { name: "Swap Seated Cable Row" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("to the end of Faz 3");
  await expect(sheet.getByRole("alert")).toHaveCount(0);
  await sheet.getByRole("button", { name: /T Bar Row/ }).click();
  await expect(page.getByRole("heading", { name: "T Bar Row" })).toBeVisible();
  await expect(page.getByText("Swapped from Seated Cable Row")).toBeVisible();

  // Everything survives a reload.
  await page.reload();
  await expect(
    page.getByLabel(`${lateral} rest-pause mini-set 1 reps`),
  ).toHaveValue("4");
  await expect(page.getByRole("heading", { name: "T Bar Row" })).toBeVisible();

  // The swap carries to next week's Upper A, where swapping again warns about mid-phase.
  await page.goto("/workout?date=2026-12-21");
  await expect(page.getByRole("heading", { name: "T Bar Row" })).toBeVisible();
  await page.getByRole("button", { name: "Swap T Bar Row" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "middle of a phase",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Seated Cable Row/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Seated Cable Row" }),
  ).toBeVisible();
  await expect(page.getByText("Swapped from")).toHaveCount(0);
});

test("cardio can be ticked on rest days, and a workout can be skipped", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-12-16T10:00:00") }); // a Wednesday: rest day
  await startProgram(page);

  await expect(page.getByRole("heading", { name: "Rest day" })).toBeVisible();
  const cardio = page.getByRole("checkbox", { name: /Cardio/ });
  await cardio.check();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /Cardio/ })).toBeChecked();

  page.on("dialog", (d) => void d.accept());
  await page.goto("/workout?date=2026-12-17");
  await page.getByRole("button", { name: "Skip this workout" }).click();
  await expect(page.getByText("You skipped this workout")).toBeVisible();
  await page.goto("/calendar");
  await expect(page.getByLabel("Thursday 17 December, Skipped")).toBeVisible();
  await expect(page.getByLabel("Wednesday 16 December, Rest")).toBeVisible();
});
