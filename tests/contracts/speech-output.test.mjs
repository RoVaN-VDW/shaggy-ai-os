import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  DEFAULT_SPEECH_PREFERENCES,
  containsSensitiveSpeechContent,
  shouldAutoSpeak,
  splitSpeechText,
} from "../../src/features/voice/speech-output-contract.ts";

test("speech chunking preserves all text in natural bounded segments", () => {
  const text = `${"Een natuurlijke Vlaamse zin. ".repeat(34)}Dit is de afsluiting.`.trim();
  const chunks = splitSpeechText(text, 240);
  assert.ok(chunks.length > 2);
  assert.ok(chunks.every((chunk) => chunk.length <= 240));
  assert.equal(chunks.join(" ").replaceAll(/\s+/g, " "), text.replaceAll(/\s+/g, " "));
});

test("speech chunking hard-splits an unbroken token without exceeding the companion limit", () => {
  const chunks = splitSpeechText("x".repeat(1701), 700);
  assert.deepEqual(chunks.map((chunk) => chunk.length), [700, 700, 301]);
});

test("sensitive output is detected before automatic cloud speech", () => {
  assert.equal(containsSensitiveSpeechContent("API key: [redacted]"), true);
  assert.equal(containsSensitiveSpeechContent("Mail mij via ronald@example.com"), true);
  assert.equal(containsSensitiveSpeechContent("De systemen zijn stabiel."), false);
});

test("English can auto-speak locally while Dutch requires explicit cloud consent", () => {
  assert.equal(shouldAutoSpeak("en-GB", "All systems are ready.", DEFAULT_SPEECH_PREFERENCES), true);
  assert.equal(shouldAutoSpeak("nl-BE", "Alle systemen zijn klaar.", DEFAULT_SPEECH_PREFERENCES), false);
  assert.equal(shouldAutoSpeak("nl-BE", "Alle systemen zijn klaar.", {
    ...DEFAULT_SPEECH_PREFERENCES,
    dutchCloudConsent: true,
    autoSpeakDutch: true,
  }), true);
  assert.equal(shouldAutoSpeak("nl-BE", "Token: sensitive-value", {
    ...DEFAULT_SPEECH_PREFERENCES,
    dutchCloudConsent: true,
    autoSpeakDutch: true,
  }), false);
});

test("shell, chat and settings share one privacy-gated speech controller", async () => {
  const [shell, chat, settings, provider] = await Promise.all([
    readFile(new URL("../../src/components/shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/app/chat/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/app/settings/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/features/voice/speech-output-provider.tsx", import.meta.url), "utf8"),
  ]);
  assert.ok(shell.indexOf("<AuthGate>") < shell.indexOf("<SpeechOutputProvider>"));
  assert.match(chat, /speech\.speakAutomatically\(data\.output/);
  assert.match(chat, /speech\.speak\(message\.content/);
  assert.match(settings, /dutchCloudConsent/);
  assert.match(settings, /autoSpeakDutch/);
  assert.match(provider, /splitSpeechText\(text\)/);
  assert.match(provider, /activeRequestId/);
});
