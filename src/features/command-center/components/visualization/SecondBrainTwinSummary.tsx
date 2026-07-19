"use client";

import { useSecondBrainSnapshot } from "@/hooks/useSecondBrainSnapshot";
import { buildSecondBrainContinuitySummary } from "@/lib/second-brain/snapshot";

export function SecondBrainTwinSummary() {
  const { status, snapshot, error } = useSecondBrainSnapshot();
  if (!snapshot) return <div className="dream-twin-unavailable" role={status === "error" ? "alert" : "status"}><b>Second Brain</b><small>{status === "loading" ? "Reading private snapshot…" : error ?? "Snapshot unavailable"}</small></div>;
  const continuity = buildSecondBrainContinuitySummary(snapshot);
  return (
    <div className="dream-twin-summary" data-state={continuity.state} aria-label={`Second Brain snapshot observed ${snapshot.observedAt}`}>
      <div className="dream-twin-summary__core"><span>{continuity.coverage === null ? "—" : `${continuity.coverage}%`}</span><small>file continuity</small></div>
      <dl>
        <div><dt>Projects</dt><dd>{snapshot.indexedProjects}</dd></div>
        <div><dt>Canon</dt><dd>{snapshot.continuityFilesPresent}/{snapshot.continuityFilesExpected}</dd></div>
        <div><dt>Actions</dt><dd>{snapshot.openActions === null ? "Unavailable" : snapshot.openActions}</dd></div>
        <div><dt>Decisions</dt><dd>{snapshot.unresolvedDecisions === null ? "Unavailable" : snapshot.unresolvedDecisions}</dd></div>
        <div><dt>Stale</dt><dd>{snapshot.staleProjects}</dd></div>
        <div><dt>Backup</dt><dd>{snapshot.backupState}</dd></div>
      </dl>
      <p className="dream-twin-summary__detail">{continuity.detail}</p>
    </div>
  );
}
