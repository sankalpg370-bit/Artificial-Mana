"use client";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { backend } from "../../lib/backend";
import AdminControlCenter from "./AdminControlCenter";
import { getYouTubeVideoId } from "../../lib/youtube";

const slugify = (t) => t.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const emptyQ = () => ({ q: "", options: ["", "", "", ""], answer: 0 });

export default function Admin() {
  const router = useRouter();
  const [user, setUser] = useState(undefined);
  const [role, setRole] = useState(null);
  const [courses, setCourses] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [msg, setMsg] = useState("");
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [courseLoadError, setCourseLoadError] = useState("");
  const [authError, setAuthError] = useState("");
  const [nc, setNc] = useState({ title: "", description: "", category: "" });

  useEffect(() => {
    if (!backend) { setUser(null); return; }
    let active = true;
    let authChanged = false;
    backend.auth.getSession()
      .then(({ data, error }) => {
        if (!active || authChanged) return;
        if (error) throw error;
        if (active) setUser(data.session?.user ?? null);
      })
      .catch((error) => {
        console.error("Unable to check the admin sign-in.", error);
        if (active) {
          setAuthError("Unable to check your sign-in. Refresh the page or try again.");
          setUser(null);
        }
      });
    const { data: subscription } = backend.auth.onAuthStateChange((_event, session) => {
      authChanged = true;
      if (active) { setUser(session?.user ?? null); setRole(null); }
    });
    return () => { active = false; subscription.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!backend || !user) return;
    let active = true;
    setRole(null);
    backend.from("profiles").select("role").eq("user_id", user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Unable to verify the admin role.", error);
          setMsg("Unable to verify your admin role. Check your connection and try again.");
          setRole("error");
          return;
        }
        setRole(data ? data.role : "student");
      })
      .catch((error) => {
        if (!active) return;
        console.error("Unable to verify the admin role.", error);
        setMsg("Unable to verify your admin role. Check your connection and try again.");
        setRole("error");
      });
    return () => { active = false; };
  }, [user]);

  async function reload() {
    setLoadingCourses(true);
    setCourseLoadError("");
    try {
      const [c, l] = await Promise.all([
        backend.from("courses").select("*").order("created_at"),
        backend.from("lessons").select("*").order("position"),
      ]);
      if (c.error || l.error) throw c.error || l.error;
      setCourses(c.data || []);
      setLessons(l.data || []);
    } catch (error) {
      console.error("Unable to load admin courses.", error);
      setCourses([]);
      setLessons([]);
      setCourseLoadError("Could not load courses. Check your connection and try again.");
    } finally {
      setLoadingCourses(false);
    }
  }
  const isTeacher = role === "teacher" || role === "admin";
  useEffect(() => { if (isTeacher) reload(); }, [isTeacher]);

  async function addCourse() {
    try {
      const slug = slugify(nc.title);
      if (!slug) { setMsg("Write a title for the course."); return; }
      const { error } = await backend.from("courses").insert({
        slug, title: nc.title.trim(), description: nc.description.trim(), category: nc.category.trim() || null, published: false });
      if (error) { setMsg(error.message); return; }
      setNc({ title: "", description: "", category: "" }); setMsg("Course made. Add lessons. Then publish it."); reload();
    } catch (error) {
      console.error("Admin action failed.", error);
      setMsg("Could not complete this action. Check your connection and try again.");
    }
  }
  async function togglePublish(c) {
    try {
      if (!c.published && !lessons.some((lesson) => lesson.course_slug === c.slug)) {
        setMsg("Add at least one lesson before publishing this course.");
        return;
      }
      const { error } = await backend.from("courses").update({ published: !c.published }).eq("slug", c.slug);
      if (error) setMsg(error.message); else reload();
    } catch (error) {
      console.error("Admin action failed.", error);
      setMsg("Could not complete this action. Check your connection and try again.");
    }
  }
  async function deleteCourse(c) {
    try {
      if (!window.confirm(`Delete the course "${c.title}" and all its lessons?`)) return;
      const { error } = await backend.from("courses").delete().eq("slug", c.slug);
      if (error) setMsg(error.message); else reload();
    } catch (error) {
      console.error("Admin action failed.", error);
      setMsg("Could not complete this action. Check your connection and try again.");
    }
  }
  async function lockPortal() {
    try {
      const response = await fetch("/api/admin-access", { method: "DELETE" });
      if (!response.ok) {
        setMsg("Could not lock the temporary admin portal. Close this browser tab and try again.");
        return;
      }
      router.replace("/admin/access");
    } catch {
      setMsg("Could not reach the admin access service. Try again.");
    }
  }

  if (user === undefined) return <div className="wrap" role="status"><p className="muted">Checking sign-in...</p></div>;
  if (authError) return <div className="wrap"><h1>Admin</h1><p role="alert">{authError}</p><Link className="btn" href="/login?next=%2Fadmin">Sign in</Link></div>;
  if (!backend) return <div className="wrap"><p role="alert">Accounts are disabled in this browser-only demo.</p></div>;
  if (!user) return <div className="wrap"><h1>Admin</h1><p><Link href="/login?next=%2Fadmin">Log in to your admin account</Link></p></div>;
  if (role === null) return <div className="wrap"><p className="muted">Loading...</p></div>;
  if (role === "error") return <div className="wrap"><h1>Admin</h1><p role="alert">{msg}</p></div>;
  if (!isTeacher) return <div className="wrap"><h1>Admin</h1><p>This page is for teachers only.</p></div>;

  return (
    <div className="wrap">
      <h1>Manage courses</h1>
      <p className="muted">Create and edit courses, add video lessons, PDFs, and quizzes, then publish when ready.</p>
      <p><Link className="btn" href="/creator-studio">Open Creator Studio</Link></p>
      <p><button className="alt" type="button" onClick={lockPortal}>Lock temporary admin access</button></p>
      <p className="muted">Changes show on the public site in about 1 minute.</p>
      {msg && <p className="notice" role="status" aria-live="polite">{msg}</p>}

      {role === "admin" && <AdminControlCenter key={user.id} />}

      <div className="panel">
        <h2>New course</h2>
        <div className="form">
          <label htmlFor="new-course-title">Title</label>
          <input id="new-course-title" placeholder="Title" value={nc.title} onChange={(e) => setNc({ ...nc, title: e.target.value })} />
          <label htmlFor="new-course-description">Short description</label>
          <input id="new-course-description" placeholder="Short description" value={nc.description} onChange={(e) => setNc({ ...nc, description: e.target.value })} />
          <label htmlFor="new-course-category">Category</label>
          <input id="new-course-category" placeholder="Category (for example: Basics)" value={nc.category} onChange={(e) => setNc({ ...nc, category: e.target.value })} />
          <div className="row"><button onClick={addCourse}>Make course</button></div>
        </div>
      </div>

      {loadingCourses && <p className="muted" role="status">Loading courses...</p>}
      {courseLoadError && <p className="notice" role="alert">{courseLoadError} <button className="alt" type="button" onClick={reload}>Try again</button></p>}
      {courses.map((c) => (
        <CourseEditor key={c.slug} course={c} lessons={lessons.filter((l) => l.course_slug === c.slug)}
          onPublish={() => togglePublish(c)} onDelete={() => deleteCourse(c)} reload={reload} setMsg={setMsg} />
      ))}
      {!loadingCourses && !courseLoadError && !courses.length && <p className="muted">No courses yet. Make your first course above.</p>}
    </div>
  );
}

