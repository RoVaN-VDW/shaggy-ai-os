# SHAGGY Voice Companion

Local loopback service for bilingual dashboard speech.

## Voice contract

| Dashboard language | Voice | Runtime | Data boundary |
|---|---|---|---|
| Nederlands (`nl-BE`) | Vlaamse Butler (`nl-BE-ArnaudNeural`) | Microsoft Edge speech + local mastering | The requested text is sent to Microsoft. |
| English (`en-GB`) | Sentinel K (`bm_fable,bm_lewis`) | Local MLX Kokoro 4-bit | Fully local after model download. |

No microphone access or speech input is enabled. The service binds only to `127.0.0.1`, accepts JSON requests from the exact local development origins on ports 3000 and 3001 plus any configured allowlist, limits text to 800 characters, and does not cache requested speech.

## Start

```bash
pnpm voice:companion
```

The dashboard connects to `http://127.0.0.1:8766` by default. Override at build time only when required:

```bash
NEXT_PUBLIC_SHAGGY_VOICE_URL=http://127.0.0.1:8766 pnpm dev
```

## Application integration

`SpeechOutputProvider` is the single browser audio owner for dashboard briefings and Chat Studio messages. It:

- splits long output into natural chunks capped at 720 characters;
- serializes playback so dashboard and chat audio cannot overlap;
- exposes pause, resume, stop and truthful entity states;
- persists language, volume, playback speed and auto-speak preferences locally;
- allows local English auto-speak by default;
- requires explicit Microsoft cloud consent before Dutch auto-speak;
- blocks high-confidence sensitive content from every automatic speech path.

Manual **Speak** remains an explicit user action. The UI labels Dutch as cloud and English as local before the request is made.

For a non-default dashboard origin, add an exact comma-separated allowlist:

```bash
SHAGGY_VOICE_ALLOWED_ORIGINS=https://dashboard.example pnpm voice:companion
```

## Verify

```bash
curl http://127.0.0.1:8766/health
```

Contract tests run the dependency-free mock mode and never call Microsoft or load MLX:

```bash
node --no-warnings --test tests/contracts/voice-companion.test.mjs
```
