"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchWithAuth } from "@/lib/supabase/client";
import type { RealtimeLanguage, RealtimeVoice } from "./realtime-contract";
import { normalizeRealtimeClientError } from "./realtime-client-contract";

export const MAX_SESSION_MS = 10 * 60 * 1000;

type RealtimeTransportStatus =
  | "checking"
  | "disabled"
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

type Availability = {
  enabled: boolean;
  configured: boolean;
  available: boolean;
  reason: "disabled" | "missing_key" | null;
  model: string;
  mode: "push_to_talk";
  storesAudio: false;
  routesTools: false;
};

type RealtimeServerEvent = {
  type?: string;
  error?: { message?: string };
};

function waitForDataChannel(channel: RTCDataChannel, timeoutMs = 10_000) {
  if (channel.readyState === "open") return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("GPT Live control channel timed out.")), timeoutMs);
    channel.addEventListener("open", () => {
      window.clearTimeout(timeout);
      resolve();
    }, { once: true });
    channel.addEventListener("error", () => {
      window.clearTimeout(timeout);
      reject(new Error("GPT Live control channel failed."));
    }, { once: true });
  });
}

export function useRealtimeVoice({
  voice,
  language,
  onBeforeConnect,
}: {
  voice: RealtimeVoice;
  language: RealtimeLanguage;
  onBeforeConnect?: () => void;
}) {
  const [status, setStatus] = useState<RealtimeTransportStatus>("checking");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionTimerRef = useRef<number | null>(null);
  const talkingRef = useRef(false);

  const releaseTransport = useCallback(() => {
    talkingRef.current = false;
    setConnected(false);
    if (sessionTimerRef.current !== null) {
      window.clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    channelRef.current?.close();
    channelRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
      audioRef.current.remove();
      audioRef.current = null;
    }
  }, []);

  const refreshAvailability = useCallback(async () => {
    try {
      const response = await fetchWithAuth("/api/realtime/status", { cache: "no-store" });
      const payload = await response.json() as Availability & { error?: string };
      if (!response.ok) throw new Error(payload.error || "GPT Live status is unavailable.");
      setAvailability(payload);
      setStatus(payload.available ? "idle" : "disabled");
      return payload;
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "GPT Live status is unavailable.");
      return null;
    }
  }, []);

  const sendEvent = useCallback((type: string) => {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open") return false;
    channel.send(JSON.stringify({ type }));
    return true;
  }, []);

  const disconnect = useCallback(() => {
    releaseTransport();
    setError(null);
    setStatus(availability?.available ? "idle" : "disabled");
  }, [availability?.available, releaseTransport]);

  const handleServerEvent = useCallback((event: MessageEvent<string>) => {
    let payload: RealtimeServerEvent;
    try {
      payload = JSON.parse(event.data) as RealtimeServerEvent;
    } catch {
      return;
    }

    switch (payload.type) {
      case "session.created":
      case "session.updated":
        setStatus("idle");
        break;
      case "input_audio_buffer.committed":
      case "response.created":
        setStatus("thinking");
        break;
      case "response.output_audio.delta":
      case "output_audio_buffer.started":
        setStatus("speaking");
        break;
      case "response.output_audio.done":
      case "output_audio_buffer.stopped":
      case "response.done":
        setStatus("idle");
        break;
      case "error":
        setError(payload.error?.message || "GPT Live returned an error.");
        setStatus("error");
        break;
    }
  }, []);

  const connect = useCallback(async () => {
    if (peerRef.current || status === "connecting") return;
    setError(null);
    setStatus("connecting");

    try {
      const currentAvailability = availability ?? await refreshAvailability();
      if (!currentAvailability?.available) {
        throw new Error(currentAvailability?.reason === "missing_key"
          ? "GPT Live has no server credential configured."
          : "GPT Live is disabled.");
      }
      if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
        throw new Error("This browser does not support secure WebRTC microphone sessions.");
      }

      onBeforeConnect?.();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      streamRef.current = stream;
      const [track] = stream.getAudioTracks();
      if (!track) throw new Error("No microphone audio track is available.");
      track.enabled = false;

      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      peer.addTrack(track, stream);

      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.setAttribute("playsinline", "");
      audio.onplaying = () => setStatus("speaking");
      audioRef.current = audio;
      peer.ontrack = (event) => {
        audio.srcObject = event.streams[0];
        void audio.play().catch(() => {
          setError("Browser audio playback is blocked. Click Connect again.");
          setStatus("error");
        });
      };

      const channel = peer.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.addEventListener("message", handleServerEvent);
      channel.addEventListener("close", () => {
        if (peerRef.current === peer) disconnect();
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      if (!offer.sdp) throw new Error("Browser could not create an audio session offer.");

      const response = await fetchWithAuth(`/api/realtime/session?voice=${voice}&language=${language}`, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || "GPT Live session could not be started.");
      }
      const answerSdp = await response.text();
      await peer.setRemoteDescription({ type: "answer", sdp: answerSdp });
      await waitForDataChannel(channel);

      setConnected(true);
      setStatus("idle");
      sessionTimerRef.current = window.setTimeout(() => disconnect(), MAX_SESSION_MS);
    } catch (cause) {
      releaseTransport();
      setError(normalizeRealtimeClientError(cause));
      setStatus("error");
    }
  }, [availability, disconnect, handleServerEvent, language, onBeforeConnect, refreshAvailability, releaseTransport, status, voice]);

  const beginTalking = useCallback(() => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track || talkingRef.current || channelRef.current?.readyState !== "open") return;
    sendEvent("input_audio_buffer.clear");
    sendEvent("response.cancel");
    sendEvent("output_audio_buffer.clear");
    track.enabled = true;
    talkingRef.current = true;
    setError(null);
    setStatus("listening");
  }, [sendEvent]);

  const endTalking = useCallback(() => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track || !talkingRef.current) return;
    track.enabled = false;
    talkingRef.current = false;
    sendEvent("input_audio_buffer.commit");
    sendEvent("response.create");
    setStatus("thinking");
  }, [sendEvent]);

  const stopResponse = useCallback(() => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) track.enabled = false;
    talkingRef.current = false;
    sendEvent("response.cancel");
    sendEvent("output_audio_buffer.clear");
    setStatus("idle");
  }, [sendEvent]);

  useEffect(() => {
    const initialStatusTimer = window.setTimeout(() => void refreshAvailability(), 0);
    return () => {
      window.clearTimeout(initialStatusTimer);
      releaseTransport();
    };
  }, [refreshAvailability, releaseTransport]);

  return {
    status,
    availability,
    error,
    connected,
    connect,
    disconnect,
    beginTalking,
    endTalking,
    stopResponse,
    refreshAvailability,
  };
}
