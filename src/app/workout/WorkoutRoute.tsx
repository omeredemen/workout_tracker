"use client";

import { useSearchParams } from "next/navigation";
import { ClientOnly } from "@/components/ui/ClientOnly";
import { Loading } from "@/components/ui/Screen";
import { WorkoutView } from "@/components/workout/WorkoutView";

export function WorkoutRoute() {
  const date = useSearchParams().get("date") ?? "";
  return (
    <ClientOnly fallback={<Loading />}>
      <WorkoutView date={date} />
    </ClientOnly>
  );
}
