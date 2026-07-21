import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  DASHBOARD_VOICE_LANGUAGES,
  buildDashboardVoiceBriefing,
  normalizeDashboardVoiceLanguage,
} from "../../src/features/voice/voice-contract.ts";

test("dashboard voice exposes exactly the selected Flemish and English identities", () => {
  assert.deepEqual(DASHBOARD_VOICE_LANGUAGES, [
    { language: "nl-BE", label: "Nederlands", voice: "Vlaamse Butler" },
    { language: "en-GB", label: "English", voice: "Sentinel K" },
  ]);
  assert.equal(normalizeDashboardVoiceLanguage("en-GB"), "en-GB");
  assert.equal(normalizeDashboardVoiceLanguage("nl-BE"), "nl-BE");
  assert.equal(normalizeDashboardVoiceLanguage("unsupported"), "nl-BE");
});

test("dashboard briefing localizes supplied facts without inventing unavailable metrics", () => {
  const facts = {
    missionTitle: "Voice Companion",
    missionAvailable: true,
    projectCount: 3,
    unreadSignals: 2,
    healthyProviders: 4,
    totalProviders: 5,
  };

  const dutch = buildDashboardVoiceBriefing("nl-BE", facts);
  assert.match(dutch, /Voice Companion/);
  assert.match(dutch, /3 projecten/);
  assert.match(dutch, /2 ongelezen signalen/);
  assert.match(dutch, /4 van de 5 providers/);

  const english = buildDashboardVoiceBriefing("en-GB", { ...facts, projectCount: null });
  assert.match(english, /Voice Companion/);
  assert.doesNotMatch(english, /project/);
  assert.match(english, /2 unread signals/);
});

test("dashboard renders persistent bilingual controls and permits only loopback voice connections", () => {
  const dashboard = readFileSync(new URL("../../src/features/command-center/components/DreamCommandCenter.tsx", import.meta.url), "utf8");
  const config = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");

  assert.match(dashboard, /DASHBOARD_VOICE_LANGUAGES\.map/);
  assert.match(dashboard, /aria-pressed=\{voice\.language === option\.language\}/);
  assert.match(dashboard, /voice\.speak\(voiceBriefing\)/);
  assert.match(dashboard, /voice\.status === "speaking" \? voice\.stop\(\)/);
  assert.match(config, /connect-src[^\n]+http:\/\/127\.0\.0\.1:8766 http:\/\/localhost:8766/);
  assert.match(config, /microphone=\(\)/);
});
