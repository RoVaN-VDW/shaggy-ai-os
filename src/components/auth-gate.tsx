"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowRight, CheckCircle2, Loader2, LockKeyhole, Orbit } from "lucide-react";
import { isSupabaseClientConfigured, supabase } from "@/lib/supabase/client";
import { resolveAuthBoundaryState } from "@/lib/auth/auth-boundary";
import { buildSanitizedAuthCallbackUrl } from "@/lib/auth/auth-callback";
import {
  AuthBoundaryProvider,
  type AuthBoundarySnapshot,
} from "@/components/auth-boundary-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthGate({ children }: { children: ReactNode }) {
  const supabaseConfigured = isSupabaseClientConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [boundary, setBoundary] = useState<AuthBoundarySnapshot>(() =>
    supabaseConfigured
      ? { status: "checking", hasSession: false, checkedAt: null, error: null }
      : {
          status: "error",
          hasSession: false,
          checkedAt: null,
          error: "Supabase browser configuration is unavailable.",
        },
  );
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!supabaseConfigured) {
      return () => {
        active = false;
      };
    }

    const applySession = async (nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession) {
        const checkedAt = new Date().toISOString();
        setBoundary({
          status: resolveAuthBoundaryState({ hasSession: false, allowlisted: null, error: null }),
          hasSession: false,
          checkedAt,
          error: null,
        });
        return;
      }
      const sanitizedUrl = buildSanitizedAuthCallbackUrl(
        window.location.pathname,
        window.location.search,
        window.location.hash,
      );
      if (sanitizedUrl) {
        window.history.replaceState(window.history.state, "", sanitizedUrl);
      }
      setBoundary({ status: "checking", hasSession: true, checkedAt: null, error: null });
      const { data: access, error: accessError } = await supabase.rpc("is_shaggy_authorized");
      if (!active) return;
      const checkedAt = new Date().toISOString();
      const errorMessage = accessError?.message ?? null;
      setBoundary({
        status: resolveAuthBoundaryState({
          hasSession: true,
          allowlisted: accessError ? null : access === true,
          error: errorMessage,
        }),
        hasSession: true,
        checkedAt,
        error: errorMessage,
      });
    };

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) {
        if (!active) return;
        setSession(null);
        setBoundary({
          status: "error",
          hasSession: false,
          checkedAt: new Date().toISOString(),
          error: sessionError.message,
        });
        return;
      }
      void applySession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabaseConfigured]);

  async function requestMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setSending(true);
    setFormError(null);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { emailRedirectTo: window.location.origin },
    });
    setSending(false);

    if (authError) {
      setFormError(authError.message);
      return;
    }
    setSent(true);
  }

  if (boundary.status === "checking") {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Establishing secure session…
        </div>
      </div>
    );
  }

  if (boundary.status === "authorized") {
    return <AuthBoundaryProvider value={boundary}>{children}</AuthBoundaryProvider>;
  }

  if (boundary.status === "error") {
    return (
      <main className="min-h-screen grid place-items-center bg-background px-6 text-foreground">
        <section className="w-full max-w-md rounded-[28px] border border-destructive/25 bg-card/80 p-8 text-center shadow-2xl backdrop-blur-2xl">
          <LockKeyhole className="mx-auto size-9 text-destructive" />
          <h1 className="mt-5 text-2xl font-semibold">Session verification unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            SHAGGY could not prove the current session and remains locked. Retry the check or sign out.
          </p>
          {boundary.error && <p role="alert" className="mt-3 text-xs text-destructive">{boundary.error}</p>}
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
            {session && <Button variant="ghost" onClick={() => void supabase.auth.signOut()}>Sign out</Button>}
          </div>
        </section>
      </main>
    );
  }

  if (boundary.status === "forbidden" && session) {
    return (
      <main className="min-h-screen grid place-items-center bg-background px-6 text-foreground">
        <section className="w-full max-w-md rounded-[28px] border border-amber-300/20 bg-card/80 p-8 text-center shadow-2xl backdrop-blur-2xl">
          <LockKeyhole className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-5 text-2xl font-semibold">Access not authorized</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This account is authenticated but is not on the private SHAGGY allowlist.
          </p>
          <Button variant="outline" className="mt-6" onClick={() => void supabase.auth.signOut()}>
            Sign out
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground grid place-items-center px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(0,212,255,0.14),transparent_36%),radial-gradient(circle_at_75%_80%,rgba(240,180,41,0.08),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:48px_48px]" />

      <section className="relative w-full max-w-md rounded-[28px] border border-white/10 bg-card/75 p-8 shadow-[0_32px_120px_rgba(0,0,0,.55)] backdrop-blur-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="relative grid size-14 place-items-center rounded-2xl border border-primary/30 bg-primary/10 shadow-[0_0_40px_rgba(0,212,255,.14)]">
            <Orbit className="size-7 text-primary" />
            <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-card bg-emerald-400" />
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <LockKeyhole className="size-3 text-primary" /> Secure access
          </div>
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-primary">S.H.A.G.G.Y.</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Welcome back, Ronald.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Sign in to your private AI operating system. We’ll send a passwordless secure link to your inbox.
        </p>

        {sent ? (
          <div className="mt-8 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5">
            <CheckCircle2 className="mb-3 size-6 text-emerald-400" />
            <p className="font-medium">Check your inbox</p>
            <p className="mt-1 text-sm text-muted-foreground">Use the secure link sent to {email.trim()}.</p>
            <Button variant="ghost" className="mt-4 px-0 text-primary" onClick={() => setSent(false)}>
              Use another email
            </Button>
          </div>
        ) : (
          <form className="mt-8 space-y-4" onSubmit={requestMagicLink}>
            <label className="block text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground" htmlFor="email">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="h-12 border-white/10 bg-black/20"
            />
            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            <Button type="submit" className="h-12 w-full font-semibold" disabled={sending || !email.trim()}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <>Send secure link <ArrowRight className="size-4" /></>}
            </Button>
          </form>
        )}

        <p className="mt-8 text-center text-[11px] text-muted-foreground">
          Local-first · Approval-gated · Private by design
        </p>
      </section>
    </main>
  );
}