"use client";

import Link from "next/link";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  Activity, ArrowRight, Bell, BookOpen, BrainCircuit, CheckCircle2, CircleDot,
  FolderKanban, Gauge, Languages, Network, Orbit, ShieldCheck, Sparkles, Square,
  Volume2, Zap,
} from "lucide-react";
import { useCockpitData } from "@/hooks/useCockpitData";
import type { CockpitResourceState } from "@/hooks/cockpit-resource-status";
import type { EntityState } from "@/features/entity/core/entity-state";
import { NeuralEntity } from "@/features/entity/components/NeuralEntity";
import {
  DASHBOARD_VOICE_LANGUAGES,
  buildDashboardVoiceBriefing,
} from "@/features/voice/voice-contract";
import { useDashboardVoice, type DashboardVoiceStatus } from "@/features/voice/use-dashboard-voice";
import {
  buildDreamDashboardModel,
  formatCountMetric,
  formatCurrencyMetric,
  formatIndexedSourceCount,
} from "../dashboard-model";
import { ActivityTrace } from "./visualization/ActivityTrace";
import { CommandPulse } from "./visualization/CommandPulse";
import { KnowledgeGraph } from "./visualization/KnowledgeGraph";
import { MissionHealthGauge } from "./visualization/MissionHealthGauge";
import { ProjectHealthBars } from "./visualization/ProjectHealthBars";
import { SecondBrainTwinSummary } from "./visualization/SecondBrainTwinSummary";
import { SystemUsageTrend } from "./visualization/SystemUsageTrend";

const ACTIVE_ENTITY_STATES: ReadonlySet<EntityState> = new Set([
  "listening",
  "understanding",
  "speaking",
]);

function SourceMeta({ resource }: { resource: CockpitResourceState }) {
  const freshness = resource.fetchedAt ? `${new Date(resource.fetchedAt).toISOString().slice(11, 16)}Z` : null;
  const details = `${resource.source} · ${freshness ?? "not fetched"}${resource.error ? ` · ${resource.error}` : ""}`;
  return <span className={`dream-source-meta dream-source-meta--${resource.status}`} title={details} aria-label={details}>{resource.status}{freshness ? ` · ${freshness}` : ""}</span>;
}

function PanelTitle({ icon: Icon, children, count, resource }: { icon: typeof Activity; children: React.ReactNode; count?: number | null; resource?: CockpitResourceState }) {
  return <div className="dream-panel-title"><span><Icon className="size-3.5" />{children}</span><span className="dream-panel-title__meta">{resource && <SourceMeta resource={resource} />}{typeof count === "number" && <b>{count}</b>}</span></div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="dream-empty"><CircleDot className="size-4" />{children}</div>;
}

function handleDashboardPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
  if (!(event.target instanceof Element)) return;
  const panel = event.target.closest<HTMLElement>(".dream-panel");
  if (!panel || !event.currentTarget.contains(panel)) return;
  const bounds = panel.getBoundingClientRect();
  panel.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
  panel.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
}

function handleDashboardPointerLeave(event: ReactPointerEvent<HTMLDivElement>) {
  for (const panel of event.currentTarget.querySelectorAll<HTMLElement>(".dream-panel")) {
    panel.style.removeProperty("--pointer-x");
    panel.style.removeProperty("--pointer-y");
  }
}

function resolveDashboardEntityState(hasError: boolean, loading: boolean, voiceStatus: DashboardVoiceStatus): EntityState {
  if (voiceStatus === "error") return "error";
  if (voiceStatus === "speaking") return "speaking";
  if (voiceStatus === "understanding") return "understanding";
  if (hasError) return "error";
  if (loading) return "understanding";
  return "idle";
}

function isEntityWaveActive(state: EntityState): boolean {
  return ACTIVE_ENTITY_STATES.has(state);
}

