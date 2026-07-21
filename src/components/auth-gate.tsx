"use client";

import { ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { Loader2, LockKeyhole, Orbit } from "lucide-react";
import { resolveLocalAccess } from "@/lib/local/access";
import {
  AuthBoundaryProvider,
  type AuthBoundarySnapshot,
} from "@/components/auth-boundary-context";

const CHECKING: AuthBoundarySnapshot = {
  status: "checking",
  hasSession: false,
  checkedAt: null,
  error: null,
};

function subscribeToLocation(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}

function getHostSnapshot() {
  return window.location.host;
}

function getServerHostSnapshot() {
  return "";
}

export function AuthGate({ children }: { children: ReactNode }) {
  const host = useSyncExternalStore(subscribeToLocation, getHostSnapshot, getServerHostSnapshot);
  const [boundary, setBoundary] = useState<AuthBoundarySnapshot>(CHECKING);

  useEffect(() => {
    if (!host) return;
    let cancelled = false;
    const decision = resolveLocalAccess({ host, origin: null, method: "GET" });
    if (!decision.authorized) {
      return;
    }

    void (async () => {
      try {
        const fragment = new URLSearchParams(window.location.hash.slice(1));
        const pairToken = fragment.get("owner-pair");
        if (pairToken) {
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
          const paired = await fetch("/api/local-owner/session", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: pairToken }),
          });
          if (!paired.ok) throw new Error("owner-pairing-failed");
        }

        const response = await fetch("/api/local-owner/session", { cache: "no-store", credentials: "same-origin" });
        if (cancelled) return;
        setBoundary(response.ok
          ? { status: "authorized", hasSession: true, checkedAt: new Date().toISOString(), error: null }
          : { status: "forbidden", hasSession: false, checkedAt: new Date().toISOString(), error: "owner-session-required" });
      } catch {
        if (!cancelled) {
          setBoundary({ status: "forbidden", hasSession: false, checkedAt: new Date().toISOString(), error: "owner-session-required" });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [host]);

  const localDecision = host
    ? resolveLocalAccess({ host, origin: null, method: "GET" })
    : null;

  if (localDecision && !localDecision.authorized) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
        <section className="w-full max-w-md rounded-[28px] border border-destructive/25 bg-card/80 p-8 text-center shadow-2xl backdrop-blur-2xl">
          <LockKeyhole className="mx-auto size-9 text-destructive" aria-hidden="true" />
          <h1 className="mt-5 text-2xl font-semibold">Local runtime required</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            SHAGGY accepts owner sessions only through this Mac&apos;s loopback runtime. Network access remains locked.
          </p>
          <p className="mt-6 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Non-loopback · Denied · Fail-closed
          </p>
        </section>
      </main>
    );
  }

  if (boundary.status === "checking") {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-foreground">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Verifying local owner session…
        </div>
      </div>
    );
  }

  if (boundary.status === "authorized") {
    return <AuthBoundaryProvider value={boundary}>{children}</AuthBoundaryProvider>;
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-6 text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(0,212,255,0.14),transparent_36%),radial-gradient(circle_at_75%_80%,rgba(240,180,41,0.08),transparent_30%)]" />
      <section className="relative w-full max-w-md rounded-[28px] border border-amber-300/20 bg-card/80 p-8 text-center shadow-2xl backdrop-blur-2xl">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-primary/30 bg-primary/10">
          <Orbit className="size-7 text-primary" aria-hidden="true" />
        </div>
        <LockKeyhole className="mx-auto mt-5 size-7 text-amber-300" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold">Owner pairing required</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          SHAGGY is local to this Mac, but localhost alone is not identity. Pair this browser once from Ronald&apos;s terminal.
        </p>
        <code className="mt-5 block rounded-lg border border-primary/20 bg-black/30 px-3 py-2 text-sm text-primary">
          pnpm owner:open
        </code>
        <p className="mt-6 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Loopback · Owner capability · Fail-closed
        </p>
      </section>
    </main>
  );
}
