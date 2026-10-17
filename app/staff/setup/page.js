"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { backend } from "../../../lib/backend";
import { backendMode } from "../../../lib/backend-config";

export default function StaffSetup() {
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [staff, setStaff] = useState(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const available = backend && backendMode() === "supabase";

  async function verifyStaff(user) {
    if (!user?.id) throw new Error("Sign in with your temporary password first.");
    const { data, error } = await backend.from("profiles").select("role").eq("user_id", user.id).single();
    if (error) throw new Error("Could not verify staff access. Please try again.");
    if (!["teacher", "admin"].includes(data?.role)) throw new Error("This account has not been granted staff access. Contact the site owner.");
    return user;
  }

  async function run(action) {
    if (pending.current || !available) return;
    pending.current = true; setBusy(true); setMessage("");
    try { await action(); }
    catch (error) { setMessage(error.message || "Could not complete staff setup. Please try again."); }
    finally { pending.current = false; setBusy(false); }
  }

  function signIn(event) {
    event.preventDefault();
    run(async () => {
      const { data, error } = await backend.auth.signInWithPassword({ email: email.trim(), password: temporaryPassword });
      setTemporaryPassword("");
      if (error) throw error;
      setStaff(await verifyStaff(data.user));
    });
  }

  function changePassword(event) {
    event.preventDefault();
    if (password.length < 10) { setMessage("Use at least 10 characters for your new password."); return; }
    if (password !== confirmation) { setMessage("The new passwords do not match."); return; }
    run(async () => {
      // Revalidate the current identity; another tab may have changed the session.
      const { data: current, error: sessionError } = await backend.auth.getUser();
      if (sessionError) throw sessionError;
      if (current.user?.id !== staff.id) throw new Error("Your sign-in changed. Reload this page and sign in again.");
      await verifyStaff(current.user);
      const { error } = await backend.auth.updateUser({ password });
      if (error) throw error;
      setPassword(""); setConfirmation(""); setDone(true);
      const { error: signOutError } = await backend.auth.signOut();
      if (signOutError) setMessage("Your password was changed. Automatic sign-out failed; use Log out before signing in again.");
    });
  }

  return (
    <section className="auth-card" aria-labelledby="staff-setup-title">
      <h1 id="staff-setup-title">Staff account setup</h1>
      <p className="muted">Staff accounts are created privately by the site owner. Public registration is closed.</p>
      {!available ? <p role="status">Staff setup is available on the hosted website.</p> : done ? (
        <>
          <p role="status">Your new password has been saved. Sign in using your new password.</p>
          <Link className="btn primary" href="/login">Go to staff login</Link>
        </>
      ) : !staff ? (
        <form className="form" onSubmit={signIn}>
          <h2>1. Sign in with your temporary password</h2>
          <label htmlFor="staff-email">Staff email</label>
          <input id="staff-email" type="email" autoComplete="username" required disabled={busy} value={email} onChange={e => setEmail(e.target.value)} />
          <label htmlFor="staff-temporary-password">Temporary password</label>
          <input id="staff-temporary-password" type="password" autoComplete="current-password" required disabled={busy} value={temporaryPassword} onChange={e => setTemporaryPassword(e.target.value)} />
          <button disabled={busy}>{busy ? "Checking account..." : "Continue to set your password"}</button>
        </form>
      ) : (
        <form className="form" onSubmit={changePassword}>
          <h2>2. Set your own password</h2>
          <p>Signed in as {staff.email}</p>
          <label htmlFor="staff-new-password">New password</label>
          <input id="staff-new-password" type="password" autoComplete="new-password" minLength={10} required disabled={busy} value={password} onChange={e => setPassword(e.target.value)} />
          <label htmlFor="staff-confirm-password">Confirm new password</label>
          <input id="staff-confirm-password" type="password" autoComplete="new-password" minLength={10} required disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value)} />
          <button disabled={busy}>{busy ? "Saving password..." : "Save new password"}</button>
        </form>
      )}
      {message && <p className="notice" role="alert">{message}</p>}
      <p><Link href="/#courses">Continue learning without an account</Link></p>
    </section>
  );
}
