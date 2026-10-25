export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
      <p className="text-muted">
        Nothing scheduled yet. Workouts arrive in Milestone 2.
      </p>
    </main>
  );
}
