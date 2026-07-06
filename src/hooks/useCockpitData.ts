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

export type CockpitState = {
  loading: boolean;
  error: string | null;
  projects: Project[];
  providers: ModelProvider[];
  reviews: ReviewItem[];
  refresh: () => void;
  updateProviderStatus: (id: string, status: string) => Promise<void>;
  updateReviewStatus: (id: string, status: string) => Promise<void>;
};

export function useCockpitData(): CockpitState {
  const [state, setState] = useState<CockpitState>({
    loading: true,
    error: null,
    projects: [],
    providers: [],
    reviews: [],
    refresh: () => {},
    updateProviderStatus: async () => {},
    updateReviewStatus: async () => {},
  });

  const fetchData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [projectsRes, providersRes, reviewsRes] = await Promise.all([
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
      ]);

      const errors: string[] = [];
      if (projectsRes.error) errors.push(`projects: ${projectsRes.error.message}`);
      if (providersRes.error) errors.push(`providers: ${providersRes.error.message}`);
      if (reviewsRes.error) errors.push(`reviews: ${reviewsRes.error.message}`);

      setState((s) => ({
        ...s,
        loading: false,
        error: errors.length > 0 ? errors.join("; ") : null,
        projects: (projectsRes.data ?? []) as Project[],
        providers: (providersRes.data ?? []) as ModelProvider[],
        reviews: (reviewsRes.data ?? []) as ReviewItem[],
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

  return {
    ...state,
    refresh: fetchData,
    updateProviderStatus,
    updateReviewStatus,
  };
}
