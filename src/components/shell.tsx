"use client";

import type { ReactNode } from "react";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/features/command-center/components/AppShell";
import { SpeechOutputProvider } from "@/features/voice/speech-output-provider";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <SpeechOutputProvider>
        <AppShell>{children}</AppShell>
      </SpeechOutputProvider>
    </AuthGate>
  );
}
