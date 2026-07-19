"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthBoundary } from "@/components/auth-boundary-context";
import { canAccessCockpitData } from "@/lib/auth/auth-boundary";
import {
  createInitialResourceStates,
  markResourcesRefreshing,
  resolveCockpitResourceStates,
  resolveResourceData,
  resolveResourceState,
  setNotificationReadValue,
  type CockpitResourceKey,
  type CockpitResourceStates,
} from "./cockpit-resource-status";

export type Project = {
  id: string;
  name: string;
  description: string;
  status: string;
  type: string;
  health_score: number;
};

export type ModelProvider = {
  id: string;
  provider: string;
  model: string;
  status: string;
  health_status: string;
  last_seen_at: string | null;
  cost_profile?: Record<string, unknown>;
  policy_profile?: Record<string, unknown>;
};

export type ReviewItem = {
  id: string;
  title: string;
  risk_level: string;
  status: string;
  project_id?: string;
  proposed_action?: string;
};

export type UsageEvent = {
  id: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_estimate: number;
  status: string;
  created_at: string;
};

export type DailyUsage = {
  day: string;
  provider: string;
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  event_count: number;
};

export type Notification = {
  id: string;
  level: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  read: boolean;
  created_at: string;
};

export type KnowledgeDoc = {
  id: string;
  project_id?: string;
  name: string;
  file_type: string;
  size_bytes: number;
  embedding_status: string;
  storage_path?: string;
  created_at: string;
};

