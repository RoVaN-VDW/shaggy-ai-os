import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  REALTIME_MODEL,
  REALTIME_VOICES,
  buildRealtimeSessionConfig,
  getRealtimeAvailability,
  normalizeRealtimeLanguage,
  normalizeRealtimeVoice,
} from "../../src/features/voice/realtime-contract.ts";
import {
  buildRealtimeSafetyIdentifier,
  classifyRealtimeUpstreamError,
  validateRealtimeSdp,
} from "../../src/features/voice/realtime-server-contract.ts";
import { normalizeRealtimeClientError } from "../../src/features/voice/realtime-client-contract.ts";

test("Realtime exposes only the approved Cedar and Marin audition voices", () => {
  assert.equal(REALTIME_MODEL, "gpt-realtime-2.1");
  assert.deepEqual(REALTIME_VOICES, [
    { id: "cedar", label: "Cedar", description: "Deep and controlled" },
    { id: "marin", label: "Marin", description: "Natural and conversational" },
  ]);
  assert.equal(normalizeRealtimeVoice("marin"), "marin");
  assert.equal(normalizeRealtimeVoice("alloy"), "cedar");
  assert.equal(normalizeRealtimeLanguage("en-GB"), "en-GB");
  assert.equal(normalizeRealtimeLanguage("unsupported"), "nl-BE");
});

test("Realtime remains fail-closed until both the feature flag and server key exist", () => {
  assert.deepEqual(getRealtimeAvailability({ enabled: false, hasApiKey: true }), {
    enabled: false,
    configured: true,
    available: false,
    reason: "disabled",
  });
  assert.deepEqual(getRealtimeAvailability({ enabled: true, hasApiKey: false }), {
    enabled: true,
    configured: false,
    available: false,
    reason: "missing_key",
  });
  assert.deepEqual(getRealtimeAvailability({ enabled: true, hasApiKey: true }), {
    enabled: true,
    configured: true,
    available: true,
    reason: null,
  });
});

test("the audition session disables VAD and cannot claim tools or autonomous actions", () => {
  const session = buildRealtimeSessionConfig({ voice: "marin", language: "nl-BE" });

  assert.equal(session.type, "realtime");
  assert.equal(session.model, "gpt-realtime-2.1");
  assert.equal(session.audio.output.voice, "marin");
  assert.equal(session.audio.input.turn_detection, null);
  assert.deepEqual(session.output_modalities, ["audio"]);
  assert.match(session.instructions, /Vlaams Nederlands/);
  assert.match(session.instructions, /voice audition/i);
  assert.match(session.instructions, /geen tools/i);
  assert.doesNotMatch(session.instructions, /API[_ -]?key/i);
});

test("the server accepts only a small valid audio SDP offer", () => {
  const offer = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=sendrecv\r\n";
  assert.equal(validateRealtimeSdp({ contentType: "application/sdp", contentLength: offer.length, body: offer }), null);
  assert.deepEqual(validateRealtimeSdp({ contentType: "application/json", contentLength: 2, body: "{}" }), {
    status: 415,
    error: "Expected application/sdp.",
  });
  assert.deepEqual(validateRealtimeSdp({ contentType: "application/sdp", contentLength: 40_000, body: offer }), {
    status: 413,
    error: "SDP offer is too large.",
  });
  assert.deepEqual(validateRealtimeSdp({ contentType: "application/sdp", contentLength: 7, body: "invalid" }), {
    status: 400,
    error: "Invalid SDP audio offer.",
  });
});

