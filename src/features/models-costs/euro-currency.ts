import type { UsageLedgerEvent, UsageProvider } from "./usage-summary";

const ECB_USD_EUR_URL = "https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?format=csvdata&lastNObservations=1";
const CACHE_MS = 12 * 60 * 60 * 1000;

export type EuroCurrency = {
  code: "EUR";
  sourceCurrency: "USD";
  usdToEurRate: number;
  source: "ECB";
  asOf: string;
};

let cachedFx: { value: EuroCurrency; fetchedAt: number } | null = null;

function round(value: number, precision = 10) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function parseEcbUsdEurCsv(csv: string): EuroCurrency {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("ECB exchange-rate response is empty.");
  const headers = lines[0].split(",").map((value) => value.replace(/^"|"$/g, ""));
  const values = lines.at(-1)?.split(",").map((value) => value.replace(/^"|"$/g, "")) ?? [];
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  const usdPerEur = Number(row.OBS_VALUE);
  if (row.CURRENCY !== "USD" || row.CURRENCY_DENOM !== "EUR" || !Number.isFinite(usdPerEur) || usdPerEur <= 0) {
    throw new Error("ECB USD/EUR exchange-rate response is invalid.");
  }
  return {
    code: "EUR",
    sourceCurrency: "USD",
    usdToEurRate: round(1 / usdPerEur),
    source: "ECB",
    asOf: row.TIME_PERIOD,
  };
}

export async function getEcbUsdToEurRate(): Promise<EuroCurrency> {
  if (cachedFx && Date.now() - cachedFx.fetchedAt < CACHE_MS) return cachedFx.value;
  try {
    const response = await fetch(ECB_USD_EUR_URL, {
      headers: { Accept: "text/csv" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`ECB exchange-rate request failed (${response.status}).`);
    const value = parseEcbUsdEurCsv(await response.text());
    cachedFx = { value, fetchedAt: Date.now() };
    return value;
  } catch (error) {
    if (cachedFx) return cachedFx.value;
    throw error;
  }
}

export function convertUsageInputsToEuro({
  events,
  providers,
  usdToEurRate,
}: {
  events: UsageLedgerEvent[];
  providers: UsageProvider[];
  usdToEurRate: number;
}) {
  if (!Number.isFinite(usdToEurRate) || usdToEurRate <= 0) throw new Error("USD to EUR rate is invalid.");
  const convertedEvents = events.map((event) => ({
    ...event,
    cost_estimate: event.cost_estimate == null
      ? null
      : round((Number(event.cost_estimate) || 0) * usdToEurRate, 6),
  }));
  const convertedProviders = providers.map((provider) => {
    const profile = { ...(provider.cost_profile ?? {}) };
    const legacyUsd = Number(profile.monthly_budget_usd ?? profile.monthlyBudgetUsd ?? profile.monthly_budget);
    if (profile.monthly_budget_eur == null && Number.isFinite(legacyUsd) && legacyUsd > 0) {
      profile.monthly_budget_eur = round(legacyUsd * usdToEurRate, 6);
    }
    delete profile.monthly_budget_usd;
    delete profile.monthlyBudgetUsd;
    delete profile.monthly_budget;
    return { ...provider, cost_profile: profile };
  });
  return { events: convertedEvents, providers: convertedProviders };
}