export type AgentActivity = {
  id: string;
  agent: string;
  action: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type CockpitState = {
  loading: boolean;
  error: string | null;
  resources: CockpitResourceStates;
  projects: Project[];
  providers: ModelProvider[];
  reviews: ReviewItem[];
  usage: UsageEvent[];
  dailyUsage: DailyUsage[];
  notifications: Notification[];
  knowledgeDocs: KnowledgeDoc[];
  agentActivity: AgentActivity[];
  refresh: () => void;
  updateProviderStatus: (id: string, status: string) => Promise<void>;
  updateReviewStatus: (id: string, status: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  addNotification: (n: Omit<Notification, "id" | "created_at">) => Promise<void>;
};

export function useCockpitData(): CockpitState {
  const auth = useAuthBoundary();
  const [state, setState] = useState<CockpitState>({
    loading: true,
    error: null,
    resources: createInitialResourceStates(),
    projects: [],
    providers: [],
    reviews: [],
    usage: [],
    dailyUsage: [],
    notifications: [],
    knowledgeDocs: [],
    agentActivity: [],
    refresh: () => {},
    updateProviderStatus: async () => {},
    updateReviewStatus: async () => {},
    markNotificationRead: async () => {},
    clearAllNotifications: async () => {},
    addNotification: async () => {},
  });

  const fetchData = useCallback(async () => {
    if (!canAccessCockpitData(auth.status)) return;
    await Promise.resolve();
    setState((s) => ({
      ...s,
      loading: true,
      error: null,
      resources: markResourcesRefreshing(s.resources),
    }));
    try {
      const [
        projectsRes,
        providersRes,
        reviewsRes,
        usageRes,
        dailyUsageRes,
        notificationsRes,
        knowledgeRes,
        activityRes,
      ] = await Promise.all([
        supabase
          .from("projects")
          .select("id, name, description, status, type, health_score")
          .order("updated_at", { ascending: false }),
        supabase
          .from("model_providers")
          .select("id, provider, model, status, cost_profile, policy_profile, last_seen_at, health_status")
          .order("created_at", { ascending: false }),
        supabase
          .from("review_items")
          .select("id, title, risk_level, status, project_id, proposed_action")
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
        supabase
          .from("usage_events")
          .select("id, provider, model, input_tokens, output_tokens, cost_estimate, status, created_at")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.rpc("get_daily_usage", { days_back: 30 }),
        supabase
          .from("notifications")
          .select("id, level, title, message, read, created_at")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("knowledge_docs")
          .select("id, project_id, name, file_type, size_bytes, embedding_status, storage_path, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("agent_activity")
          .select("id, agent, action, status, metadata, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const resourceErrors: Record<CockpitResourceKey, string | null> = {
        projects: projectsRes.error?.message ?? null,
        providers: providersRes.error?.message ?? null,
        reviews: reviewsRes.error?.message ?? null,
        usage: usageRes.error?.message ?? null,
        dailyUsage: dailyUsageRes.error?.message ?? null,
        notifications: notificationsRes.error?.message ?? null,
        knowledgeDocs: knowledgeRes.error?.message ?? null,
        agentActivity: activityRes.error?.message ?? null,
      };
      const errors = Object.entries(resourceErrors)
        .filter((entry): entry is [CockpitResourceKey, string] => entry[1] !== null)
        .map(([key, message]) => `${key}: ${message}`);
      const fetchedAt = new Date().toISOString();

      setState((s) => ({
        ...s,
        loading: false,
        error: errors.length > 0 ? errors.join("; ") : null,
        resources: resolveCockpitResourceStates(s.resources, resourceErrors, fetchedAt),
        projects: resolveResourceData(s.projects, projectsRes.data as Project[] | null, resourceErrors.projects),
        providers: resolveResourceData(s.providers, providersRes.data as ModelProvider[] | null, resourceErrors.providers),
        reviews: resolveResourceData(s.reviews, reviewsRes.data as ReviewItem[] | null, resourceErrors.reviews),
        usage: resolveResourceData(s.usage, usageRes.data as UsageEvent[] | null, resourceErrors.usage),
        dailyUsage: resolveResourceData(s.dailyUsage, dailyUsageRes.data as DailyUsage[] | null, resourceErrors.dailyUsage),
        notifications: resolveResourceData(s.notifications, notificationsRes.data as Notification[] | null, resourceErrors.notifications),
        knowledgeDocs: resolveResourceData(s.knowledgeDocs, knowledgeRes.data as KnowledgeDoc[] | null, resourceErrors.knowledgeDocs),
        agentActivity: resolveResourceData(s.agentActivity, activityRes.data as AgentActivity[] | null, resourceErrors.agentActivity),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const resourceErrors = Object.fromEntries(
        (Object.keys(createInitialResourceStates()) as CockpitResourceKey[]).map((key) => [key, message]),
      ) as Record<CockpitResourceKey, string>;
      setState((s) => ({
        ...s,
        loading: false,
        error: message,
        resources: resolveCockpitResourceStates(s.resources, resourceErrors, new Date().toISOString()),
      }));
    }
  }, [auth.status]);

  useEffect(() => {
    if (!canAccessCockpitData(auth.status)) return;
    const initialFetch = window.setTimeout(() => void fetchData(), 0);
    return () => window.clearTimeout(initialFetch);
  }, [auth.status, fetchData]);

  const updateProviderStatus = useCallback(async (id: string, status: string) => {
    if (!canAccessCockpitData(auth.status)) throw new Error("Cockpit access is not authorized");
    const { error } = await supabase
      .from("model_providers")
      .update({ status })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await fetchData();
  }, [auth.status, fetchData]);

  const updateReviewStatus = useCallback(async (id: string, status: string) => {
    if (!canAccessCockpitData(auth.status)) throw new Error("Cockpit access is not authorized");
    const { error } = await supabase
      .from("review_items")
      .update({ status })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await fetchData();
  }, [auth.status, fetchData]);

  const markNotificationRead = useCallback(async (id: string) => {
    if (!canAccessCockpitData(auth.status)) throw new Error("Cockpit access is not authorized");
    setState((s) => ({
      ...s,
      notifications: setNotificationReadValue(s.notifications, id, true),
    }));
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);
    const settledAt = new Date().toISOString();
    if (error) {
      setState((s) => ({
        ...s,
        error: `notifications: ${error.message}`,
        notifications: setNotificationReadValue(s.notifications, id, false),
        resources: {
          ...s.resources,
          notifications: resolveResourceState(s.resources.notifications, error.message, settledAt),
        },
      }));
      return;
    }
    setState((s) => ({
      ...s,
      resources: {
        ...s.resources,
        notifications: resolveResourceState(s.resources.notifications, null, settledAt),
      },
    }));
  }, [auth.status]);

  const clearAllNotifications = useCallback(async () => {
    if (!canAccessCockpitData(auth.status)) throw new Error("Cockpit access is not authorized");
    const { error } = await supabase
      .from("notifications")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(error.message);
    await fetchData();
  }, [auth.status, fetchData]);

  const addNotification = useCallback(async (n: Omit<Notification, "id" | "created_at">) => {
    if (!canAccessCockpitData(auth.status)) throw new Error("Cockpit access is not authorized");
    const { error } = await supabase.from("notifications").insert(n);
    if (error) throw new Error(error.message);
    await fetchData();
  }, [auth.status, fetchData]);

  return {
    ...state,
    refresh: fetchData,
    updateProviderStatus,
    updateReviewStatus,
    markNotificationRead,
    clearAllNotifications,
    addNotification,
  };
}