function LessonForm({ course, lessons, initial, onDone, setMsg, onCancel }) {
  const edit = !!initial;
  const formId = useId();
  const [showPreview, setShowPreview] = useState(false);
  const [title, setTitle] = useState(initial ? initial.title : "");
  const [link, setLink] = useState(initial ? initial.youtube_id : "");
  const videoId = getYouTubeVideoId(link);
  const [file, setFile] = useState(null);
  const [removePdf, setRemovePdf] = useState(false);
  const [quiz, setQuiz] = useState(initial && initial.quiz
    ? initial.quiz.map((q) => ({ q: q.q, options: [...q.options, "", "", "", ""].slice(0, Math.max(4, q.options.length)), answer: q.answer }))
    : []);
  const [busy, setBusy] = useState(false);
  const setQ = (i, patch) => setQuiz(quiz.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  async function save() {
    try {
      const id = getYouTubeVideoId(link);
      if (!title.trim() || !id) { setMsg("Write a title and a valid YouTube link."); return; }
      const cleanQuiz = [];
      for (const q of quiz) {
        if (!q.q.trim()) continue;
        const opts = q.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
        const answer = opts.findIndex((x) => x.i === q.answer);
        if (opts.length < 2 || answer < 0) { setMsg("Each quiz question needs 2 or more options and a right answer."); return; }
        cleanQuiz.push({ q: q.q.trim(), options: opts.map((x) => x.o), answer });
      }
      setBusy(true);
      let pdf_url = edit && !removePdf ? initial.pdf_url : null;
      if (file) {
        const path = `${course.slug}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const up = await backend.storage.from("lesson-pdfs").upload(path, file, { contentType: "application/pdf" });
        if (up.error) { setMsg(up.error.message); setBusy(false); return; }
        pdf_url = backend.storage.from("lesson-pdfs").getPublicUrl(path).data.publicUrl;
      }
      const row = { title: title.trim(), youtube_id: id, pdf_url, quiz: cleanQuiz.length ? cleanQuiz : null };
      const res = edit
        ? await backend.from("lessons").update(row).eq("id", initial.id)
        : await backend.from("lessons").insert({ ...row, course_slug: course.slug, position: lessons.reduce((m, l) => Math.max(m, l.position), 0) + 1 });
      setBusy(false);
      if (res.error) { setMsg(res.error.message); return; }
      setMsg(edit ? "Lesson saved." : "Lesson added.");
      onDone();
    } catch (error) {
      console.error("Admin action failed.", error);
      setMsg("Could not complete this action. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  return (
    <div className="form">
      <label htmlFor={`${formId}-title`}>Lesson title</label>
      <input id={`${formId}-title`} placeholder="Lesson title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <label htmlFor={`${formId}-video`}>YouTube video link</label>
      <input id={`${formId}-video`} aria-describedby={`${formId}-help`} placeholder="Paste a YouTube link or video ID" value={link} onChange={(e) => { setLink(e.target.value); setShowPreview(false); }} />
      <p id={`${formId}-help`} className="muted">Paste a YouTube watch, share, Shorts, or live video link. The video plays inside the course. The owner must allow embedding.</p>
      {link.trim() && !videoId && <p role="alert">Enter a valid YouTube video link or 11-character video ID.</p>}
      {videoId && <button className="alt" type="button" aria-expanded={showPreview} onClick={() => setShowPreview(!showPreview)}>{showPreview ? "Hide video preview" : "Preview video"}</button>}
      {showPreview && videoId && <iframe
        title={`Video preview: ${title.trim() || "New lesson"}`}
        src={`https://www.youtube-nocookie.com/embed/${videoId}`}
        style={{ width: "100%", maxWidth: 720, aspectRatio: "16 / 9", border: 0 }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />}
      <label className="muted">{edit && initial.pdf_url ? "Replace the PDF file" : "PDF file (optional)"} <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0] || null)} /></label>
      {edit && initial.pdf_url && (
        <label className="muted"><input type="checkbox" checked={removePdf} onChange={(e) => setRemovePdf(e.target.checked)} /> Remove the current PDF</label>
      )}
      {quiz.map((q, i) => (
        <div key={i} className="q">
          <input placeholder={`Question ${i + 1}`} value={q.q} onChange={(e) => setQ(i, { q: e.target.value })} />
          {q.options.map((o, j) => (
            <label key={j} className="opt">
              <input type="radio" name={`${course.slug}-${edit ? initial.id : "new"}-a${i}`} checked={q.answer === j} onChange={() => setQ(i, { answer: j })} />
              <input placeholder={`Option ${j + 1}`} value={o}
                onChange={(e) => setQ(i, { options: q.options.map((x, k) => (k === j ? e.target.value : x)) })} />
            </label>
          ))}
          <div className="row">
            <span className="muted">Choose the round button of the right answer.</span>
            <button className="alt" onClick={() => setQuiz(quiz.filter((_, j) => j !== i))}>Remove question</button>
          </div>
        </div>
      ))}
      <div className="row">
        <button className="alt" onClick={() => setQuiz([...quiz, emptyQ()])}>Add quiz question</button>
        <button disabled={busy || !title.trim() || !videoId} onClick={save}>{busy ? "Saving..." : edit ? "Save lesson" : "Add lesson"}</button>
        {onCancel && <button className="alt" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}

function CourseEditor({ course, lessons, onPublish, onDelete, reload, setMsg }) {
  const publicationHintId = useId();
  const [editLesson, setEditLesson] = useState(null);
  const [ed, setEd] = useState(false);
  const [d, setD] = useState({ title: course.title, description: course.description || "", category: course.category || "" });

  async function saveDetails() {
    try {
      if (!d.title.trim()) { setMsg("The course needs a title."); return; }
      const { error } = await backend.from("courses").update({
        title: d.title.trim(), description: d.description.trim(), category: d.category.trim() || null }).eq("slug", course.slug);
      if (error) { setMsg(error.message); return; }
      setEd(false); setMsg("Course saved."); reload();
    } catch (error) {
      console.error("Admin action failed.", error);
      setMsg("Could not complete this action. Check your connection and try again.");
    }
  }
  async function removeLesson(l) {
    try {
      const returnsToDraft = course.published && lessons.length === 1;
      if (!window.confirm(`Delete the lesson "${l.title}"?${returnsToDraft ? " This is the last lesson, so the course will return to draft." : ""}`)) return;
      const { error } = await backend.from("lessons").delete().eq("id", l.id);
      if (error) setMsg(error.message);
      else {
        setMsg(returnsToDraft ? "Lesson deleted. The empty course is now a draft." : "Lesson deleted.");
        reload();
      }
    } catch (error) {
      console.error("Admin action failed.", error);
      setMsg("Could not complete this action. Check your connection and try again.");
    }
  }
  async function move(i, dir) {
    try {
      const a = lessons[i], b = lessons[i + dir];
      if (!a || !b) return;
      const first = await backend.from("lessons").update({ position: b.position }).eq("id", a.id);
      if (first.error) throw first.error;
      const second = await backend.from("lessons").update({ position: a.position }).eq("id", b.id);
      if (second.error) {
        // Best-effort rollback keeps a failed reorder from silently duplicating positions.
        await backend.from("lessons").update({ position: a.position }).eq("id", a.id);
        throw second.error;
      }
      reload();
    } catch (error) {
      console.error("Admin action failed.", error);
      setMsg("Could not complete this action. Check your connection and try again.");
    }
  }

  return (
    <div className="panel">
      <div className="titlebar">
        <h2 style={{ margin: 0 }}>{course.title} <span className="muted">({course.published ? "Published" : "Draft"})</span></h2>
        <div className="wb-bar">
          <button className="tb" onClick={() => setEd(!ed)}>{ed ? "Close" : "Edit details"}</button>
          <button className="tb on" onClick={onPublish} disabled={!course.published && lessons.length === 0}
            aria-describedby={!course.published && lessons.length === 0 ? publicationHintId : undefined}>{course.published ? "Unpublish" : "Publish"}</button>
          <button className="tb" onClick={onDelete}>Delete course</button>
        </div>
      </div>
      {!course.published && lessons.length === 0 && <p className="muted" id={publicationHintId}>Add at least one lesson before publishing this course.</p>}
      {ed && (
        <div className="form" style={{ marginBottom: 16 }}>
          <input placeholder="Title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
          <input placeholder="Short description" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
          <input placeholder="Category" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })} />
          <div className="row"><button onClick={saveDetails}>Save details</button></div>
        </div>
      )}
      {lessons.map((l, i) =>
        editLesson === l.id ? (
          <div key={l.id} className="q">
            <LessonForm course={course} lessons={lessons} initial={l} setMsg={setMsg}
              onDone={() => { setEditLesson(null); reload(); }} onCancel={() => setEditLesson(null)} />
          </div>
        ) : (
          <div key={l.id} className="note">
            <span className="num">{i + 1}</span>
            <p>{l.title}{l.pdf_url ? " · PDF" : ""}{l.quiz ? ` · quiz (${l.quiz.length})` : ""}</p>
            <button className="del" onClick={() => setEditLesson(l.id)}>Edit</button>
            <button className="del" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
            <button className="del" disabled={i === lessons.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
            <button className="del" onClick={() => removeLesson(l)} aria-label="Delete lesson">✕</button>
          </div>
        )
      )}
      <h3>Add a lesson</h3>
      <LessonForm key={lessons.length} course={course} lessons={lessons} setMsg={setMsg} onDone={reload} />
    </div>
  );
}
