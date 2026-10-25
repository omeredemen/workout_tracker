import { CalendarView } from "@/components/calendar/CalendarView";
import { ClientOnly } from "@/components/ui/ClientOnly";
import { Loading } from "@/components/ui/Screen";

export default function CalendarPage() {
  return (
    <ClientOnly fallback={<Loading />}>
      <CalendarView />
    </ClientOnly>
  );
}
