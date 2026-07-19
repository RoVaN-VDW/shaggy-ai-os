"use client";

import { useSyncExternalStore } from "react";

import {
  normalizeDashboardVoiceLanguage,
  type DashboardVoiceLanguage,
} from "./voice-contract";

const STORAGE_KEY = "shaggy.dashboard.voice.language";
const CHANGE_EVENT = "shaggy:dashboard-voice-language";

function getLanguageSnapshot(): DashboardVoiceLanguage {
  if (typeof window === "undefined") return "nl-BE";
  return normalizeDashboardVoiceLanguage(window.localStorage.getItem(STORAGE_KEY));
}

function getServerLanguageSnapshot(): DashboardVoiceLanguage {
  return "nl-BE";
}

function subscribeToLanguage(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function setDashboardVoiceLanguage(language: DashboardVoiceLanguage) {
  window.localStorage.setItem(STORAGE_KEY, language);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useDashboardVoiceLanguage() {
  return useSyncExternalStore(subscribeToLanguage, getLanguageSnapshot, getServerLanguageSnapshot);
}
