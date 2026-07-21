"use client";

import { useSpeechOutput, type SpeechOutputStatus } from "./speech-output-provider";

export type DashboardVoiceStatus = SpeechOutputStatus;

export function useDashboardVoice() {
  return useSpeechOutput();
}