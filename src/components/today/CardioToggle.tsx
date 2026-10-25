"use client";

import { useState } from "react";
import type { Program, ScheduledDay } from "@/domain/types";
import type { SessionRecord } from "@/data/records";
import { useRepository } from "@/data/RepositoryProvider";
import { updateSession } from "@/data/sessions";
import { card } from "@/components/ui/styles";

/** Whether the program asks for cardio on this day. */
export function cardioDue(program: Program, day: ScheduledDay): boolean {
  const cardio = program.rules?.cardio;
  if (!cardio) return false;
  return cardio.frequency === "training_days" ? day.dayKey !== null : true;
}

export function CardioToggle({
  program,
  enrollmentId,
  day,
  session,
}: {
  program: Program;
  enrollmentId: string;
  day: ScheduledDay;
  session: SessionRecord | null | undefined;
}) {
  const repo = useRepository();
  const [saving, setSaving] = useState(false);
  const cardio = program.rules?.cardio;
  if (!cardio || !cardioDue(program, day)) return null;

  const done = session?.cardioDone ?? false;
  const details = [
    cardio.durationMin !== undefined && `${cardio.durationMin} min`,
    cardio.type?.replaceAll("_", " "),
    cardio.incline !== undefined && `incline ${cardio.incline}`,
    cardio.speedKmh !== undefined && `${cardio.speedKmh} km/h`,
  ].filter(Boolean);

  async function toggle() {
    setSaving(true);
    try {
      await updateSession(repo, enrollmentId, day, () => ({
        cardioDone: !done,
      }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className={`${card} flex cursor-pointer items-center gap-4`}>
      <input
        type="checkbox"
        checked={done}
        disabled={saving}
        onChange={toggle}
        className="size-7 shrink-0 accent-[var(--accent)]"
      />
      <span className="min-w-0">
        <span className="block font-semibold">Cardio{done && " ✓"}</span>
        <span className="text-muted block text-sm">{details.join(" · ")}</span>
        {cardio.timing && (
          <span className="text-muted block text-xs">{cardio.timing}</span>
        )}
      </span>
    </label>
  );
}
