"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { Cloud, Languages, Mic, MicOff, Radio, ShieldCheck, Square, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSpeechOutput } from "@/features/voice/speech-output-provider";
import {
  REALTIME_VOICES,
  type RealtimeLanguage,
  type RealtimeVoice,
} from "@/features/voice/realtime-contract";
import { useRealtimeVoice } from "@/features/voice/use-realtime-voice";

const STATUS_LABELS = {
  checking: "Checking availability",
  disabled: "Unavailable",
  idle: "Ready",
  connecting: "Connecting",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  error: "Attention required",
} as const;

export default function LiveVoicePage() {
  const speech = useSpeechOutput();
  const [voice, setVoice] = useState<RealtimeVoice>("cedar");
  const [language, setLanguage] = useState<RealtimeLanguage>("nl-BE");
  const live = useRealtimeVoice({ voice, language, onBeforeConnect: speech.stop });
  const controlsLocked = live.connected || live.status === "connecting";
  const canTalk = live.connected && live.status !== "connecting";

  function startPointerTalk(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    live.beginTalking();
  }

  function stopPointerTalk(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    live.endTalking();
  }

  function startKeyboardTalk(event: KeyboardEvent<HTMLButtonElement>) {
    if ((event.key === " " || event.key === "Enter") && !event.repeat) {
      event.preventDefault();
      live.beginTalking();
    }
  }

  function stopKeyboardTalk(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      live.endTalking();
    }
  }

  return (
    <main className="h-full overflow-auto pr-1">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-5 pb-6">
        <header className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">Restricted P0 · Cloud Live</p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">GPT Live Voice Audition</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Compare Cedar and Marin in a push-to-talk session before GPT Live is allowed to become SHAGGY&apos;s communication layer.
            </p>
          </div>
          <div className="rounded-full border border-border bg-card/70 px-3 py-2 text-xs text-muted-foreground" aria-live="polite">
            <span className={`mr-2 inline-block size-2 rounded-full ${live.status === "error" || live.status === "disabled" ? "bg-amber-300" : live.connected ? "bg-emerald-400" : "bg-muted-foreground"}`} />
            {STATUS_LABELS[live.status]}
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
          <Card className="border-border bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-foreground">
                <Radio className="size-4 text-primary" /> Voice and language
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <fieldset disabled={controlsLocked}>
                <legend className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">OpenAI voice</legend>
                <div className="grid grid-cols-2 gap-3">
                  {REALTIME_VOICES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={voice === option.id}
                      onClick={() => setVoice(option.id)}
                      className={`rounded-xl border p-4 text-left transition-colors ${voice === option.id ? "border-primary/60 bg-primary/10" : "border-border bg-background/40 hover:border-primary/30"}`}
                    >
                      <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset disabled={controlsLocked}>
                <legend className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  <Languages className="size-3.5" /> Language
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" aria-pressed={language === "nl-BE"} onClick={() => setLanguage("nl-BE")} className={`rounded-xl border px-4 py-3 text-left text-sm ${language === "nl-BE" ? "border-primary/60 bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}>NL · Vlaams</button>
                  <button type="button" aria-pressed={language === "en-GB"} onClick={() => setLanguage("en-GB")} className={`rounded-xl border px-4 py-3 text-left text-sm ${language === "en-GB" ? "border-primary/60 bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}>EN · British</button>
                </div>
              </fieldset>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-foreground">
                <ShieldCheck className="size-4 text-emerald-400" /> Session boundary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs leading-5 text-muted-foreground">
              <Boundary icon={<Mic className="size-3.5" />} text="The microphone starts only after Connect and stays muted until Hold to talk." />
              <Boundary icon={<Cloud className="size-3.5" />} text="Your live audio is sent to OpenAI for this cloud session." />
              <Boundary icon={<ShieldCheck className="size-3.5" />} text="Audio and transcripts are not stored by SHAGGY in this P0 audition." />
              <Boundary icon={<Volume2 className="size-3.5" />} text="This uses the paid API. Sessions automatically disconnect after 10 minutes." />
              <p className="rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-3 text-amber-100/80">
                This is an AI-generated voice audition. GPT Live has no SHAGGY tools, model router or permission to perform actions in this phase.
              </p>
            </CardContent>
          </Card>
        </section>

        <Card className="flex-1 border-border bg-[radial-gradient(circle_at_50%_35%,rgba(0,212,255,.10),transparent_38%),rgba(8,12,20,.82)]">
          <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-6 p-8 text-center">
            <div className={`grid size-28 place-items-center rounded-full border transition-all ${live.status === "listening" ? "scale-105 border-emerald-400/70 bg-emerald-400/10 shadow-[0_0_60px_rgba(52,211,153,.20)]" : live.status === "speaking" ? "border-primary/70 bg-primary/10 shadow-[0_0_60px_rgba(0,212,255,.22)]" : "border-border bg-background/50"}`}>
              {live.status === "listening" ? <Mic className="size-9 text-emerald-400" /> : live.connected ? <Volume2 className="size-9 text-primary" /> : <MicOff className="size-9 text-muted-foreground" />}
            </div>

            <div>
              <p className="text-lg font-semibold text-foreground">{STATUS_LABELS[live.status]}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {live.connected ? `${voice === "cedar" ? "Cedar" : "Marin"} · ${language}` : "No microphone or cloud session is active."}
              </p>
            </div>

            {live.error && <p role="alert" className="max-w-xl rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{live.error}</p>}

            <div className="flex flex-wrap items-center justify-center gap-3">
              {!live.connected ? (
                <Button onClick={() => void live.connect()} disabled={!live.availability?.available || live.status === "connecting"} className="min-w-36">
                  <Mic className="size-4" /> {live.status === "connecting" ? "Connecting…" : "Connect"}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    disabled={!canTalk}
                    className="min-w-44 select-none touch-none"
                    onPointerDown={startPointerTalk}
                    onPointerUp={stopPointerTalk}
                    onPointerCancel={stopPointerTalk}
                    onKeyDown={startKeyboardTalk}
                    onKeyUp={stopKeyboardTalk}
                  >
                    <Mic className="size-4" /> Hold to talk
                  </Button>
                  {(live.status === "speaking" || live.status === "thinking") && <Button type="button" variant="outline" onClick={live.stopResponse}><Square className="size-3.5" /> Stop response</Button>}
                  <Button type="button" variant="outline" onClick={live.disconnect}>Disconnect</Button>
                </>
              )}
            </div>

            {!live.availability?.available && live.status !== "checking" && (
              <p className="max-w-lg text-xs leading-5 text-muted-foreground">
                {live.availability?.reason === "missing_key"
                  ? "The server has no OpenAI API credential. Configure it locally before auditioning."
                  : "The SHAGGY_REALTIME_ENABLED server flag is off. GPT Live remains fail-closed."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Boundary({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex gap-2.5 rounded-xl border border-border bg-background/35 p-3"><span className="mt-0.5 text-primary">{icon}</span><span>{text}</span></div>;
}
