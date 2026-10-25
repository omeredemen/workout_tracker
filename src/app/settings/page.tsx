import { SettingsView } from "@/components/settings/SettingsView";
import { ClientOnly } from "@/components/ui/ClientOnly";
import { Loading } from "@/components/ui/Screen";

export default function SettingsPage() {
  return (
    <ClientOnly fallback={<Loading />}>
      <SettingsView />
    </ClientOnly>
  );
}
