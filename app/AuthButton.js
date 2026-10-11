"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { backend } from "../lib/backend";

export default function AuthButton() {
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!backend) return;
    let active = true;
    let changed = false;
    backend.auth.getSession()
      .then(({ data, error }) => {
        if (!active || changed) return;
        if (error) throw error;
        if (active) setUser(data.session?.user ?? null);
      })
      .catch((error) => {
        console.error("Unable to check the current sign-in.", error);
        if (active && !changed) {
          setUser(null);
          setMessage("Sign-in status is unavailable. Try refreshing the page.");
        }
      });
    const { data: sub } = backend.auth.onAuthStateChange((_e, s) => { changed = true; if (active) { setUser(s?.user ?? null); setMessage(""); } });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  if (!backend) return null;
  async function logout() {
    setMessage("");
    try {
      const { error } = await backend.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error("Unable to sign out.", error);
      setMessage("Could not log out. Please try again.");
    }
  }
  return user ? (
    <>
      <span className="muted" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</span>
      <button type="button" onClick={logout}>Log out</button>
      {message && <span className="muted" role="status" aria-live="polite">{message}</span>}
    </>
  ) : (
    <>
      {message && <span className="muted" role="status" aria-live="polite">{message}</span>}
      <Link href="/login" className="btn">Log in</Link>
      <Link href="/login" className="btn primary">Sign up free</Link>
    </>
  );
}
