export const REALTIME_MODEL = "gpt-realtime-2.1" as const;

export const REALTIME_VOICES = [
  { id: "cedar", label: "Cedar", description: "Deep and controlled" },
  { id: "marin", label: "Marin", description: "Natural and conversational" },
] as const;

export const REALTIME_LANGUAGES = ["nl-BE", "en-GB"] as const;

export type RealtimeVoice = (typeof REALTIME_VOICES)[number]["id"];
export type RealtimeLanguage = (typeof REALTIME_LANGUAGES)[number];

type RealtimeAvailabilityInput = {
  enabled: boolean;
  hasApiKey: boolean;
};

export function normalizeRealtimeVoice(value: unknown): RealtimeVoice {
  return value === "marin" ? "marin" : "cedar";
}

export function normalizeRealtimeLanguage(value: unknown): RealtimeLanguage {
  return value === "en-GB" ? "en-GB" : "nl-BE";
}

export function getRealtimeAvailability({ enabled, hasApiKey }: RealtimeAvailabilityInput) {
  const configured = hasApiKey;
  return {
    enabled,
    configured,
    available: enabled && configured,
    reason: !enabled ? "disabled" : !configured ? "missing_key" : null,
  } as const;
}

function instructionsFor(language: RealtimeLanguage) {
  const languageInstruction = language === "en-GB"
    ? "Speak clear British English."
    : "Spreek helder Vlaams Nederlands, rustig en professioneel.";

  return [
    "You are SHAGGY's restricted voice audition interface for Ronald.",
    languageInstruction,
    "Keep responses concise, natural and suitable for evaluating voice quality.",
    "Dit is alleen een voice audition: gebruik geen tools, voer geen acties uit en beweer niet dat externe systemen werden geraadpleegd.",
    "Never request credentials, secrets or payment details.",
  ].join(" ");
}

export function buildRealtimeSessionConfig({
  voice,
  language,
}: {
  voice: unknown;
  language: unknown;
}) {
  const normalizedVoice = normalizeRealtimeVoice(voice);
  const normalizedLanguage = normalizeRealtimeLanguage(language);
  return {
    type: "realtime" as const,
    model: REALTIME_MODEL,
    output_modalities: ["audio"] as const,
    instructions: instructionsFor(normalizedLanguage),
    audio: {
      input: {
        turn_detection: null,
      },
      output: {
        voice: normalizedVoice,
      },
    },
  };
}
