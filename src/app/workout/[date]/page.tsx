import { Suspense } from "react";
import { Loading } from "@/components/ui/Screen";
import { WorkoutRoute } from "./WorkoutRoute";

// Dates are open-ended, so the param is only known at request time: keep it behind Suspense.
export default function WorkoutPage() {
  return (
    <Suspense fallback={<Loading />}>
      <WorkoutRoute />
    </Suspense>
  );
}
