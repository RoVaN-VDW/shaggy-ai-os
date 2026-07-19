export const DASHBOARD_VOICE_LANGUAGES = [
  { language: "nl-BE", label: "Nederlands", voice: "Vlaamse Butler" },
  { language: "en-GB", label: "English", voice: "Sentinel K" },
] as const;

export type DashboardVoiceLanguage = (typeof DASHBOARD_VOICE_LANGUAGES)[number]["language"];

export type DashboardVoiceFacts = {
  missionTitle: string;
  missionAvailable: boolean;
  projectCount: number | null;
  unreadSignals: number | null;
  healthyProviders: number | null;
  totalProviders: number | null;
};

export function normalizeDashboardVoiceLanguage(value: unknown): DashboardVoiceLanguage {
  return value === "en-GB" ? "en-GB" : "nl-BE";
}

function dutchCount(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function englishCount(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function buildDashboardVoiceBriefing(
  language: DashboardVoiceLanguage,
  facts: DashboardVoiceFacts,
): string {
  const mission = facts.missionAvailable ? facts.missionTitle : null;

  if (language === "en-GB") {
    const statements = [
      "Ronald, here is your briefing.",
      mission ? `Your active mission is ${mission}.` : "There is no active mission selected.",
      facts.projectCount === null ? null : `The dashboard is tracking ${englishCount(facts.projectCount, "project", "projects")}.`,
      facts.unreadSignals === null ? null : `There are ${englishCount(facts.unreadSignals, "unread signal", "unread signals")}.`,
      facts.healthyProviders === null || facts.totalProviders === null
        ? null
        : `${facts.healthyProviders} of ${facts.totalProviders} providers are healthy.`,
      "I am ready when you are.",
    ];
    return statements.filter((statement): statement is string => Boolean(statement)).join(" ");
  }

  const statements = [
    "Ronald, dit is je briefing.",
    mission ? `Je actieve missie is ${mission}.` : "Er is momenteel geen actieve missie geselecteerd.",
    facts.projectCount === null ? null : `Het dashboard volgt ${dutchCount(facts.projectCount, "project", "projecten")}.`,
    facts.unreadSignals === null ? null : `Er zijn ${dutchCount(facts.unreadSignals, "ongelezen signaal", "ongelezen signalen")}.`,
    facts.healthyProviders === null || facts.totalProviders === null
      ? null
      : `${facts.healthyProviders} van de ${facts.totalProviders} providers zijn gezond.`,
    "Ik sta klaar wanneer jij dat bent.",
  ];
  return statements.filter((statement): statement is string => Boolean(statement)).join(" ");
}
