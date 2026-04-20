"use client";

import { useState, useTransition } from "react";

import { hasSupabaseEnv, supabase } from "@/lib/supabase";

type Mode = "sign-in" | "sign-up";

export function AuthCard() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submitLabel = mode === "sign-in" ? "Sign in" : "Create account";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!hasSupabaseEnv) {
      setError("Add your Supabase web environment variables before signing in.");
      return;
    }

    startTransition(async () => {
      const action =
        mode === "sign-in"
          ? supabase.auth.signInWithPassword({ email, password })
          : supabase.auth.signUp({ email, password });

      const { error: authError } = await action;

      if (authError) {
        setError(authError.message);
        return;
      }

      if (mode === "sign-up") {
        setMessage("Account created. Check your inbox if email confirmation is enabled in Supabase.");
        return;
      }

      setMessage("Signed in.");
    });
  }

  return (
    <section className="grid gap-10 rounded-[2rem] border border-stone-200/80 bg-white/90 p-8 shadow-[0_24px_80px_rgba(68,58,42,0.10)] backdrop-blur md:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-5">
        <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-800">
          Live aircraft telemetry
        </div>
        <h1 className="max-w-xl font-serif text-4xl leading-tight text-stone-900 md:text-6xl">
          A calm, live view of aircraft motion across your favorite region.
        </h1>
        <p className="max-w-lg text-base leading-8 text-stone-600">
          Track flights as the worker syncs OpenSky state vectors into Supabase, then watch the interface update in real
          time without reloading the page.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <FeatureStat label="Worker cadence" value="5 min" />
          <FeatureStat label="Realtime updates" value="Supabase" />
          <FeatureStat label="Personalized view" value="Favorites" />
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-6">
        <div className="mb-6 flex rounded-full border border-stone-200 bg-white p-1 text-sm">
          <button
            className={`flex-1 rounded-full px-4 py-2 transition ${mode === "sign-in" ? "bg-stone-900 text-white" : "text-stone-600"}`}
            onClick={() => setMode("sign-in")}
            type="button"
          >
            Sign in
          </button>
          <button
            className={`flex-1 rounded-full px-4 py-2 transition ${mode === "sign-up" ? "bg-stone-900 text-white" : "text-stone-600"}`}
            onClick={() => setMode("sign-up")}
            type="button"
          >
            Sign up
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-stone-700">Email</span>
            <input
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition focus:border-stone-400"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-stone-700">Password</span>
            <input
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition focus:border-stone-400"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              required
              type="password"
              value={password}
            />
          </label>

          <button
            className="w-full rounded-2xl bg-stone-900 px-4 py-3 text-sm font-semibold text-stone-50 transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Working..." : submitLabel}
          </button>
        </form>

        {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
      </div>
    </section>
  );
}

function FeatureStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-5">
      <div className="text-2xl font-semibold text-stone-900">{value}</div>
      <div className="mt-1 text-sm text-stone-500">{label}</div>
    </div>
  );
}
