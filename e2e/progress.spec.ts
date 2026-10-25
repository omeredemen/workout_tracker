import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const LAT = "Lat Pulldown (Normal Grip)";

async function startWolverine(page: Page) {
  await page.goto("/programs");
  await page.locator('input[type="date"]').fill("2026-10-19");
  await page.getByRole("button", { name: "Start program" }).click();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
}

async function logWeight(page: Page, day: string, kg: string) {
  await page.clock.setSystemTime(new Date(`${day}T08:00:00`));
  await page.goto("/progress");
  await page.getByLabel("Today's bodyweight in kg").fill(kg);
  await page.getByRole("button", { name: /^(Save|Update)$/ }).click();
  await expect(page.getByText(`Logged for`)).toBeVisible();
}

test("bodyweight, nutrition targets, weekly completion and exercise progress", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-19T08:00:00") });
  await startWolverine(page);

  // Three weigh-ins: the 7-day average is their mean.
  await logWeight(page, "2026-10-19", "91");
  await logWeight(page, "2026-10-20", "90,4");
  await logWeight(page, "2026-10-21", "89.6");
  await expect(page.getByText("7-day average 90.3 kg")).toBeVisible();
  await page.getByText("Show as table").first().click();
  await expect(
    page.getByRole("row", { name: /Wed 21 Oct 90\.3 89\.6/ }),
  ).toBeVisible();

  // Nutrition from the latest weight (89.6 kg): protein 2 g/kg, fat 0.8 g/kg.
  await expect(page.getByText("Protein179 g")).toBeVisible();
  await expect(page.getByText("Fat72 g")).toBeVisible();
  await page.getByLabel("Maintenance calories").fill("2800");
  await expect(page.getByText("Calories2200–2400 kcal")).toBeVisible();
  await expect(page.getByText("Carbs209–259 g")).toBeVisible();

  // Log and finish Monday's workout (two sets is enough), then check the stats.
  await page.goto("/workout?date=2026-10-19");
  await page.getByLabel(`${LAT} set 1 weight in kg`).fill("50");
  await page.getByRole("button", { name: `Save ${LAT} set 1` }).click();
  await page.getByLabel(`${LAT} set 2 weight in kg`).fill("55");
  await page.getByLabel(`${LAT} set 2 reps`).fill("8");
  await page.getByRole("button", { name: `Save ${LAT} set 2` }).click();
  await expect(
    page.getByRole("button", { name: `${LAT} set 2 saved` }),
  ).toBeVisible();
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Finish workout" }).click();
  await expect(page.getByText("Workout completed ✓")).toBeVisible();

  await page.goto("/progress");
  await expect(page.getByText("1 of 4 done")).toBeVisible();
  await page.getByRole("img", { name: /^W1: 1 of 4 workouts/ }).focus();
  await expect(
    page.getByRole("status").filter({ hasText: "1 of 4 workouts" }),
  ).toBeVisible();

  await expect(page.getByLabel("Exercise")).toHaveValue("lat_pulldown");
  // 55 × 8 (e1RM 69.7) beats 50 × 10 (66.7).
  await expect(page.getByText("Best set last time: 55 kg × 8")).toBeVisible();
});

test("import a program: clear errors for bad input, then start it", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-19T08:00:00") });
  await page.goto("/programs");

  const json = page.getByLabel("Program JSON");
  const problems = page.getByRole("alert").filter({ hasText: /problem/ });
  await json.fill("{ not json");
  await page.getByRole("button", { name: "Check program" }).click();
  await expect(problems).toContainText("Not valid JSON");

  const program = {
    schemaVersion: 1,
    id: "mini",
    name: "Mini Program",
    durationWeeks: 1,
    weeklySchedule: {
      mon: "full",
      tue: null,
      wed: null,
      thu: null,
      fri: null,
      sat: null,
      sun: null,
    },
    dayTemplates: { full: { name: "Full Body" } },
    techniques: { straight: { name: "Straight", description: "Normal sets." } },
    phases: [
      {
        id: "only",
        name: "Only phase",
        weeks: { from: 1, to: 1 },
        days: {
          full: [
            {
              exerciseId: "leg_press",
              sets: 2,
              reps: [8],
              rir: "1",
              technique: "straight",
            },
          ],
        },
      },
    ],
  };
  await json.fill(JSON.stringify(program));
  await page.getByRole("button", { name: "Check program" }).click();
  await expect(problems).toContainText("1 problem to fix");
  await expect(problems).toContainText("phases[0].days.full[0].reps");
  await expect(problems).toContainText("has 2 sets but 1 rep targets");

  program.phases[0]!.days.full[0]!.reps = [8, 8];
  await json.fill(JSON.stringify(program));
  await page.getByRole("button", { name: "Check program" }).click();
  await expect(
    page.getByRole("heading", { name: "Mini Program" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start program" }).click();

  await expect(page.getByRole("heading", { name: "Full Body" })).toBeVisible();
  await expect(page.getByText("Leg Press")).toBeVisible();
});

test("units and export", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-19T08:00:00") });
  await startWolverine(page);
  await page.goto("/workout?date=2026-10-19");
  await page.getByLabel(`${LAT} set 1 weight in kg`).fill("50");
  await page.getByRole("button", { name: `Save ${LAT} set 1` }).click();
  await expect(
    page.getByRole("button", { name: `${LAT} set 1 saved` }),
  ).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("radio", { name: "lb" }).click();
  await page.goto("/workout?date=2026-10-19");
  await expect(page.getByLabel(`${LAT} set 1 weight in lb`)).toHaveValue(
    "110.2",
  );
  await expect(
    page.getByRole("button", { name: `${LAT} set 1 saved` }),
  ).toBeVisible(); // not "changed"

  await page.goto("/settings");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export as JSON" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("workout-tracker-2026-10-19.json");
  const exported = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(exported).toMatchObject({ app: "workout-tracker", version: 1 });
  expect(exported.data.setLogs).toEqual([
    expect.objectContaining({ exerciseId: "lat_pulldown", weightKg: 50 }),
  ]);
  expect(exported.data.programs[0].slug).toBe("wolverine");
});
