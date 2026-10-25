"use client";

import { useParams } from "next/navigation";
import { ClientOnly } from "@/components/ui/ClientOnly";
import { Loading } from "@/components/ui/Screen";
import { WorkoutView } from "@/components/workout/WorkoutView";

export function WorkoutRoute() {
  const { date } = useParams<{ date: string }>();
  return (
    <ClientOnly fallback={<Loading />}>
      <WorkoutView date={date} />
    </ClientOnly>
  );
}
