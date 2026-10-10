"use client";
import { useEffect, useRef, useState } from "react";
import Quiz from "./Quiz";
import Certificate from "./Certificate";
import Comments from "./Comments";
import Whiteboard from "./Whiteboard";
import Notes, { fmt } from "./Notes";
import { safeHtml } from "../../../lib/richtext";
import { supabase } from "../../../lib/supabase";

export default function Classroom({ course }) {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState([]);
  const [autoplay, setAutoplay] = useState(true);
  const [user, setUser] = useState(null);
  const [notes, setNotes] = useState([]);
  const [qtick, setQtick] = useState(0);
  const [quizOk, setQuizOk] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const cs = useRef({ bookmarked: false, last: null });
  const loaded = useRef(false);
  const player = useRef(null);
  const live = useRef({});
  const key = "progress:" + course.slug;

  useEffect(() => {
    try { setDone(JSON.parse(localStorage.getItem(key)) || []); } catch (e) {}
  }, [key]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setUser(sess?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !user) return;
    supabase.from("progress").select("lesson_id").eq("course_slug", course.slug).then(({ data }) => {
      const server = (data || []).map((r) => r.lesson_id);
      setDone((d) => [...new Set([...d, ...server])]);
      // Lessons finished before login: copy them to the account.
      let local = [];
      try { local = JSON.parse(localStorage.getItem(key)) || []; } catch (e) {}
      const valid = new Set(course.lessons.map((l) => l.id));
      const missing = local.filter((id) => valid.has(id) && !server.includes(id));
      if (missing.length) {
        supabase.from("progress").upsert(
          missing.map((id) => ({ user_id: user.id, course_slug: course.slug, lesson_id: id })),
          { onConflict: "user_id,course_slug,lesson_id" }
        ).then(() => {});
      }
    });
  }, [user, course.slug]);

  function markDone(id) {
    if (supabase && user) {
      supabase.from("progress").upsert(
        { user_id: user.id, course_slug: course.slug, lesson_id: id },
        { onConflict: "user_id,course_slug,lesson_id" }
      ).then(() => {});
    }
    setDone((d) => {
      if (d.includes(id)) return d;
      const n = [...d, id];
      try { localStorage.setItem(key, JSON.stringify(n)); } catch (e) {}
      return n;
    });
  }
  live.current = { index, autoplay, markDone };

  useEffect(() => {
    const videoId = course.lessons[index].youtubeId;
    function create() {
      if (player.current) { player.current.loadVideoById(videoId); return; }
      player.current = new window.YT.Player("yt-player", {
        videoId: course.lessons[live.current.index].youtubeId,
        width: "100%", height: "100%",
        host: "https://www.youtube-nocookie.com", // fewer cookies before the student plays
        events: {
          onStateChange: (e) => {
            if (e.data !== 0) return; // 0 means the video ended
            const s = live.current;
            s.markDone(course.lessons[s.index].id);
            if (s.autoplay && s.index < course.lessons.length - 1) setIndex(s.index + 1);
          }
        }
      });
    }
    if (window.YT && window.YT.Player) create();
    else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); create(); };
      if (!document.getElementById("yt-api")) {
        const s = document.createElement("script");
        s.id = "yt-api"; s.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(s);
      }
    }
  }, [index, course]);

  const lesson = course.lessons[index];
  const nkey = `notes:${course.slug}:${lesson.id}`;

  useEffect(() => {
    if (supabase && user) {
      supabase.from("notes").select("id,seconds,content").eq("course_slug", course.slug)
        .eq("lesson_id", lesson.id).order("seconds").then(({ data }) => setNotes(data || []));
    } else {
      try { setNotes(JSON.parse(localStorage.getItem(nkey)) || []); } catch (e) { setNotes([]); }
    }
  }, [user, nkey]);

  function saveLocal(list) {
    setNotes(list);
    try { localStorage.setItem(nkey, JSON.stringify(list)); } catch (e) {}
  }
  const getTime = () => Math.floor((player.current && player.current.getCurrentTime && player.current.getCurrentTime()) || 0);

  async function addNote(content, seconds) {
    if (supabase && user) {
      const { data } = await supabase.from("notes")
        .insert({ user_id: user.id, course_slug: course.slug, lesson_id: lesson.id, seconds, content })
        .select("id,seconds,content").single();
      if (data) setNotes((n) => [...n, data].sort((a, b) => a.seconds - b.seconds));
    } else {
      saveLocal([...notes, { id: String(Date.now()), seconds, content }].sort((a, b) => a.seconds - b.seconds));
    }
  }
  async function deleteNote(id) {
    if (supabase && user) await supabase.from("notes").delete().eq("id", id);
    if (supabase && user) setNotes((n) => n.filter((x) => x.id !== id));
    else saveLocal(notes.filter((x) => x.id !== id));
  }
  const [teacher, setTeacher] = useState(false);
  useEffect(() => {
    if (!supabase || !user) { setTeacher(false); return; }
    supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setTeacher(!!data && (data.role === "teacher" || data.role === "admin")));
  }, [user]);

  // Check if the student passed every quiz (60% or more). The certificate needs this.
  useEffect(() => {
    const need = course.lessons.filter((l) => l.quiz);
    const pass = (r) => !!r && r.total > 0 && r.score / r.total >= 0.6;
    if (!need.length) { setQuizOk(true); return; }
    if (supabase && user) {
      supabase.from("quiz_results").select("lesson_id,score,total").eq("course_slug", course.slug).then(({ data }) => {
        const m = {};
        (data || []).forEach((r) => { m[r.lesson_id] = r; });
        setQuizOk(need.every((l) => pass(m[l.id])));
      });
    } else {
      setQuizOk(need.every((l) => {
        try { return pass(JSON.parse(localStorage.getItem(`quiz:${course.slug}:${l.id}`))); } catch (e) { return false; }
      }));
    }
  }, [user, course, qtick]);

  function save(patch) {
    cs.current = { ...cs.current, ...patch };
    const st = cs.current;
    if (supabase && user) {
      supabase.from("course_state").upsert(
        { user_id: user.id, course_slug: course.slug, bookmarked: st.bookmarked, last_lesson: st.last },
        { onConflict: "user_id,course_slug" }
      ).then(() => {});
    } else {
      try { localStorage.setItem("state:" + course.slug, JSON.stringify(st)); } catch (e) {}
    }
  }

  // Save the lesson the student is on. Keep this code above the loader code.
  useEffect(() => {
    if (!loaded.current) return;
    save({ last: lesson.id });
  }, [index]);

  // Load the bookmark and the last lesson. Then open that lesson.
  useEffect(() => {
    loaded.current = false;
    function apply(st) {
      cs.current = { bookmarked: !!st.bookmarked, last: st.last || null };
      setBookmarked(!!st.bookmarked);
      const i = course.lessons.findIndex((l) => l.id === st.last);
      if (i > 0) setIndex(i);
      loaded.current = true;
    }
    if (supabase && user) {
      supabase.from("course_state").select("bookmarked,last_lesson").eq("course_slug", course.slug).maybeSingle()
        .then(({ data }) => apply({ bookmarked: data && data.bookmarked, last: data && data.last_lesson }));
    } else {
      let st = {};
      try { st = JSON.parse(localStorage.getItem("state:" + course.slug)) || {}; } catch (e) {}
      apply(st);
    }
  }, [user, course.slug]);

  function toggleBookmark() {
    const v = !bookmarked;
    setBookmarked(v);
    save({ bookmarked: v });
  }

  async function exportNotes() {
    const all = {};
    if (supabase && user) {
      const { data } = await supabase.from("notes").select("lesson_id,seconds,content").eq("course_slug", course.slug).order("seconds");
      (data || []).forEach((n) => { (all[n.lesson_id] = all[n.lesson_id] || []).push(n); });
    } else {
      course.lessons.forEach((l) => {
        try { all[l.id] = JSON.parse(localStorage.getItem(`notes:${course.slug}:${l.id}`)) || []; } catch (e) {}
      });
    }
    const esc = (t) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    let body = course.lessons.map((l, i) => {
      const ns = all[l.id] || [];
      if (!ns.length) return "";
      return `<h2>${i + 1}. ${esc(l.title)}</h2>` + ns.map((n) => `<div class="n"><b>${fmt(n.seconds)}</b>${safeHtml(n.content)}</div>`).join("");
    }).join("");
    if (!body) body = "<p>No notes yet.</p>";
    const w = window.open("", "_blank");
    if (!w) { alert("Allow pop-ups for this site. Then try again."); return; }
    w.document.write(`<html><head><title>${esc(course.title)} - My Notes</title><style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;line-height:1.5}h1{border-bottom:2px solid #333}h2{margin-top:28px}.n{margin:14px 0}.n p{margin:4px 0}blockquote{border-left:3px solid #999;margin:6px 0;padding-left:10px}code,pre{background:#eee;padding:2px 4px}</style></head><body><h1>${esc(course.title)} - My Notes</h1>${body}</body></html>`);
    w.document.close(); w.focus();
    setTimeout(() => w.print(), 400); // The student chooses "Save as PDF" in the print window
  }
  function seek(sec) {
    if (!player.current || !player.current.seekTo) return;
    player.current.seekTo(sec, true);
    player.current.playVideo();
  }
  return (
    <div className="classroom">
      <aside className="side">
        <label className="toggle">
          <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
          <span>Play All <small className="muted">(plays the next lesson by itself)</small></span>
        </label>
        {course.lessons.map((l, i) => (
          <button key={l.id} className={"lesson" + (i === index ? " active" : "")} aria-current={i === index ? "true" : undefined} onClick={() => setIndex(i)}>
            <span className="num">{i + 1}</span>
            <span className="ltitle">{l.title}</span>
            <span className={"dot" + (done.includes(l.id) ? " on" : "")}>{done.includes(l.id) ? "✓" : ""}</span>
          </button>
        ))}
      </aside>
      <section className="stage">
        <div className="titlebar">
          <h1>{course.title}</h1>
          <button className={"bm" + (bookmarked ? " on" : "")} onClick={toggleBookmark}>{bookmarked ? "🔖 Saved" : "🔖 Save course"}</button>
        </div>
        <div className="video"><div id="yt-player" /></div>
        <h2>{index + 1}. {lesson.title}</h2>
        <p className="muted">{course.lessons.filter((l) => done.includes(l.id)).length} of {course.lessons.length} lessons done{!user && supabase ? " · Log in to save your progress" : ""}</p>
        <div className="row">
          <button disabled={index === 0} onClick={() => setIndex(index - 1)}>← Previous</button>
          <button disabled={index === course.lessons.length - 1} onClick={() => setIndex(index + 1)}>Next →</button>
        </div>
        {lesson.pdf && (
          <div className="materials">
            <h3>Lesson materials</h3>
            <div className="row">
              <a className="btn" href={lesson.pdf} target="_blank" rel="noreferrer">Open full screen</a>
              <a className="btn" href={lesson.pdf} download>Download PDF</a>
            </div>
            <iframe className="pdf" src={lesson.pdf} title="Lesson PDF" />
          </div>
        )}
        <Certificate course={course} complete={course.lessons.every((l) => done.includes(l.id))} quizOk={quizOk} />
        <Whiteboard slug={course.slug} lessonId={lesson.id} user={user} canEdit={teacher} />
        {lesson.quiz && <Quiz quiz={lesson.quiz} slug={course.slug} lessonId={lesson.id} user={user} onResult={() => setQtick((t) => t + 1)} />}
        <Notes onExport={exportNotes} notes={notes} onAdd={addNote} onDelete={deleteNote} onSeek={seek} getTime={getTime} loggedIn={!!user} />
        <Comments slug={course.slug} lessonId={lesson.id} user={user} teacher={teacher} />
      </section>
    </div>
  );
}