test("the OpenAI safety identifier is stable and does not expose the user id", () => {
  const userId = "0f91b03b-d71d-4c2a-b2ae-a9dd7d745e48";
  const identifier = buildRealtimeSafetyIdentifier(userId, "server-secret");
  assert.equal(identifier, buildRealtimeSafetyIdentifier(userId, "server-secret"));
  assert.match(identifier, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(identifier, new RegExp(userId));
  assert.notEqual(identifier, buildRealtimeSafetyIdentifier(userId, "different-secret"));
});

test("OpenAI Realtime errors are classified without exposing raw provider messages", () => {
  const quota = classifyRealtimeUpstreamError(429, JSON.stringify({
    error: { type: "insufficient_quota", code: "insufficient_quota", message: "sensitive provider detail" },
  }));
  assert.deepEqual(quota, {
    status: 429,
    category: "quota_or_billing",
    error: "OpenAI API billing or quota is unavailable.",
  });
  assert.doesNotMatch(JSON.stringify(quota), /sensitive provider detail/);

  assert.deepEqual(classifyRealtimeUpstreamError(429, "not-json"), {
    status: 429,
    category: "rate_limit",
    error: "OpenAI Realtime rate limit reached. Try again shortly.",
  });
  assert.deepEqual(classifyRealtimeUpstreamError(500, "not-json"), {
    status: 502,
    category: "provider_error",
    error: "GPT Live session could not be started.",
  });
});

test("microphone denial is explicit and never misreported as connected", () => {
  assert.equal(
    normalizeRealtimeClientError(new DOMException("Permission denied", "NotAllowedError")),
    "Microphone permission was denied.",
  );
  assert.equal(normalizeRealtimeClientError(new Error("Session failed.")), "Session failed.");
  assert.equal(normalizeRealtimeClientError(null), "GPT Live could not be started.");
});

test("Realtime API routes stay authenticated, fail-closed and keep the standard key server-side", async () => {
  const [statusRoute, sessionRoute] = await Promise.all([
    readFile(new URL("../../src/app/api/realtime/status/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/app/api/realtime/session/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(statusRoute, /requireAuth\(req\)/);
  assert.match(statusRoute, /getRealtimeAvailability/);
  assert.doesNotMatch(statusRoute, /OPENAI_API_KEY\s*[:,]/);

  assert.match(sessionRoute, /requireAuth\(req\)/);
  assert.match(sessionRoute, /rateLimit\(req, "realtime-session", 5\)/);
  assert.match(sessionRoute, /validateRealtimeSdp/);
  assert.match(sessionRoute, /buildRealtimeSafetyIdentifier/);
  assert.match(sessionRoute, /https:\/\/api\.openai\.com\/v1\/realtime\/calls/);
  assert.match(sessionRoute, /"OpenAI-Safety-Identifier"/);
  assert.match(sessionRoute, /"Content-Type": "application\/sdp"/);
  assert.doesNotMatch(sessionRoute, /console\.(?:log|info)\([^\n]*(?:body|sdp|apiKey)/i);
});

test("the WebRTC transport owns microphone lifecycle and implements official push-to-talk events", async () => {
  const transport = await readFile(new URL("../../src/features/voice/use-realtime-voice.ts", import.meta.url), "utf8");

  assert.match(transport, /getUserMedia/);
  assert.match(transport, /echoCancellation:\s*true/);
  assert.match(transport, /noiseSuppression:\s*true/);
  assert.match(transport, /track\.enabled = false/);
  assert.match(transport, /input_audio_buffer\.clear/);
  assert.match(transport, /response\.cancel/);
  assert.match(transport, /output_audio_buffer\.clear/);
  assert.match(transport, /input_audio_buffer\.commit/);
  assert.match(transport, /response\.create/);
  assert.match(transport, /talkingRef/);
  assert.match(transport, /const \[connected, setConnected\] = useState\(false\)/);
  assert.doesNotMatch(transport, /connected:\s*Boolean\([^\n]*Ref\.current/);
  assert.match(transport, /window\.setTimeout\(\(\) => void refreshAvailability\(\), 0\)/);
  assert.match(transport, /fetchWithAuth\(`\/api\/realtime\/session/);
  assert.match(transport, /MAX_SESSION_MS = 10 \* 60 \* 1000/);
  assert.match(transport, /getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
});

test("the Live audition UI discloses cloud audio, paid usage and never requests an always-on microphone", async () => {
  const [page, config, settings] = await Promise.all([
    readFile(new URL("../../src/app/live/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../next.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/app/settings/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /GPT Live Voice Audition/);
  assert.match(page, /Cedar/);
  assert.match(page, /Marin/);
  assert.match(page, /OpenAI/);
  assert.match(page, /paid API/i);
  assert.match(page, /not stored/i);
  assert.match(page, /Hold to talk/);
  assert.match(page, /Disconnect/);
  assert.doesNotMatch(page, /autoConnect/);
  assert.match(config, /source:\s*"\/live"[\s\S]*microphone=\(self\)/);
  assert.match(config, /microphone=\(\)/);
  assert.match(settings, /href="\/live"/);
});
