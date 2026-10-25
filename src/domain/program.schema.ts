import { z } from "zod";

// Zod mirror of data/program.schema.json (plus the exercise library).
// Rules JSON Schema can't express live in parseProgram.ts.

const slug = z
  .string()
  .regex(/^[a-z0-9_]+$/, "Must use only lowercase letters, digits and _");

const range = z.object({ min: z.number(), max: z.number() });

export const equipmentSchema = z.enum([
  "machine",
  "dumbbell",
  "barbell",
  "smith",
  "ez_bar",
  "cable",
  "bodyweight",
]);

export const libraryExerciseSchema = z.object({
  id: slug,
  name: z.string().min(1),
  swapGroup: slug.nullable(),
  equipment: z.array(equipmentSchema).min(1),
  inSwapDoc: z.boolean().optional(),
  note: z.string().optional(),
});

export const swapGroupSchema = z.object({
  id: slug,
  name: z.string(),
  nameTr: z.string().optional(),
  bodyPart: z.string(),
});

export const exerciseLibrarySchema = z.object({
  schemaVersion: z.literal(1),
  swapRules: z.array(z.string()).default([]),
  equipment: z.partialRecord(equipmentSchema, z.string()).optional(),
  swapGroups: z.array(swapGroupSchema),
  exercises: z.array(libraryExerciseSchema),
});

export const techniqueSchema = z.enum(["straight", "rpt", "drop_set"]);
export const lastSetTechniqueSchema = z.enum(["rest_pause", "drop_set"]);

export const plannedExerciseSchema = z.strictObject({
  exerciseId: slug,
  sets: z.int().min(1).max(10),
  reps: z.array(z.int().min(1)),
  rir: z
    .string()
    .regex(/^[0-9](-[0-9])?$/, 'Must be a number or a range like "1-2"'),
  technique: techniqueSchema,
  lastSetTechnique: lastSetTechniqueSchema.optional(),
  superset: z
    .string()
    .regex(/^[A-Z]$/, "Must be a single capital letter")
    .optional(),
  perSide: z.boolean().default(false),
  note: z.string().optional(),
});

export const phaseSchema = z.object({
  id: slug,
  name: z.string(),
  goal: z.string().optional(),
  weeks: z.object({ from: z.int().min(1), to: z.int().min(1) }),
  days: z.record(slug, z.array(plannedExerciseSchema).min(1)),
});

const dayRef = slug.nullable();

export const weekdays = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

export const programSchema = z.object({
  schemaVersion: z.literal(1),
  id: slug,
  name: z.string().min(1),
  description: z.string().optional(),
  goal: z
    .enum(["fat_loss", "muscle_gain", "maintenance", "strength"])
    .optional(),
  durationWeeks: z.int().min(1).max(52),
  units: z.enum(["kg", "lb"]).default("kg"),
  weeklySchedule: z.strictObject({
    mon: dayRef,
    tue: dayRef,
    wed: dayRef,
    thu: dayRef,
    fri: dayRef,
    sat: dayRef,
    sun: dayRef,
  }),
  dayTemplates: z
    .record(slug, z.object({ name: z.string(), focus: z.string().optional() }))
    .refine(
      (t) => Object.keys(t).length > 0,
      "Needs at least one day template",
    ),
  rules: z
    .object({
      restBetweenSetsSec: range.optional(),
      restBetweenExercisesSec: z.int().min(0).optional(),
      cardio: z
        .object({
          frequency: z.enum(["daily", "training_days", "custom"]).optional(),
          timing: z.string().optional(),
          type: z.string().optional(),
          durationMin: z.number().min(0).optional(),
          incline: z.number().optional(),
          speedKmh: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
  // Techniques may carry extra fields (miniSets, dropPercent, …), so keep them.
  techniques: z
    .record(
      z.string(),
      z.looseObject({
        name: z.string(),
        description: z.string(),
        miniSets: z.int().min(1).optional(),
        miniSetRestSec: range.optional(),
        miniSetReps: range.optional(),
        dropPercent: range.optional(),
      }),
    )
    .default({}),
  nutrition: z
    .object({
      calorieDeficitKcal: range.optional(),
      calorieSurplusKcal: range.optional(),
      proteinGPerKg: z.number().min(0).optional(),
      fatGPerKg: z.number().min(0).optional(),
      carbs: z.literal("remaining_calories").optional(),
      note: z.string().optional(),
    })
    .optional(),
  exercises: z.array(libraryExerciseSchema).optional(),
  phases: z.array(phaseSchema).min(1),
});
