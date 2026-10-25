import { AuthCallback } from "@/components/settings/AuthCallback";
import { ClientOnly } from "@/components/ui/ClientOnly";
import { Loading } from "@/components/ui/Screen";

export default function AuthCallbackPage() {
  return (
    <ClientOnly fallback={<Loading />}>
      <AuthCallback />
    </ClientOnly>
  );
}
