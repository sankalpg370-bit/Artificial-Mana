"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { publicSignupEnabled } from "../lib/backend-config";
import { backend } from "../lib/backend";

export default function AuthButton() {
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [staffAccess, setStaffAccess] = useState(null);
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
  useEffect(() => {
    if (!backend || !user) return;
    let active = true;
    backend.from("profiles").select("role").eq("user_id", user.id).maybeSingle()
      .then(({ data, error }) => {
        if (active) setStaffAccess({ userId: user.id, role: error ? null : data?.role });
      })
      .catch(() => { if (active) setStaffAccess({ userId: user.id, role: null }); });
    return () => { active = false; };
  }, [user]);
  const isStaff = staffAccess?.userId === user?.id && ["teacher", "admin"].includes(staffAccess?.role);
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
      {isStaff && <Link href="/admin" className="btn">Manage courses</Link>}
      <span className="muted" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</span>
      <button type="button" onClick={logout}>Log out</button>
      {message && <span className="muted" role="status" aria-live="polite">{message}</span>}
    </>
  ) : (
    <>
      {message && <span className="muted" role="status" aria-live="polite">{message}</span>}
      <Link href="/login" className="btn">{publicSignupEnabled() ? "Log in" : "Staff login"}</Link>
      {publicSignupEnabled() && <Link href="/login" className="btn primary">Sign up free</Link>}
    </>
  );
}
