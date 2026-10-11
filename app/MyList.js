"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function MyList({ courses }) {
  const [user, setUser] = useState(null);
  const [states, setStates] = useState({});

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const m = {};
    if (supabase && user) {
      setStates({});
      supabase.from("course_state").select("course_slug,bookmarked,last_lesson").eq("user_id", user.id).then(({ data, error }) => {
        if (error) {
          console.error("Unable to load your saved courses.", error);
          setStates({});
          return;
        }
        (data || []).forEach((r) => { m[r.course_slug] = { bookmarked: r.bookmarked, last: r.last_lesson }; });
        setStates(m);
      });
    } else {
      courses.forEach((c) => {
        try { const s = JSON.parse(localStorage.getItem("state:" + c.slug)); if (s) m[c.slug] = s; } catch (e) {}
      });
      setStates(m);
    }
  }, [user, courses]);

  const mine = courses.filter((c) => states[c.slug] && (states[c.slug].bookmarked || states[c.slug].last));
  if (!mine.length) return null;
  return (
    <div style={{ marginTop: 32 }}>
      <h2>My courses</h2>
      <div className="grid">
        {mine.map((c) => {
          const st = states[c.slug];
          const l = c.lessons.find((x) => x.id === st.last);
          return (
            <Link key={c.slug} href={`/course/${c.slug}`} className="card">
              <h2>{st.bookmarked ? "🔖 " : ""}{c.title}</h2>
              <p className="muted">{l ? `Continue: ${l.title}` : "Saved"}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
