"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCockpitData } from "@/hooks/useCockpitData";
import { CAPABILITY_REGISTRY, resolveCapabilityTruth } from "@/lib/capabilities/registry";
import { AlertCircle, Check, ClipboardCheck, Loader2, X } from "lucide-react";
import { useState } from "react";

export default function ReviewPage() {
  const { resources, reviews, updateReviewStatus } = useCockpitData();
  const [updating, setUpdating] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const reviewTruth = resolveCapabilityTruth(CAPABILITY_REGISTRY.reviewQueue, {
    configured: true,
    observedAt: resources.reviews.fetchedAt,
    refreshError: resources.reviews.error,
  });
  const reviewsLoading = resources.reviews.status === "loading";
  const reviewError = actionError || resources.reviews.error;

  async function resolve(id: string, status: "approved" | "rejected") {
    setUpdating(id);
    setActionError(null);
    try {
      await updateReviewStatus(id, status);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Review could not be updated.");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="size-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Review Queue</h1>
        </div>
        <Badge variant="outline" className="border-primary/25 text-primary" title={`${reviewTruth.source} · ${resources.reviews.fetchedAt ?? "not observed"}`}>
          {reviewTruth.status === "offline" ? "— pending · offline" : `${reviews.length} pending · ${reviewTruth.status}`}
        </Badge>
      </div>

      {reviewError && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4" /> {reviewError}
        </div>
      )}

      <Card className="flex-1 border-border bg-card/80 backdrop-blur flex flex-col min-h-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Approval-gated actions</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0 min-h-0">
          <ScrollArea className="h-full px-4">
            <div className="space-y-2 pb-4">
              {reviewsLoading && (
                <div className="flex items-center gap-2 py-10 justify-center text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" /> Loading review queue…
                </div>
              )}
              {!reviewsLoading && reviewTruth.status === "fresh" && reviews.length === 0 && (
                <div className="grid place-items-center rounded-2xl border border-dashed border-border py-16 text-center">
                  <Check className="mb-3 size-8 text-emerald-400" />
                  <p className="font-medium text-foreground">Queue clear</p>
                  <p className="mt-1 text-xs text-muted-foreground">No pending decisions were returned by the current source.</p>
                </div>
              )}
              {!reviewsLoading && reviewTruth.status === "stale" && reviews.length === 0 && (
                <div className="grid place-items-center rounded-2xl border border-dashed border-amber-300/25 py-16 text-center">
                  <AlertCircle className="mb-3 size-8 text-amber-300" />
                  <p className="font-medium text-foreground">Queue snapshot stale</p>
                  <p className="mt-1 text-xs text-muted-foreground">A current empty queue has not been proven.</p>
                </div>
              )}
              {!reviewsLoading && reviewTruth.status === "offline" && reviews.length === 0 && (
                <div className="grid place-items-center rounded-2xl border border-dashed border-destructive/25 py-16 text-center">
                  <AlertCircle className="mb-3 size-8 text-destructive" />
                  <p className="font-medium text-foreground">Queue unavailable</p>
                  <p className="mt-1 text-xs text-muted-foreground">No current review evidence is available.</p>
                </div>
              )}
              {reviews.map((item) => (
                <article key={item.id} className="flex items-center justify-between rounded-xl border border-border bg-background/55 p-4">
                  <div className="min-w-0 pr-4">
                    <div className="mb-1 flex items-center gap-2">
                      <h2 className="truncate text-sm font-medium text-foreground">{item.title}</h2>
                      <Badge className={item.risk_level === "high" ? "bg-destructive/10 text-destructive" : item.risk_level === "medium" ? "bg-amber-400/10 text-amber-300" : "bg-emerald-400/10 text-emerald-300"}>
                        {item.risk_level} risk
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.proposed_action || "No action details supplied."}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" className="h-8 bg-emerald-500 text-white hover:bg-emerald-500/90" disabled={updating === item.id} onClick={() => void resolve(item.id, "approved")}>
                      {updating === item.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 border-destructive/30 text-destructive hover:bg-destructive/10" disabled={updating === item.id} onClick={() => void resolve(item.id, "rejected")}>
                      <X className="size-3" /> Deny
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <AlertCircle className="size-3 text-amber-300" /> Decision queue only: approval records a decision and does not execute an external action.
      </div>
    </div>
  );
}
