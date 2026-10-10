"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AuthButton() {
  const [user, setUser] = useState(null);
  const [teacher, setTeacher] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!supabase || !user) { setTeacher(false); return; }
    supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setTeacher(!!data && (data.role === "teacher" || data.role === "admin")));
  }, [user]);
  if (!supabase) return null;
  return user ? (
    <span className="auth">
      {teacher && <Link href="/admin" className="btn">Admin</Link>}
      <span className="muted">{user.email}</span>
      <button onClick={() => supabase.auth.signOut()}>Log out</button>
    </span>
  ) : (
    <span className="auth"><Link href="/login" className="btn">Log in / Sign up</Link></span>
  );
}
