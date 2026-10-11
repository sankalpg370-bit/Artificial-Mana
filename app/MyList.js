"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Cover from "./Cover";

export default function MyList({ courses }) {
  const [user, setUser] = useState(null);
  const [states, setStates] = useState({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let changed = false;
    supabase.auth.getSession().then(({ data, error }) => {
      if (active && !changed) {
        if (error) throw error;
        setUser(data.session?.user ?? null);
      }
    }).catch(() => { if (active) setMessage("Your saved courses could not be loaded. Please refresh."); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { changed = true; if (active) setUser(s?.user ?? null); });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let active = true;
    const m = {};
    setMessage("");
    if (supabase && user) {
      setStates({});
      supabase.from("course_state").select("course_slug,bookmarked,last_lesson").eq("user_id", user.id).then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Unable to load your saved courses.", error);
          setStates({});
          setMessage("Your saved courses could not be loaded. Please refresh.");
          return;
        }
        (data || []).forEach((r) => { m[r.course_slug] = { bookmarked: r.bookmarked, last: r.last_lesson }; });
        setStates(m);
      }).catch(() => { if (active) setMessage("Your saved courses could not be loaded. Please refresh."); });
    } else {
      courses.forEach((c) => {
        try { const s = JSON.parse(localStorage.getItem("state:" + c.slug)); if (s) m[c.slug] = s; } catch (e) {}
      });
      setStates(m);
    }
    return () => { active = false; };
  }, [user, courses]);

  const mine = courses.filter((c) => states[c.slug] && (states[c.slug].bookmarked || states[c.slug].last));
  if (!mine.length) return message ? <p role="status">{message}</p> : null;
  return (
    <section className="section">
      <h2>Your courses</h2>
      {message && <p role="status">{message}</p>}
      <div className="course-grid">
        {mine.map((c) => {
          const st = states[c.slug];
          const l = c.lessons.find((x) => x.id === st.last);
          return (
            <Link key={c.slug} href={`/course/${c.slug}`} className="course-card">
              <Cover seed={c.slug} />
              <div className="cc-body">
                {st.bookmarked && <span className="pill" style={{ alignSelf: "flex-start" }}>Saved</span>}
                <h3>{c.title}</h3>
                <p>{l ? `Continue with: ${l.title}` : "Start this course"}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
