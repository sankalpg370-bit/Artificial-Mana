"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminAccessPage() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function unlock(event) {
    event.preventDefault();
    if (!key) {
      setMessage("Enter the temporary access key.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "Could not open the admin portal.");
        return;
      }
      setKey("");
      router.replace("/admin");
    } catch {
      setMessage("Could not reach the admin access service. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-card">
      <h1>Temporary admin access</h1>
      <p className="muted">
        Enter the temporary key, then sign in with an account that already has an admin role.
        The key alone does not grant access to admin data.
      </p>
      <form className="form" onSubmit={unlock}>
        <label htmlFor="admin-access-key">Temporary access key</label>
        <input
          id="admin-access-key"
          type="password"
          autoComplete="off"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          required
        />
        <button type="submit" disabled={busy}>{busy ? "Checking..." : "Continue"}</button>
        {message && <p className="notice" role="alert">{message}</p>}
      </form>
      <p className="muted">
        <Link href="/login?next=%2Fadmin">Sign in to your account</Link>
      </p>
    </main>
  );
}
