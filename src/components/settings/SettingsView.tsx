"use client";

import { Screen } from "@/components/ui/Screen";
import { AccountSection } from "./AccountSection";
import { DataSection } from "./DataSection";
import { PreferencesSection } from "./PreferencesSection";

export function SettingsView() {
  return (
    <Screen title="Settings">
      <AccountSection />
      <PreferencesSection />
      <DataSection />
    </Screen>
  );
}
