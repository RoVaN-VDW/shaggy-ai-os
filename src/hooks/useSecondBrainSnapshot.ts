"use client";

import { useEffect, useState } from "react";
import type { SecondBrainSnapshot } from "@/lib/second-brain/snapshot";
import {
  CAPABILITY_REGISTRY,
  resolveCapabilityTruth,
  type CapabilityTruth,
} from "@/lib/capabilities/registry";

export type SecondBrainSnapshotState = {
  status: "loading" | "live" | "error" | "unavailable";
  snapshot: SecondBrainSnapshot | null;
  error: string | null;
  truth: CapabilityTruth;
};

function twinTruth(snapshot: SecondBrainSnapshot | null, refreshError: string | null = null) {
  return resolveCapabilityTruth(CAPABILITY_REGISTRY.twin, {
    configured: true,
    observedAt: snapshot?.observedAt ?? null,
    refreshError,
  });
}

export function useSecondBrainSnapshot(): SecondBrainSnapshotState {
  const [state, setState] = useState<SecondBrainSnapshotState>({
    status: "loading",
    snapshot: null,
    error: null,
    truth: twinTruth(null),
  });
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/second-brain", { cache: "no-store" });
        const payload = await response.json() as {
          snapshot?: SecondBrainSnapshot;
          error?: string;
          availability?: "local-only";
        };
        if (payload.availability === "local-only") {
          throw new Error("Local AI Workspace snapshot required. The local source is currently unavailable.");
        }
        if (!response.ok || !payload.snapshot) throw new Error(payload.error ?? `Snapshot request failed (${response.status})`);
        if (active) setState({
          status: "live",
          snapshot: payload.snapshot,
          error: null,
          truth: twinTruth(payload.snapshot),
        });
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : "Snapshot unavailable.";
        if (active) setState({
          status: "unavailable",
          snapshot: null,
          error: message,
          truth: twinTruth(null, message),
        });
      }
    })();
    return () => { active = false; };
  }, []);
  return state;
}
