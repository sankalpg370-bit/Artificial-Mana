"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AuthButton() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (!supabase) return null;
  return user ? (
    <>
      <span className="muted" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</span>
      <button onClick={() => supabase.auth.signOut()}>Log out</button>
    </>
  ) : (
    <>
      <Link href="/login" className="btn">Log in</Link>
      <Link href="/login" className="btn primary">Sign up free</Link>
    </>
  );
}
