import { TodayView } from "@/components/today/TodayView";
import { ClientOnly } from "@/components/ui/ClientOnly";
import { Loading } from "@/components/ui/Screen";

export default function TodayPage() {
  return (
    <ClientOnly fallback={<Loading />}>
      <TodayView />
    </ClientOnly>
  );
}
