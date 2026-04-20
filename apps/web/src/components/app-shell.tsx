"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { AuthCard } from "@/components/auth-card";
import { Dashboard } from "@/components/dashboard";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";

export function AppShell() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(hasSupabaseEnv);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      return;
    }

    let isMounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 md:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(252,211,77,0.24),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(120,113,108,0.12),_transparent_26%),linear-gradient(180deg,_#fefdf8,_#f4f1ea)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(255,255,255,0.9),_rgba(255,255,255,0))]" />

      <div className="relative mx-auto max-w-7xl">
        {!hasSupabaseEnv ? (
          <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-10 shadow-[0_24px_80px_rgba(68,58,42,0.08)]">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">Configuration needed</p>
            <h1 className="mt-3 font-serif text-4xl text-stone-900">Add your Supabase keys to launch the dashboard.</h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-stone-600">
              Create <code className="rounded bg-stone-100 px-2 py-1 text-sm">apps/web/.env.local</code> with
              <code className="ml-2 rounded bg-stone-100 px-2 py-1 text-sm">NEXT_PUBLIC_SUPABASE_URL</code> and
              <code className="ml-2 rounded bg-stone-100 px-2 py-1 text-sm">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
            </p>
          </section>
        ) : isLoading ? (
          <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-10 text-center text-stone-500 shadow-[0_24px_80px_rgba(68,58,42,0.08)]">
            Connecting to Supabase...
          </section>
        ) : session ? (
          <Dashboard session={session} />
        ) : (
          <AuthCard />
        )}
      </div>
    </main>
  );
}
