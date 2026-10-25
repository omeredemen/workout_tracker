"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSync } from "@/data/sync/SyncProvider";
import { Screen } from "@/components/ui/Screen";
import { button } from "@/components/ui/styles";

/** Landing page for magic links. The Supabase client exchanges the code in the URL on load. */
export function AuthCallback() {
  const router = useRouter();
  const { state } = useSync();
  const signedIn = state.kind !== "signed_out" && state.kind !== "disabled";
  const error = new URLSearchParams(window.location.search).get(
    "error_description",
  );

  useEffect(() => {
    if (signedIn) router.replace("/settings");
  }, [signedIn, router]);

  return (
    <Screen title={error ? "Couldn't sign in" : "Signing you in…"}>
      {error && (
        <>
          <p className="text-danger" role="alert">
            {error}
          </p>
          <Link href="/settings" className={button.secondary}>
            Back to settings
          </Link>
        </>
      )}
    </Screen>
  );
}