export function DreamCommandCenter() {
  const data = useCockpitData();
  const model = buildDreamDashboardModel(data);
  const voice = useDashboardVoice();
  const entityState = resolveDashboardEntityState(Boolean(data.error), data.loading, voice.status);
  const voiceBriefing = buildDashboardVoiceBriefing(voice.language, {
    missionTitle: model.mission.title,
    missionAvailable: model.mission.available,
    projectCount: model.projectCount,
    unreadSignals: model.insights.unread,
    healthyProviders: model.health.healthy,
    totalProviders: model.health.total,
  });

  return (
    <div
      className="dream-dashboard"
      aria-busy={data.loading}
      onPointerMove={handleDashboardPointerMove}
      onPointerLeave={handleDashboardPointerLeave}
    >
      <section className="dream-panel dream-mission" data-dream-region="todays-mission" aria-labelledby="mission-title">
        <PanelTitle icon={Sparkles} resource={data.resources.projects}>Today’s Mission</PanelTitle>
        <div className="dream-mission__body">
          <div className="dream-kicker">{model.mission.available ? model.mission.status : "Awaiting direction"}</div>
          <h1 id="mission-title">{model.mission.title}</h1>
          <p>{model.mission.description}</p>
          <div className="dream-mission__health">
            <MissionHealthGauge value={model.mission.health} sourceStatus={model.mission.sourceStatus} />
            <div className="dream-mission__facts">
              <span><FolderKanban />{formatCountMetric(model.projectCount)} projects</span>
              <span><ShieldCheck />{formatCountMetric(model.reviewCount)} approvals</span>
            </div>
          </div>
        </div>
        <Link className="dream-primary-action" href="/projects">Open mission control <ArrowRight /></Link>
      </section>

      <section className="dream-entity" data-dream-region="neural-entity-stage" aria-label="SHAGGY neural entity stage">
        <NeuralEntity state={entityState} />
        <div className="dream-voice-controls" aria-label="SHAGGY dashboard voice controls">
          <div className="dream-voice-language" role="group" aria-label="Spraaktaal">
            <Languages aria-hidden="true" />
            {DASHBOARD_VOICE_LANGUAGES.map((option) => (
              <button
                key={option.language}
                type="button"
                aria-pressed={voice.language === option.language}
                title={`${option.label} · ${option.voice}`}
                onClick={() => voice.setLanguage(option.language)}
              >
                {option.language === "nl-BE" ? "NL" : "EN"}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="dream-voice-action"
            disabled={voice.status === "understanding"}
            onClick={() => voice.status === "speaking" ? voice.stop() : void voice.speak(voiceBriefing)}
          >
            {voice.status === "speaking" ? <Square aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
            {voice.status === "understanding" ? "Preparing…" : voice.status === "speaking" ? "Stop" : "Speak briefing"}
          </button>
        </div>
        {voice.error && <div className="dream-voice-error" role="alert">{voice.error}</div>}
        <div className="dream-entity__label"><span className={`dream-state-dot dream-state-dot--${entityState}`} />S.H.A.G.G.Y. · {entityState}</div>
        <div className="dream-entity__wave" data-active={isEntityWaveActive(entityState)} aria-hidden="true">{Array.from({ length: 38 }, (_, index) => <i key={index} style={{ height: `${6 + ((index * 13) % 22)}px`, animationDelay: `${index * -38}ms` }} />)}</div>
      </section>

      <section className="dream-panel dream-briefing" data-dream-region="intelligence-briefing" aria-labelledby="briefing-title">
        <PanelTitle icon={BrainCircuit} count={model.insights.unread} resource={data.resources.notifications}><span id="briefing-title">Intelligence Briefing</span></PanelTitle>
        <div className="dream-list">
          {model.briefing.length === 0 ? <Empty>{model.briefingSourceStatus === "live" || model.briefingSourceStatus === "stale" ? "No briefing signals available." : `Briefing source ${model.briefingSourceStatus}.`}</Empty> : model.briefing.map((item) => (
            <button key={item.id} type="button" className="dream-list-item" onClick={() => !item.read && void data.markNotificationRead(item.id)}>
              <span className={`dream-list-dot dream-list-dot--${item.level}`} />
              <span><b>{item.title}</b><small>{item.message}</small><em>Notifications · {new Date(item.created_at).toLocaleDateString()}</em></span>
            </button>
          ))}
        </div>
        <Link className="dream-text-link" href="/artifacts">View intelligence <ArrowRight /></Link>
      </section>

      <section className="dream-panel dream-activity" data-dream-region="live-activity" aria-labelledby="activity-title">
        <PanelTitle icon={Activity} count={model.activitySourceStatus === "live" || model.activitySourceStatus === "stale" ? model.activity.length : null} resource={data.resources.agentActivity}><span id="activity-title">Live Activity</span></PanelTitle>
        <ActivityTrace events={model.activityTrace} sourceStatus={model.activitySourceStatus} />
      </section>

      <nav className="dream-dock" data-dream-region="cognitive-dock" aria-label="Cognitive spaces">
        {model.cognitiveSpaces.map((space, index) => <Link key={space.label} href={space.href} className={index === 0 ? "active" : ""}><span>{[Orbit, BookOpen, Sparkles, Zap, Gauge, Network].map((Icon, iconIndex) => iconIndex === index ? <Icon key={space.label} /> : null)}</span><b>{space.label}</b><small className="dream-dock__meta">{space.meta}</small></Link>)}
      </nav>

      <section className="dream-panel dream-knowledge" data-dream-region="knowledge-map">
        <PanelTitle icon={BookOpen} count={model.knowledgeCount} resource={data.resources.knowledgeDocs}>Knowledge Map</PanelTitle>
        <KnowledgeGraph graph={model.knowledgeGraph} sourceStatus={model.knowledgeSourceStatus} />
        <p>{formatIndexedSourceCount(model.knowledgeCount)}</p>
        <Link className="dream-text-link" href="/knowledge">Index more sources <ArrowRight /></Link>
      </section>

      <section className="dream-panel dream-portfolio" data-dream-region="project-portfolio">
        <PanelTitle icon={FolderKanban} count={model.projectCount} resource={data.resources.projects}>Project Portfolio</PanelTitle>
        <ProjectHealthBars bars={model.projectHealthBars} sourceStatus={model.portfolioSourceStatus} />
        <Link className="dream-text-link" href="/projects">View portfolio <ArrowRight /></Link>
      </section>

      <section className="dream-panel dream-twin" data-dream-region="digital-twin">
        <PanelTitle icon={Network}>Digital Twin · Second Brain</PanelTitle>
        <SecondBrainTwinSummary />
        <Link className="dream-text-link" href="/twin">Inspect twin <ArrowRight /></Link>
      </section>

      <section className="dream-panel dream-insights" data-dream-region="system-insights">
        <PanelTitle icon={Gauge} resource={data.resources.dailyUsage}>System Insights</PanelTitle>
        <SystemUsageTrend data={model.usageTrend} resource={data.resources.dailyUsage} />
        <div className="dream-insight-grid">
          <div><Activity /><span><b>{formatCountMetric(model.insights.events)}</b><small>Usage events · {model.insights.sourceStatus}</small></span></div>
          <div><Gauge /><span><b>{formatCurrencyMetric(model.insights.spend)}</b><small>Recorded spend · {model.insights.sourceStatus}</small></span></div>
          <div><Bell /><span><b>{formatCountMetric(model.insights.unread)}</b><small>Unread signals · {model.insights.notificationStatus}</small></span></div>
          <div><CheckCircle2 /><span><b>{model.health.healthy === null || model.health.total === null ? "Unavailable" : `${model.health.healthy}/${model.health.total}`}</b><small>Healthy providers · {model.health.sourceStatus}</small></span></div>
        </div>
        {data.error && <div className="dream-error" role="alert">Live data partially unavailable: {data.error}</div>}
        <Link className="dream-text-link" href="/artifacts">Explore insights <ArrowRight /></Link>
      </section>
      <CommandPulse eventKey={model.activityTrace[0]?.id ?? null} tone={model.activityTrace[0]?.tone} />
    </div>
  );
}