import { ProgramSetup } from "@/components/programs/ProgramSetup";
import { ClientOnly } from "@/components/ui/ClientOnly";
import { Loading } from "@/components/ui/Screen";

export default function ProgramsPage() {
  return (
    <ClientOnly fallback={<Loading />}>
      <ProgramSetup />
    </ClientOnly>
  );
}
