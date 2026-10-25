"use client";

import { LocalStorageRepository } from "@/data/localStorageRepository";
import { useRepository } from "@/data/RepositoryProvider";
import { toIsoDate } from "@/domain/dates";
import { button, card } from "@/components/ui/styles";

export function DataSection() {
  const repo = useRepository();

  async function exportData() {
    if (!(repo instanceof LocalStorageRepository)) return;
    const data = await repo.exportAll();
    const file = new Blob(
      [
        JSON.stringify(
          {
            app: "workout-tracker",
            version: 1,
            exportedAt: new Date().toISOString(),
            data,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `workout-tracker-${toIsoDate(new Date())}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className={`${card} flex flex-col gap-3`}>
      <div>
        <h2 className="font-semibold">Your data</h2>
        <p className="text-muted text-sm">
          Download everything on this device — programs, workouts, sets and
          bodyweight — as a JSON file.
        </p>
      </div>
      <button
        type="button"
        className={button.secondary}
        onClick={() => void exportData()}
      >
        Export as JSON
      </button>
    </section>
  );
}
