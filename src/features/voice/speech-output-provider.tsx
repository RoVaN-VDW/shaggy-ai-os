"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  DEFAULT_SPEECH_PREFERENCES,
  SPEECH_PREFERENCES_STORAGE_KEY,
  normalizeSpeechPreferences,
  shouldAutoSpeak,
  splitSpeechText,
  type SpeechPreferences,
} from "./speech-output-contract";
import { useDashboardVoiceLanguage, setDashboardVoiceLanguage } from "./use-dashboard-voice-language";
import type { DashboardVoiceLanguage } from "./voice-contract";

const CHANGE_EVENT = "shaggy:speech-preferences";
const DEFAULT_ENDPOINT = "http://127.0.0.1:8766";

export type SpeechOutputStatus = "idle" | "understanding" | "speaking" | "paused" | "error";

type SpeakOptions = { requestId?: string };

type SpeechOutputContextValue = {
  language: DashboardVoiceLanguage;
  setLanguage: (language: DashboardVoiceLanguage) => void;
  preferences: SpeechPreferences;
  updatePreferences: (patch: Partial<SpeechPreferences>) => void;
  status: SpeechOutputStatus;
  error: string | null;
  activeRequestId: string | null;
  speak: (text: string, options?: SpeakOptions) => Promise<void>;
  speakAutomatically: (text: string, options?: SpeakOptions) => boolean;
  stop: () => void;
  pause: () => void;
  resume: () => Promise<void>;
};

const SpeechOutputContext = createContext<SpeechOutputContextValue | null>(null);

function getPreferencesSnapshot() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(SPEECH_PREFERENCES_STORAGE_KEY) ?? "";
}

function subscribeToPreferences(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const handleStorage = (event: StorageEvent) => {
    if (event.key === SPEECH_PREFERENCES_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function parsePreferences(raw: string) {
  if (!raw) return DEFAULT_SPEECH_PREFERENCES;
  try {
    return normalizeSpeechPreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_SPEECH_PREFERENCES;
  }
}

export function SpeechOutputProvider({ children }: { children: ReactNode }) {
  const language = useDashboardVoiceLanguage();
  const rawPreferences = useSyncExternalStore(subscribeToPreferences, getPreferencesSnapshot, () => "");
  const preferences = useMemo(() => parsePreferences(rawPreferences), [rawPreferences]);
  const [status, setStatus] = useState<SpeechOutputStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const generationRef = useRef(0);
  const requestRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const settlePlaybackRef = useRef<(() => void) | null>(null);

  const releaseTransport = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    settlePlaybackRef.current?.();
    settlePlaybackRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    generationRef.current += 1;
    releaseTransport();
    setActiveRequestId(null);
    setError(null);
    setStatus("idle");
  }, [releaseTransport]);

  const setLanguage = useCallback((nextLanguage: DashboardVoiceLanguage) => {
    stop();
    setDashboardVoiceLanguage(nextLanguage);
  }, [stop]);

  const updatePreferences = useCallback((patch: Partial<SpeechPreferences>) => {
    const next = normalizeSpeechPreferences({ ...preferences, ...patch });
    window.localStorage.setItem(SPEECH_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    if (audioRef.current) {
      audioRef.current.volume = next.volume;
      audioRef.current.playbackRate = next.playbackRate;
    }
  }, [preferences]);

  const playAudio = useCallback(async (blob: Blob, generation: number) => {
    const objectUrl = URL.createObjectURL(blob);
    objectUrlRef.current = objectUrl;
    const audio = new Audio(objectUrl);
    audio.volume = preferences.volume;
    audio.playbackRate = preferences.playbackRate;
    audioRef.current = audio;
    await new Promise<void>((resolve, reject) => {
      settlePlaybackRef.current = resolve;
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("De gegenereerde audio kon niet worden afgespeeld."));
      void audio.play().then(() => {
        if (generation === generationRef.current) setStatus("speaking");
      }).catch(reject);
    });
    settlePlaybackRef.current = null;
    if (audioRef.current === audio) audioRef.current = null;
    if (objectUrlRef.current === objectUrl) objectUrlRef.current = null;
    URL.revokeObjectURL(objectUrl);
  }, [preferences.playbackRate, preferences.volume]);

  const speak = useCallback(async (text: string, options: SpeakOptions = {}) => {
    const chunks = splitSpeechText(text);
    if (chunks.length === 0) return;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    releaseTransport();
    setError(null);
    setActiveRequestId(options.requestId ?? null);
    setStatus("understanding");

    try {
      for (const chunk of chunks) {
        if (generation !== generationRef.current) return;
        setStatus("understanding");
        const request = new AbortController();
        requestRef.current = request;
        const endpoint = process.env.NEXT_PUBLIC_SHAGGY_VOICE_URL || DEFAULT_ENDPOINT;
        const response = await fetch(`${endpoint}/synthesize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language, text: chunk }),
          signal: request.signal,
        });
        requestRef.current = null;
        if (!response.ok) throw new Error("Voice Companion is niet bereikbaar.");
        const blob = await response.blob();
        if (!blob.size || !blob.type.startsWith("audio/")) {
          throw new Error("Voice Companion gaf geen geldige audio terug.");
        }
        await playAudio(blob, generation);
      }
      if (generation === generationRef.current) {
        releaseTransport();
        setActiveRequestId(null);
        setStatus("idle");
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      if (generation !== generationRef.current) return;
      releaseTransport();
      setActiveRequestId(null);
      setError(cause instanceof Error ? cause.message : "Voice Companion is niet beschikbaar.");
      setStatus("error");
    }
  }, [language, playAudio, releaseTransport]);

  const speakAutomatically = useCallback((text: string, options: SpeakOptions = {}) => {
    if (!shouldAutoSpeak(language, text, preferences)) return false;
    void speak(text, options);
    return true;
  }, [language, preferences, speak]);

  const pause = useCallback(() => {
    if (!audioRef.current || status !== "speaking") return;
    audioRef.current.pause();
    setStatus("paused");
  }, [status]);

  const resume = useCallback(async () => {
    if (!audioRef.current || status !== "paused") return;
    await audioRef.current.play();
    setStatus("speaking");
  }, [status]);

  useEffect(() => releaseTransport, [releaseTransport]);

  const value = useMemo<SpeechOutputContextValue>(() => ({
    language,
    setLanguage,
    preferences,
    updatePreferences,
    status,
    error,
    activeRequestId,
    speak,
    speakAutomatically,
    stop,
    pause,
    resume,
  }), [activeRequestId, error, language, pause, preferences, resume, setLanguage, speak, speakAutomatically, status, stop, updatePreferences]);

  return <SpeechOutputContext.Provider value={value}>{children}</SpeechOutputContext.Provider>;
}

export function useSpeechOutput() {
  const context = useContext(SpeechOutputContext);
  if (!context) throw new Error("useSpeechOutput must be used inside SpeechOutputProvider");
  return context;
}
