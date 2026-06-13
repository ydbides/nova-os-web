"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signOut, updateProfile, type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

/* ---------------- context ---------------- */

const UserCtx = createContext<User | null>(null);
export const useUser = () => useContext(UserCtx);
export const doSignOut = () => signOut(auth);

const ERRORS: Record<string, string> = {
  "auth/invalid-credential": "Wrong email or password.",
  "auth/invalid-email": "That email doesn't look right.",
  "auth/email-already-in-use": "That email already has an account — sign in instead.",
  "auth/weak-password": "Password needs at least 6 characters.",
  "auth/too-many-requests": "Too many attempts — wait a minute and try again.",
  "auth/network-request-failed": "No connection — check your internet.",
};

function friendly(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  return ERRORS[code] ?? `Something went wrong (${code || "unknown"}).`;
}

/* ---------------- gate ---------------- */

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setReady(true); }), []);

  if (!ready)
    return (
      <main className="min-h-screen bg-black text-cyan-300 flex items-center justify-center">
        <p className="animate-pulse text-xl font-mono">◆ NOVA — connecting …</p>
      </main>
    );
  if (!user) return <Login />;
  return <UserCtx.Provider value={user}>{children}</UserCtx.Provider>;
}

/* ---------------- login screen ---------------- */

function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      if (mode === "up") {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), pw);
      }
    } catch (e) {
      setMsg({ text: friendly(e), ok: false });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!email.trim()) { setMsg({ text: "Type your email first, then press reset.", ok: false }); return; }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMsg({ text: "Reset email sent — check your inbox.", ok: true });
    } catch (e) {
      setMsg({ text: friendly(e), ok: false });
    }
  };

  const field = "w-full rounded-xl bg-white/10 border border-white/10 p-4 outline-none focus:border-cyan-400/50 text-white";

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(circle at top left,#22d3ee26,transparent 30%),radial-gradient(circle at bottom right,#22d3ee1a,transparent 35%)" }} />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-cyan-400/25 bg-black/60 backdrop-blur-xl p-10 shadow-[0_0_60px_#22d3ee14]">
        <h1 className="text-4xl font-black text-cyan-300 text-center">◆ NOVA OS</h1>
        <p className="text-zinc-500 text-sm text-center mt-2 mb-8">cloud account · powered by Firebase</p>

        <div className="flex rounded-xl bg-white/5 border border-white/10 p-1 mb-6">
          {(["in", "up"] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setMsg(null); }}
              className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition ${
                mode === m ? "bg-cyan-400/15 text-cyan-300 border border-cyan-400/40" : "text-zinc-400"}`}>
              {m === "in" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {mode === "up" && (
            <input value={name} onChange={(e) => setName(e.target.value)}
              className={field} placeholder="Display name (what NOVA calls you)" />
          )}
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
            className={field} placeholder="Email" />
          <input value={pw} onChange={(e) => setPw(e.target.value)} type="password"
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className={field} placeholder="Password (6+ characters)" />
        </div>

        {msg && <p className={`text-sm mt-4 ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.text}</p>}

        <button onClick={submit} disabled={busy}
          className="mt-6 w-full rounded-xl bg-cyan-400 py-4 text-black font-black text-lg disabled:opacity-50">
          {busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
        </button>

        {mode === "in" && (
          <button onClick={reset} className="mt-4 w-full text-center text-xs text-zinc-500 hover:text-cyan-300">
            Forgot password? Send reset email
          </button>
        )}
      </div>
    </main>
  );
}
