"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, Check, Cloud, Database, HardDrive, KeyRound, Radio, Settings, Shield, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSpeechOutput } from "@/features/voice/speech-output-provider";
import { CAPABILITY_REGISTRY, resolveCapabilityTruth } from "@/lib/capabilities/registry";

const STORAGE_KEY = "shaggy.preferences";

type Preferences = {
  manualMode: boolean;
  approvalGate: boolean;
  budgetAlerts: boolean;
  reviewNotifications: boolean;
};

const defaults: Preferences = {
  manualMode: true,
  approvalGate: true,
  budgetAlerts: true,
  reviewNotifications: false,
};

export default function SettingsPage() {
  const speech = useSpeechOutput();
  const [localPreferences, setLocalPreferences] = useState<{ preferences: Preferences; observedAt: string | null }>(() => {
    if (typeof window === "undefined") return { preferences: defaults, observedAt: null };
    const observedAt = new Date().toISOString();
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { preferences: defaults, observedAt };
    try {
      return {
        preferences: { ...defaults, ...(JSON.parse(stored) as Partial<Preferences>) },
        observedAt,
      };
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      return { preferences: defaults, observedAt };
    }
  });
  const [saved, setSaved] = useState(false);
  const { preferences, observedAt } = localPreferences;

  const settingsTruth = resolveCapabilityTruth(CAPABILITY_REGISTRY.settings, {
    configured: true,
    observedAt,
  });

  function update(key: keyof Preferences, value: boolean) {
    setLocalPreferences((current) => ({
      ...current,
      preferences: { ...current.preferences, [key]: value },
    }));
    setSaved(false);
  }

  function save() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    setLocalPreferences((current) => ({ ...current, observedAt: new Date().toISOString() }));
    setSaved(true);
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-4">
      <div className="shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="size-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
        </div>
        <span className="text-xs text-muted-foreground" title={observedAt ?? "Local storage not observed yet"}>
          {settingsTruth.status} · {settingsTruth.source} · preferences stay on this device
        </span>
      </div>

      <div data-settings-scroll-region className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2">
        <div className="grid grid-cols-2 gap-4 pb-4">
        <PreferenceCard title="Safety" icon={<Shield className="size-4 text-emerald-400" />}>
          <Preference label="Manual Mode" detail="Keep autonomous actions disabled." checked={preferences.manualMode} onChange={(value) => update("manualMode", value)} />
          <Preference label="External approval gate" detail="Require review before side effects." checked={preferences.approvalGate} onChange={(value) => update("approvalGate", value)} />
        </PreferenceCard>

        <PreferenceCard title="Notifications" icon={<Bell className="size-4 text-amber-300" />}>
          <Preference label="Budget alerts" detail="Surface provider spend thresholds." checked={preferences.budgetAlerts} onChange={(value) => update("budgetAlerts", value)} />
          <Preference label="Review queue updates" detail="Show changes to pending approvals." checked={preferences.reviewNotifications} onChange={(value) => update("reviewNotifications", value)} />
        </PreferenceCard>

        <Card className="col-span-2 border-border bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Volume2 className="size-4 text-primary" /> Speech output
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-foreground">SHAGGY voice</Label>
                <p className="mt-1 text-xs text-muted-foreground">The selected voice applies to dashboard briefings, chat answers and message playback.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={speech.language === "nl-BE" ? "default" : "outline"} className="justify-start gap-2" onClick={() => speech.setLanguage("nl-BE")}>
                  <Cloud className="size-4" /> NL · Vlaamse Butler
                </Button>
                <Button type="button" variant={speech.language === "en-GB" ? "default" : "outline"} className="justify-start gap-2" onClick={() => speech.setLanguage("en-GB")}>
                  <HardDrive className="size-4" /> EN · Sentinel K
                </Button>
              </div>
              <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-3 text-xs leading-5 text-muted-foreground">
                Dutch synthesis sends only the text you choose to speak to Microsoft. English Sentinel K synthesis stays on this Mac.
              </div>
            </div>
            <div className="space-y-5">
              <Preference label="Auto-speak English answers" detail="Uses local Sentinel K. Sensitive output remains blocked." checked={speech.preferences.autoSpeakEnglish} onChange={(value) => speech.updatePreferences({ autoSpeakEnglish: value })} />
              <Preference label="Allow Dutch cloud speech" detail="Explicit consent to send spoken Dutch text to Microsoft TTS." checked={speech.preferences.dutchCloudConsent} onChange={(value) => speech.updatePreferences({ dutchCloudConsent: value, ...(!value ? { autoSpeakDutch: false } : {}) })} />
              <Preference label="Auto-speak Dutch answers" detail="Only available after cloud consent; sensitive output remains blocked." checked={speech.preferences.autoSpeakDutch} disabled={!speech.preferences.dutchCloudConsent} onChange={(value) => speech.updatePreferences({ autoSpeakDutch: value })} />
              <RangePreference label="Volume" value={speech.preferences.volume} minimum={0} maximum={1} step={0.05} onChange={(volume) => speech.updatePreferences({ volume })} />
              <RangePreference label="Playback speed" value={speech.preferences.playbackRate} minimum={0.8} maximum={1.2} step={0.05} onChange={(playbackRate) => speech.updatePreferences({ playbackRate })} />
              <p className="text-[11px] text-muted-foreground">Voice changes are saved immediately on this device.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 border-border bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Radio className="size-4 text-primary" /> GPT Live
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-5">
            <div>
              <p className="text-sm font-medium text-foreground">Restricted voice audition</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Compare Cedar and Marin with explicit push-to-talk. No SHAGGY tools or autonomous actions are connected.</p>
            </div>
            <Link href="/live" className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
              Open audition
            </Link>
          </CardContent>
        </Card>

        <Card className="col-span-2 border-border bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <KeyRound className="size-4 text-primary" /> Connections
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Connection icon={<Database className="size-4" />} label="Data runtime" value="This Mac · loopback only" state="Local" />
            <Connection icon={<Shield className="size-4" />} label="Provider credentials" value="Managed outside the browser" state="Not exposed" />
            <p className="col-span-2 text-xs leading-5 text-muted-foreground">
              SHAGGY data stays in local server-owned stores. Secret API keys are never displayed or edited in the browser.
            </p>
          </CardContent>
        </Card>
        </div>
      </div>

      <div data-settings-actions className="shrink-0 flex items-center justify-end gap-3">
        {saved && <span className="flex items-center gap-1 text-xs text-emerald-400"><Check className="size-3" /> Saved locally</span>}
        <Button onClick={save}>Save preferences</Button>
      </div>
    </div>
  );
}

function PreferenceCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="border-border bg-card/80 backdrop-blur">
      <CardHeader><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{title}</CardTitle></CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}

function Preference({ label, detail, checked, disabled = false, onChange }: { label: string; detail: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div><Label className="text-sm text-foreground">{label}</Label><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

function RangePreference({ label, value, minimum, maximum, step, onChange }: { label: string; value: number; minimum: number; maximum: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-sm text-foreground"><span>{label}</span><span className="text-xs text-muted-foreground">{Math.round(value * 100)}%</span></span>
      <input className="mt-2 w-full accent-primary" type="range" min={minimum} max={maximum} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function Connection({ icon, label, value, state }: { icon: React.ReactNode; label: string; value: string; state: string }) {
  const stateTone = state === "Missing" ? "text-destructive" : state === "Configured" ? "text-emerald-400" : "text-muted-foreground";
  return (
    <div className="rounded-xl border border-border bg-background/50 p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span className="flex items-center gap-2">{icon}{label}</span><span className={stateTone}>{state}</span></div>
      <p className="mt-3 truncate text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
