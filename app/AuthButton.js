"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AuthButton() {
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        if (active) setUser(data.session?.user ?? null);
      })
      .catch((error) => {
        console.error("Unable to check the current sign-in.", error);
        if (active) {
          setUser(null);
          setMessage("Sign-in status is unavailable. Try refreshing the page.");
        }
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  if (!supabase) return null;
  async function logout() {
    setMessage("");
    try {
      const { error } = await supabase.auth.signOut();
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
