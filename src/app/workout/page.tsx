import { Suspense } from "react";
import { Loading } from "@/components/ui/Screen";
import { WorkoutRoute } from "./WorkoutRoute";

// The date is a search param (/workout?date=2026-10-19) rather than a path
// segment, so this is one static page the service worker can serve offline
// for any date. Reading search params requires the Suspense boundary.
export default function WorkoutPage() {
  return (
    <Suspense fallback={<Loading />}>
      <WorkoutRoute />
    </Suspense>
  );
}
