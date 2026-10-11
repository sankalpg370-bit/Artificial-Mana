"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function go(mode) {
    if (!supabase) { setMsg("Sign-in is temporarily unavailable. You can still browse courses and save learning progress in this browser."); return; }
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setMsg("Enter your email and password to continue.");
      return;
    }
    if (mode === "signup" && password.length < 6) {
      setMsg("Your password must be at least 6 characters long.");
      return;
    }
    setBusy(true); setMsg("");
    try {
      const fn = mode === "signup" ? supabase.auth.signUp : supabase.auth.signInWithPassword;
      const { data, error } = await fn.call(supabase.auth, { email: cleanEmail, password });
      if (error) { setMsg(error.message); return; }
      if (mode === "signup" && !data.session) { setMsg("Your account is made. Open the email we sent and confirm it. Then log in."); return; }
      const next = new URLSearchParams(window.location.search).get("next");
      const requested = new URL(next || "/", window.location.origin);
      const destination = requested.origin === window.location.origin
        ? `${requested.pathname}${requested.search}${requested.hash}`
        : "/";
      router.push(destination);
    } catch (error) {
      console.error("Unable to authenticate with Supabase.", error);
      setMsg("Could not reach the sign-in service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="login-title">
      <h1 id="login-title">Welcome</h1>
      <p className="muted">Log in to save your progress on all your devices.</p>
      <form className="form" onSubmit={(event) => { event.preventDefault(); go("login"); }}>
        <label htmlFor="login-email">Email</label>
        <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="login-password">Password</label>
        <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="row">
          <button type="submit" disabled={busy}>Log in</button>
          <button type="button" disabled={busy} onClick={() => go("signup")}>Sign up</button>
        </div>
        {msg && <p className="notice" role="status" aria-live="polite">{msg}</p>}
      </form>
    </section>
  );
}
