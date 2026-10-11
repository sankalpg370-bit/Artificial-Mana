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
    if (!supabase) { setMsg("The Supabase keys are not set. Add them to .env.local."); return; }
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
      router.push("/");
    } catch (error) {
      console.error("Unable to authenticate with Supabase.", error);
      setMsg("Could not reach the sign-in service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 420 }}>
      <h1>Welcome</h1>
      <p className="muted">Log in to save your progress on all your devices.</p>
      <div className="form">
        <input type="email" aria-label="Email" placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" aria-label="Password" placeholder="Password (6 or more characters)" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="row">
          <button disabled={busy} onClick={() => go("login")}>Log in</button>
          <button disabled={busy} onClick={() => go("signup")}>Sign up</button>
        </div>
        {msg && <p className="muted">{msg}</p>}
      </div>
    </div>
  );
}
