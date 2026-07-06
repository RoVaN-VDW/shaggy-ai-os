"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

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
  const [state, setState] = useState<CockpitState>({
    loading: true,
    error: null,
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
    setState((s) => ({ ...s, loading: true, error: null }));
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
          .select("id, provider, model, status, cost_profile, policy_profile")
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
          .select("id, project_id, name, file_type, size_bytes, embedding_status, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("agent_activity")
          .select("id, agent, action, status, metadata, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const errors: string[] = [];
      if (projectsRes.error) errors.push(`projects: ${projectsRes.error.message}`);
      if (providersRes.error) errors.push(`providers: ${providersRes.error.message}`);
      if (reviewsRes.error) errors.push(`reviews: ${reviewsRes.error.message}`);
      if (usageRes.error) errors.push(`usage: ${usageRes.error.message}`);
      if (dailyUsageRes.error) errors.push(`dailyUsage: ${dailyUsageRes.error.message}`);
      if (notificationsRes.error) errors.push(`notifications: ${notificationsRes.error.message}`);
      if (knowledgeRes.error) errors.push(`knowledge: ${knowledgeRes.error.message}`);
      if (activityRes.error) errors.push(`activity: ${activityRes.error.message}`);

      setState((s) => ({
        ...s,
        loading: false,
        error: errors.length > 0 ? errors.join("; ") : null,
        projects: (projectsRes.data ?? []) as Project[],
        providers: (providersRes.data ?? []) as ModelProvider[],
        reviews: (reviewsRes.data ?? []) as ReviewItem[],
        usage: (usageRes.data ?? []) as UsageEvent[],
        dailyUsage: (dailyUsageRes.data ?? []) as DailyUsage[],
        notifications: (notificationsRes.data ?? []) as Notification[],
        knowledgeDocs: (knowledgeRes.data ?? []) as KnowledgeDoc[],
        agentActivity: (activityRes.data ?? []) as AgentActivity[],
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateProviderStatus = useCallback(async (id: string, status: string) => {
    const { error } = await supabase
      .from("model_providers")
      .update({ status })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await fetchData();
  }, [fetchData]);

  const updateReviewStatus = useCallback(async (id: string, status: string) => {
    const { error } = await supabase
      .from("review_items")
      .update({ status })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await fetchData();
  }, [fetchData]);

  const markNotificationRead = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await fetchData();
  }, [fetchData]);

  const clearAllNotifications = useCallback(async () => {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(error.message);
    await fetchData();
  }, [fetchData]);

  const addNotification = useCallback(async (n: Omit<Notification, "id" | "created_at">) => {
    const { error } = await supabase.from("notifications").insert(n);
    if (error) throw new Error(error.message);
    await fetchData();
  }, [fetchData]);

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
