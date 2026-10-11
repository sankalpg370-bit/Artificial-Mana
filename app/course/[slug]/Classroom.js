"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Quiz from "./Quiz";
import Certificate from "./Certificate";
import Comments from "./Comments";
import Whiteboard from "./Whiteboard";
import Notes, { fmt } from "./Notes";
import { safeHtml } from "../../../lib/richtext";
import { backend } from "../../../lib/backend";

export default function Classroom({ course }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!backend);
  useEffect(() => {
    if (!backend) return;
    let active = true;
    let authChanged = false;
    backend.auth.getSession().then(({ data, error }) => {
      if (!active || authChanged) return;
      if (error) console.error("Unable to check the current session.", error);
      setUser(data?.session?.user ?? null);
      setAuthReady(true);
    }).catch((error) => {
      if (!active || authChanged) return;
      console.error("Unable to check the current session.", error);
      setAuthReady(true);
    });
    const { data: sub } = backend.auth.onAuthStateChange((_e, sess) => {
      authChanged = true;
      if (!active) return;
      setUser(sess?.user ?? null);
      setAuthReady(true);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  if (!authReady) return <div className="wrap" role="status">Loading your classroom...</div>;
  // Remount account-owned state on account/course changes so old requests cannot leak into a new session.
  return <ClassroomContent key={`${course.slug}:${user?.id || "guest"}`} course={course} user={user} />;
}

function ClassroomContent({ course, user }) {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState([]);
  const [autoplay, setAutoplay] = useState(true);
  const [notes, setNotes] = useState([]);
  const [qtick, setQtick] = useState(0);
  const [quizOk, setQuizOk] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [teacher, setTeacher] = useState(false);
  const [tab, setTab] = useState("notes");
  const [creatorMaterials, setCreatorMaterials] = useState([]);
  const [materialsError, setMaterialsError] = useState("");
  const [stateReady, setStateReady] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [videoError, setVideoError] = useState("");
  const cs = useRef({ bookmarked: false, last: null });
  const player = useRef(null);
  const playerHost = useRef(null);
  const playerReady = useRef(false);
  const live = useRef({});
  const key = "progress:" + course.slug;

  useEffect(() => {
    if (!backend || !user) {
      try { const saved = JSON.parse(localStorage.getItem(key)); setDone(Array.isArray(saved) ? saved : []); } catch (error) {
        console.error("Unable to load local lesson progress.", error);
        setDone([]);
      }
      return;
    }
    setDone([]);
    let active = true;
    backend.from("progress").select("lesson_id").eq("user_id", user.id).eq("course_slug", course.slug)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Unable to load account lesson progress.", error);
          setDone([]);
          return;
        }
        setDone((current) => [...new Set([...current, ...(data || []).map((row) => row.lesson_id)])]);
      })
      .catch((error) => {
        if (!active) return;
        console.error("Unable to load account lesson progress.", error);
        setDone([]);
      });
    return () => { active = false; };
  }, [key, user, course.slug]);

  function markDone(id) {
    if (backend && user) {
      backend.from("progress").upsert(
        { user_id: user.id, course_slug: course.slug, lesson_id: id },
        { onConflict: "user_id,course_slug,lesson_id" }
      ).then(({ error }) => {
        if (error) { console.error("Unable to save account lesson progress.", error); setSaveError("Lesson progress could not be saved. Replay the lesson to retry."); }
      }).catch(() => setSaveError("Lesson progress could not be saved. Replay the lesson to retry."));
    }
    setDone((d) => {
      if (d.includes(id)) return d;
      const n = [...d, id];
      if (!backend || !user) {
        try { localStorage.setItem(key, JSON.stringify(n)); } catch (error) {
          console.error("Unable to save local lesson progress.", error);
          setSaveError("Your browser could not save lesson progress. Check your storage settings.");
        }
      }
      return n;
    });
  }
  live.current = { index, autoplay, markDone };

  useEffect(() => {
    let active = true;
    const host = playerHost.current;
    let timeout;
    let script;
    const previous = window.onYouTubeIframeAPIReady;
    function create() {
      if (!active || player.current) return;
      clearTimeout(timeout);
      // YouTube replaces its target node. Recreate it after Strict Mode cleanup.
      const target = document.createElement("div");
      host.replaceChildren(target);
      const initialVideoId = course.lessons[live.current.index].youtubeId;
      player.current = new window.YT.Player(target, {
        videoId: initialVideoId,
        width: "100%", height: "100%",
        host: "https://www.youtube-nocookie.com",
        events: {
          onReady: (event) => {
            if (!active) return;
            playerReady.current = true;
            const videoId = course.lessons[live.current.index].youtubeId;
            if (videoId !== initialVideoId) event.target.loadVideoById(videoId);
          },
          onError: () => { if (active) setVideoError("This video is unavailable. Try another lesson or reload the page."); },
          onStateChange: (event) => {
            if (!active || event.data !== 0) return;
            const current = live.current;
            const playingId = event.target?.getVideoData?.().video_id;
            if (playingId && playingId !== course.lessons[current.index].youtubeId) return;
            current.markDone(course.lessons[current.index].id);
            if (current.autoplay && current.index < course.lessons.length - 1) setIndex(current.index + 1);
          },
        },
      });
    }
    const ready = () => { if (previous) previous(); create(); };
    const fail = () => { if (active) setVideoError("The video player could not load. Check your connection and reload the page."); };
    if (window.YT?.Player) create();
    else {
      window.onYouTubeIframeAPIReady = ready;
      script = document.getElementById("yt-api");
      if (!script) {
        script = document.createElement("script");
        script.id = "yt-api";
        script.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(script);
      }
      script.addEventListener("error", fail);
      timeout = setTimeout(fail, 15000);
    }
    // Navigation and Strict Mode must release the iframe and its global callback.
    return () => {
      active = false;
      clearTimeout(timeout);
      script?.removeEventListener("error", fail);
      if (window.onYouTubeIframeAPIReady === ready) window.onYouTubeIframeAPIReady = previous;
      playerReady.current = false;
      player.current?.destroy();
      player.current = null;
      host?.replaceChildren();
    };
  }, [course]);

  useEffect(() => {
    setVideoError("");
    if (playerReady.current) player.current?.loadVideoById(course.lessons[index].youtubeId);
  }, [index, course]);

  const lesson = course.lessons[index];
  const visibleMaterials = creatorMaterials.filter((material) => !material.lesson_id || material.lesson_id === lesson.id);
  const nkey = `notes:${course.slug}:${lesson.id}`;

  const noteContext = useRef(nkey);
  noteContext.current = nkey;
  useEffect(() => {
    let active = true;
    setNotes([]);
    if (backend && user) {
      backend.from("notes").select("id,seconds,content").eq("user_id", user.id).eq("course_slug", course.slug)
        .eq("lesson_id", lesson.id).order("seconds").then(({ data, error }) => {
          if (error) throw error;
          if (active) setNotes(data || []);
        }).catch(() => { if (active) setSaveError("Your notes could not be loaded. Refresh to retry."); });
    } else {
      try {
        const saved = JSON.parse(localStorage.getItem(nkey));
        setNotes(Array.isArray(saved) ? saved : []);
      } catch { setSaveError("Your browser could not load saved notes."); }
    }
    return () => { active = false; };
  }, [user, nkey, course.slug, lesson.id]);

  function saveLocal(list) {
    // Persist first: callers retain their drafts if storage is blocked or full.
    localStorage.setItem(nkey, JSON.stringify(list));
    setNotes(list);
  }
  const getTime = () => Math.floor(player.current?.getCurrentTime?.() || 0);

  async function addNote(content, seconds) {
    const context = nkey;
    if (backend && user) {
      const { data, error } = await backend.from("notes")
        .insert({ user_id: user.id, course_slug: course.slug, lesson_id: lesson.id, seconds, content })
        .select("id,seconds,content").single();
      if (error || !data) throw error || new Error("No saved note was returned.");
      if (noteContext.current === context) setNotes((current) => [...current, data].sort((a, b) => a.seconds - b.seconds));
    } else {
      saveLocal([...notes, { id: crypto.randomUUID(), seconds, content }].sort((a, b) => a.seconds - b.seconds));
    }
  }
  async function deleteNote(id) {
    const context = nkey;
    if (backend && user) {
      const { error } = await backend.from("notes").delete().eq("user_id", user.id).eq("id", id);
      if (error) throw error;
      if (noteContext.current === context) setNotes((current) => current.filter((note) => note.id !== id));
    } else saveLocal(notes.filter((note) => note.id !== id));
  }
  useEffect(() => {
    if (!backend || !user) { setTeacher(false); return; }
    let active = true;
    backend.from("profiles").select("role").eq("user_id", user.id).maybeSingle()
      .then(({ data, error }) => { if (active) setTeacher(!error && !!data && (data.role === "teacher" || data.role === "admin")); })
      .catch(() => { if (active) setTeacher(false); });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!backend) {
      setCreatorMaterials([]);
      setMaterialsError("");
      return;
    }
    let active = true;
    backend.from("creator_materials")
      .select("id,lesson_id,kind,title,content,url,file_url,storage_path")
      .eq("course_slug", course.slug)
      .eq("published", true)
      .order("created_at")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Unable to load published creator materials.", error);
          setMaterialsError("Course materials are temporarily unavailable.");
          return;
        }
        Promise.allSettled((data || []).map(async (material) => {
          if (!material.storage_path) return material;
          const { data: file, error: fileError } = await backend.storage
            .from("creator-materials").createSignedUrl(material.storage_path, 3600);
          if (fileError) throw fileError;
          return { ...material, signed_file_url: file.signedUrl };
        })).then((results) => {
          if (!active) return;
          // One inaccessible upload must not hide every other signed file.
          setCreatorMaterials(results.map((result, index) => result.status === "fulfilled" ? result.value : data[index]));
          setMaterialsError(results.some((result) => result.status === "rejected") ? "Some course files are temporarily unavailable." : "");
        }).catch((fileError) => {
          if (!active) return;
          console.error("Unable to create access links for creator materials.", fileError);
          setCreatorMaterials(data || []);
          setMaterialsError("Some course files are temporarily unavailable.");
        });
      })
      .catch((error) => {
        if (!active) return;
        console.error("Unable to load published creator materials.", error);
        setMaterialsError("Course materials are temporarily unavailable.");
      });
    return () => { active = false; };
  }, [course.slug, user]);

  // Check if the student passed every quiz (60% or more). The certificate needs this.
  useEffect(() => {
    let active = true;
    const need = course.lessons.filter((l) => l.quiz?.length);
    const pass = (r) => !!r && r.total > 0 && r.score / r.total >= 0.6;
    if (!need.length) { setQuizOk(true); return; }
    if (backend && user) {
      setQuizOk(false);
      backend.from("quiz_results").select("lesson_id,score,total").eq("user_id", user.id).eq("course_slug", course.slug).then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        const m = {};
        (data || []).forEach((r) => { m[r.lesson_id] = r; });
        setQuizOk(need.every((l) => pass(m[l.id])));
      }).catch(() => { if (active) setQuizOk(false); });
    } else {
      setQuizOk(need.every((l) => {
        try { return pass(JSON.parse(localStorage.getItem(`quiz:${course.slug}:${l.id}`))); } catch (e) { return false; }
      }));
    }
    return () => { active = false; };
  }, [user, course, qtick]);

  const save = useCallback((patch) => {
    cs.current = { ...cs.current, ...patch };
    const st = cs.current;
    if (backend && user) {
      backend.from("course_state").upsert(
        { user_id: user.id, course_slug: course.slug, bookmarked: st.bookmarked, last_lesson: st.last },
        { onConflict: "user_id,course_slug" }
      ).then(({ error }) => { if (error) throw error; }).catch(() => setSaveError("Your course bookmark or last lesson could not be saved. Try again."));
    } else {
      try { localStorage.setItem("state:" + course.slug, JSON.stringify(st)); } catch { setSaveError("Your browser could not save this course. Check your storage settings."); }
    }
  }, [course.slug, user]);

  // Save the lesson the student is on. Keep this code above the loader code.
  useEffect(() => {
    if (!stateReady) return;
    save({ last: lesson.id });
  }, [lesson.id, save, stateReady]);

  // Load the bookmark and the last lesson. Then open that lesson.
  useEffect(() => {
    let active = true;
    setStateReady(false);
    cs.current = { bookmarked: false, last: null };
    setBookmarked(false);
    function apply(st) {
      if (!active) return;
      cs.current = { bookmarked: !!st.bookmarked, last: st.last || null };
      setBookmarked(!!st.bookmarked);
      const i = course.lessons.findIndex((l) => l.id === st.last);
      setIndex(Math.max(0, i));
      setStateReady(true);
    }
    if (backend && user) {
      backend.from("course_state").select("bookmarked,last_lesson")
        .eq("user_id", user.id).eq("course_slug", course.slug).maybeSingle()
        .then(({ data, error }) => {
          if (error) throw error;
          apply({ bookmarked: data?.bookmarked, last: data?.last_lesson });
        }).catch(() => { if (active) setSaveError("Your course state could not be loaded. Refresh before saving changes."); });
    } else {
      let st = {};
      try { st = JSON.parse(localStorage.getItem("state:" + course.slug)) || {}; } catch (e) {}
      apply(st);
    }
    return () => { active = false; };
  }, [user, course.slug, course.lessons]);

  function toggleBookmark() {
    const v = !bookmarked;
    setBookmarked(v);
    save({ bookmarked: v });
  }

  async function exportNotes() {
    const all = {};
    if (backend && user) {
      const { data, error } = await backend.from("notes").select("lesson_id,seconds,content")
        .eq("user_id", user.id).eq("course_slug", course.slug).order("seconds");
      if (error) {
        console.error("Unable to export your saved notes.", error);
        alert("Your notes could not be loaded for export. Please try again.");
        return;
      }
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
  const doneCount = course.lessons.filter((l) => done.includes(l.id)).length;
  const pct = Math.round((doneCount / course.lessons.length) * 100);
  const hasMaterials = !!lesson.pdf || visibleMaterials.length > 0 || !!materialsError;
  const tabs = [
    ["notes", "Notes"],
    ...(lesson.quiz ? [["quiz", "Quiz"]] : []),
    ...(hasMaterials ? [["materials", "Materials"]] : []),
    ["boards", "Boards"],
    ["questions", "Questions"],
  ];
  const active = tabs.some((t) => t[0] === tab) ? tab : "notes";

  return (
    <div>
      <div className="c-head">
        <div className="container">
          <nav className="crumbs" aria-label="Breadcrumb"><Link href="/#courses">Courses</Link><span aria-hidden="true">/</span><span>{course.title}</span></nav>
          <div className="c-title">
            <div>
              <h1>{course.title}</h1>
              {course.description && <p className="muted">{course.description}</p>}
            </div>
            <button disabled={!stateReady} className={"bm" + (bookmarked ? " on" : "")} onClick={toggleBookmark}>{bookmarked ? "🔖 Saved" : "🔖 Save course"}</button>
          </div>
          <div className="progress">
            <div className="bar" role="progressbar" aria-label="Course progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><span style={{ width: pct + "%" }} /></div>
            <span className="muted">{`${doneCount} of ${course.lessons.length} lessons done`}{!user && backend ? " · Log in to save your progress" : ""}</span>
          </div>
          {saveError && <p role="alert">{saveError}</p>}
          <Certificate course={course} complete={course.lessons.every((l) => done.includes(l.id))} quizOk={quizOk} />
        </div>
      </div>
      <div className="container c-layout">
        <section className="c-main">
          <div className="video"><div ref={playerHost} style={{ width: "100%", height: "100%" }} /></div>
          {videoError && <p role="alert">{videoError} <button type="button" onClick={() => window.location.reload()}>Reload</button></p>}
          <div className="player-row">
            <h2>{index + 1}. {lesson.title}</h2>
            <div className="row">
              <button className="alt" disabled={index === 0} onClick={() => setIndex(index - 1)}>← Previous</button>
              <button disabled={index === course.lessons.length - 1} onClick={() => setIndex(index + 1)}>Next →</button>
            </div>
          </div>
          <div className="tabs" role="tablist" aria-label="Lesson tools">
            {tabs.map(([id, label]) => (
              <button key={id} id={`lesson-tab-${id}`} role="tab" aria-controls={`lesson-panel-${id}`} aria-selected={active === id} tabIndex={active === id ? 0 : -1}
                onKeyDown={(event) => {
                  const current = tabs.findIndex(([value]) => value === id);
                  const next = event.key === "ArrowRight" ? (current + 1) % tabs.length
                    : event.key === "ArrowLeft" ? (current - 1 + tabs.length) % tabs.length
                    : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
                  if (next < 0) return;
                  event.preventDefault();
                  setTab(tabs[next][0]);
                  document.getElementById(`lesson-tab-${tabs[next][0]}`)?.focus();
                }} className={"tab" + (active === id ? " on" : "")} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>
          <div role="tabpanel" id="lesson-panel-notes" aria-labelledby="lesson-tab-notes" hidden={active !== "notes"}>
            <Notes key={nkey} onExport={exportNotes} notes={notes} onAdd={addNote} onDelete={deleteNote} onSeek={seek} getTime={getTime} loggedIn={!!user} />
          </div>
          {lesson.quiz && (
            <div role="tabpanel" id="lesson-panel-quiz" aria-labelledby="lesson-tab-quiz" hidden={active !== "quiz"}>
              <Quiz key={lesson.id} quiz={lesson.quiz} slug={course.slug} lessonId={lesson.id} user={user} onResult={() => setQtick((t) => t + 1)} />
            </div>
          )}
          {hasMaterials && (
            <div role="tabpanel" id="lesson-panel-materials" aria-labelledby="lesson-tab-materials" hidden={active !== "materials"}>
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
              {(visibleMaterials.length > 0 || materialsError) && (
                <div className="materials">
                  <h3>Creator materials</h3>
                  {materialsError && <p className="muted" role="status">{materialsError}</p>}
                  {visibleMaterials.map((material) => (
                    <article className="panel" key={material.id}>
                      <p className="muted">{material.kind[0].toUpperCase() + material.kind.slice(1)}</p>
                      <h4>{material.title}</h4>
                      {material.content && <p className="creator-content">{material.content}</p>}
                      <div className="row">
                        {material.url && <a className="btn" href={material.url} target="_blank" rel="noopener noreferrer">Open link</a>}
                        {(material.signed_file_url || material.file_url) && <a className="btn" href={material.signed_file_url || material.file_url} target="_blank" rel="noopener noreferrer">Open file</a>}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
          <div role="tabpanel" id="lesson-panel-boards" aria-labelledby="lesson-tab-boards" hidden={active !== "boards"}>
            <Whiteboard key={lesson.id} slug={course.slug} lessonId={lesson.id} user={user} canEdit={teacher} />
          </div>
          <div role="tabpanel" id="lesson-panel-questions" aria-labelledby="lesson-tab-questions" hidden={active !== "questions"}>
            <Comments key={lesson.id} slug={course.slug} lessonId={lesson.id} user={user} teacher={teacher} />
          </div>
        </section>
        <aside className="c-side" aria-label="Lessons">
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
      </div>
    </div>
  );
}
