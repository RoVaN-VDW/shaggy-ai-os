import type { DashboardVoiceLanguage } from "./voice-contract";

export type SpeechPreferences = {
  autoSpeakEnglish: boolean;
  autoSpeakDutch: boolean;
  dutchCloudConsent: boolean;
  volume: number;
  playbackRate: number;
};

export const DEFAULT_SPEECH_PREFERENCES: SpeechPreferences = {
  autoSpeakEnglish: true,
  autoSpeakDutch: false,
  dutchCloudConsent: false,
  volume: 1,
  playbackRate: 1,
};

export const SPEECH_PREFERENCES_STORAGE_KEY = "shaggy.speech.preferences";
export const MAX_SPEECH_CHUNK_LENGTH = 720;

function clamp(value: unknown, minimum: number, maximum: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

export function normalizeSpeechPreferences(value: unknown): SpeechPreferences {
  if (!value || typeof value !== "object") return DEFAULT_SPEECH_PREFERENCES;
  const candidate = value as Partial<SpeechPreferences>;
  return {
    autoSpeakEnglish: candidate.autoSpeakEnglish !== false,
    autoSpeakDutch: candidate.autoSpeakDutch === true,
    dutchCloudConsent: candidate.dutchCloudConsent === true,
    volume: clamp(candidate.volume, 0, 1, 1),
    playbackRate: clamp(candidate.playbackRate, 0.8, 1.2, 1),
  };
}

function appendBounded(chunks: string[], value: string, maximum: number) {
  let remaining = value.trim();
  while (remaining.length > maximum) {
    let boundary = remaining.lastIndexOf(" ", maximum);
    if (boundary < Math.floor(maximum * 0.55)) boundary = maximum;
    chunks.push(remaining.slice(0, boundary).trim());
    remaining = remaining.slice(boundary).trim();
  }
  if (remaining) chunks.push(remaining);
}

export function splitSpeechText(text: string, maximum = MAX_SPEECH_CHUNK_LENGTH): string[] {
  if (!Number.isInteger(maximum) || maximum < 80 || maximum > 800) {
    throw new RangeError("Speech chunk maximum must be between 80 and 800 characters.");
  }
  const normalized = text.replaceAll(/\s+/g, " ").trim();
  if (!normalized) return [];
  const sentences = normalized.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (sentence.length > maximum) {
      if (current) chunks.push(current);
      current = "";
      appendBounded(chunks, sentence, maximum);
      continue;
    }
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= maximum) {
      current = candidate;
    } else {
      chunks.push(current);
      current = sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

const SENSITIVE_SPEECH_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:sk|ghp|github_pat|xox[baprs]|sbp)[-_][A-Za-z0-9_-]{8,}\b/i,
  /\b(?:api[ _-]?key|access[ _-]?token|refresh[ _-]?token|token|password|wachtwoord|secret)\s*[:=]\s*\S+/i,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
  /\b(?:\d[ -]*?){13,19}\b/,
];

export function containsSensitiveSpeechContent(text: string) {
  return SENSITIVE_SPEECH_PATTERNS.some((pattern) => pattern.test(text));
}

export function shouldAutoSpeak(
  language: DashboardVoiceLanguage,
  text: string,
  preferences: SpeechPreferences,
) {
  if (!text.trim() || containsSensitiveSpeechContent(text)) return false;
  if (language === "en-GB") return preferences.autoSpeakEnglish;
  return preferences.dutchCloudConsent && preferences.autoSpeakDutch;
}
