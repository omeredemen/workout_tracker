"use client";

import { Screen } from "@/components/ui/Screen";
import { AccountSection } from "./AccountSection";

export function SettingsView() {
  return (
    <Screen title="Settings">
      <AccountSection />
    </Screen>
  );
}
