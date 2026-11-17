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
  await expect(page.getByRole("timer", { name: "Rest timer" })).toHaveCount(0); // not live, so no rest timer
  // Filled in on a later day, so no workout clock either.
  await expect(
    page.getByRole("timer", { name: "Time in workout" }),
  ).toHaveCount(0);

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
  // Progressive overload: 10 reps done, only 6 planned now → go heavier.
  await expect(page.getByLabel(`${LAT} set 1 weight in kg`)).toHaveValue(
    "52.5",
  );
  await expect(page.getByLabel(`${LAT} set 1 advice`)).toContainText(
    "Today: 52.5 kg (↑ from 50 kg)",
  );

  // Technique explanation.
  await page
    .getByRole("button", { name: "Reverse Pyramid Training ⓘ" })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText("First set heaviest");
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  // Saving a set starts a 2:00 rest; +30s adds time; Skip stops it.
  await expect(
    page.getByText("The timer starts with your first set."),
  ).toBeVisible();
  await saveSet(page, `${LAT} set 1`, "55");
  // ...and starts the workout clock.
  const clock = page.getByRole("timer", { name: "Time in workout" });
  await expect(clock).toContainText("0:0");
  const timer = page.getByRole("timer", { name: "Rest timer" });
  await expect(timer).toContainText("2:00");
  await timer.getByRole("button", { name: "+30s" }).click();
  await expect(timer).toContainText("2:30");
  await page.clock.runFor(150_000);
  await expect(timer).toContainText("Go!");
  await expect(clock).toContainText("2:3");
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
  await page
    .getByRole("timer", { name: "Rest timer" })
    .getByRole("button", { name: "Skip" })
    .click();

  // Superset: no rest after the first exercise, rest after the second.
  await saveSet(page, "Rope Curl set 1", "20");
  await expect(page.getByRole("timer", { name: "Rest timer" })).toHaveCount(0);
  await saveSet(page, "Straight Bar Pushdown set 1", "25");
  await expect(page.getByRole("timer", { name: "Rest timer" })).toContainText(
    "2:00",
  );
  await page
    .getByRole("timer", { name: "Rest timer" })
    .getByRole("button", { name: "Skip" })
    .click();

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

  // Finishing freezes the clock at the workout's length; Today shows it too.
  page.on("dialog", (d) => void d.accept());
  await page.goto("/workout?date=2026-12-14");
  await page.clock.runFor(60_000);
  await page.getByRole("button", { name: "Finish workout" }).click();
  const took = page.getByRole("timer", { name: "Workout duration" });
  await expect(took).toContainText("Workout took");
  const length = (await took.textContent())!.replace("Workout took", "");
  await page.clock.runFor(120_000);
  await expect(took).toHaveText(`Workout took${length}`);
  await page.goto("/");
  await expect(page.getByText(`· ${length}`)).toBeVisible();
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

  // The skipped workout can still be done on a later day, with the clock and rest timer.
  await page.clock.setSystemTime(new Date("2026-12-18T10:00:00"));
  await page.goto("/workout?date=2026-12-17");
  await expect(
    page.getByText("Doing this workout now? Start the timer."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start now" }).click();
  await expect(
    page.getByRole("timer", { name: "Time in workout" }),
  ).toContainText("0:0");
  await page
    .getByRole("button", { name: /^Save .* set 1$/ })
    .first()
    .click();
  await expect(page.getByRole("timer", { name: "Rest timer" })).toBeVisible();
});
