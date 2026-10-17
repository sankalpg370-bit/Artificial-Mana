"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { backend } from "../../lib/backend";
import { backendMode, publicSignupEnabled } from "../../lib/backend-config";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function go(mode) {
    if (mode === "signup" && !publicSignupEnabled()) { setMsg("Public registration is closed. You can learn without an account."); return; }
    if (!backend) { setMsg("Sign-in is temporarily unavailable. You can still browse courses and save learning progress in this browser."); return; }
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setMsg("Enter your email and password to continue.");
      return;
    }
    if (mode === "signup" && password.length < 10) {
      setMsg("Your password must be at least 10 characters long.");
      return;
    }
    setBusy(true); setMsg("");
    try {
      const fn = mode === "signup" ? backend.auth.signUp : backend.auth.signInWithPassword;
      const { data, error } = await fn.call(backend.auth, { email: cleanEmail, password });
      if (error) { setMsg(error.message); return; }
      if (mode === "signup" && !data.session) {
        setMsg(backendMode() === "supabase" ? "Check your email for a confirmation link, then log in. If you already have an account, try logging in." : "Your account was created. Please log in.");
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      const requested = new URL(next || "/", window.location.origin);
      const destination = requested.origin === window.location.origin
        ? `${requested.pathname}${requested.search}${requested.hash}`
        : "/";
      router.push(destination);
    } catch (error) {
      console.error("Unable to authenticate with the account service.", error);
      setMsg("Could not reach the sign-in service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="login-title">
      <h1 id="login-title">Welcome</h1>
      <p className="muted">{publicSignupEnabled() ? "Log in to save your progress on all your devices." : "Sign in with an existing staff account. Everyone can learn without signing in."}</p>
      <p><Link href="/#courses">Continue learning without an account</Link></p>
      {!publicSignupEnabled() && <p><Link href="/staff/setup">Set up your staff account or change your password</Link></p>}
      <form className="form" onSubmit={(event) => { event.preventDefault(); go("login"); }}>
        <label htmlFor="login-email">Email</label>
        <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="login-password">Password</label>
        <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="row">
          <button type="submit" disabled={busy}>Log in</button>
          {publicSignupEnabled() && <button type="button" disabled={busy} onClick={() => go("signup")}>Sign up</button>}
        </div>
        {msg && <p className="notice" role="status" aria-live="polite">{msg}</p>}
      </form>
    </section>
  );
}
