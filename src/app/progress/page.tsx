import { ProgressView } from "@/components/progress/ProgressView";
import { ClientOnly } from "@/components/ui/ClientOnly";
import { Loading } from "@/components/ui/Screen";

export default function ProgressPage() {
  return (
    <ClientOnly fallback={<Loading />}>
      <ProgressView />
    </ClientOnly>
  );
}
