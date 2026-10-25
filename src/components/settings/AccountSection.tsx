"use client";

import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useSync } from "@/data/sync/SyncProvider";
import { getSupabase } from "@/lib/supabase";
import { button, card } from "@/components/ui/styles";

export function AccountSection() {
  const { state, pending, lastSyncedAt, syncNow, replaceLocalData, signOut } =
    useSync();

  if (state.kind === "disabled") {
    return (
      <section className={card}>
        <h2 className="font-semibold">Sync</h2>
        <p className="text-muted mt-1 text-sm">
          Sync isn&apos;t set up, so your data stays on this device. Add the
          Supabase settings described in the README to sync between devices.
        </p>
      </section>
    );
  }

  if (state.kind === "signed_out") return <SignIn />;

  if (state.kind === "conflict") {
    return (
      <section className={`${card} border-warning flex flex-col gap-3`}>
        <h2 className="font-semibold">Different account</h2>
        <p className="text-sm">
          This device has workouts from another account. Replace them with the
          data of <strong>{state.user.email}</strong>? Data on this device that
          wasn&apos;t synced will be lost.
        </p>
        <button
          type="button"
          className={button.primary}
          onClick={replaceLocalData}
        >
          Replace data on this device
        </button>
        <button
          type="button"
          className={button.secondary}
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </section>
    );
  }

  const status =
    state.kind === "syncing"
      ? "Syncing…"
      : state.kind === "error"
        ? state.message
        : lastSyncedAt
          ? `Synced ${formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}`
          : "Not synced yet";

  return (
    <section className={`${card} flex flex-col gap-3`}>
      <div>
        <h2 className="font-semibold">Account</h2>
        <p className="text-muted text-sm">{state.user.email}</p>
      </div>
      <p
        className={`text-sm ${state.kind === "error" ? "text-warning" : "text-muted"}`}
        role="status"
      >
        {status}
        {pending > 0 &&
          ` · ${pending} change${pending === 1 ? "" : "s"} waiting`}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={button.secondary}
          onClick={syncNow}
          disabled={state.kind === "syncing"}
        >
          Sync now
        </button>
        <button
          type="button"
          className={button.secondary}
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </div>
    </section>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else setSentTo(email);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase || !sentTo) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.verifyOtp({
      email: sentTo,
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) setMessage(error.message);
  }

  return (
    <section className={`${card} flex flex-col gap-3`}>
      <h2 className="font-semibold">Sign in to sync</h2>
      <p className="text-muted text-sm">
        Your workouts sync between your devices. Anything already logged on this
        device is uploaded to your account the first time you sign in.
      </p>
      {sentTo === null ? (
        <form onSubmit={sendLink} className="flex flex-col gap-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email"
            className="border-border bg-background h-12 rounded-xl border px-3 text-base"
          />
          <button type="submit" className={button.primary} disabled={busy}>
            Email me a sign-in link
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <p className="text-sm">
            We sent a link to <strong>{sentTo}</strong>. Open it on this device,
            or type the code from the email (handy when the app is installed to
            your home screen).
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Code from the email"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-label="Sign-in code"
            className="border-border bg-background h-12 rounded-xl border px-3 text-center text-lg tracking-widest"
          />
          <button
            type="submit"
            className={button.primary}
            disabled={busy || code.trim().length < 6}
          >
            Sign in with code
          </button>
          <button
            type="button"
            className={button.ghost}
            onClick={() => setSentTo(null)}
          >
            Use a different email
          </button>
        </form>
      )}
      {message && (
        <p className="text-danger text-sm" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}
