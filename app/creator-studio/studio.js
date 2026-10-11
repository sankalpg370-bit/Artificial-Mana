"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

const RESOURCE_TYPES = [
  ["link", "Link"],
  ["assignment", "Assignment"],
  ["note", "Note"],
  ["file", "File"],
  ["other", "Other"],
];
const MAX_FILE_SIZE = 25 * 1024 * 1024;

function emptyForm() {
  return {
    id: null,
    kind: "link",
    title: "",
    content: "",
    url: "",
    course_slug: "",
    lesson_id: "",
    published: false,
    file: null,
    file_url: "",
    storage_path: "",
  };
}

function errorMessage(error) {
  return error?.message || "An unexpected error occurred. Please try again.";
}

export default function CreatorStudio() {
  const [user, setUser] = useState(undefined);
  const [role, setRole] = useState(null);
  const [courses, setCourses] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [resources, setResources] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setUser(null);
      return;
    }
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        setUser(data.session?.user ?? null);
      })
      .catch((error) => {
        console.error("Unable to check creator sign-in.", error);
        setUser(null);
        setMessage(`Unable to check sign-in: ${errorMessage(error)}`);
      });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !user) {
      setRole(null);
      return;
    }
    let active = true;
    supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setMessage(`Unable to verify creator access: ${error.message}`);
          setRole("unauthorized");
          return;
        }
        setRole(data?.role || "student");
      })
      .catch((error) => {
        if (!active) return;
        console.error("Unable to verify creator access.", error);
        setMessage(`Unable to verify creator access: ${errorMessage(error)}`);
        setRole("unauthorized");
      });
    return () => { active = false; };
  }, [user]);

  async function reload() {
    setLoading(true);
    try {
      const [courseResult, lessonResult, resourceResult] = await Promise.all([
        supabase.from("courses").select("slug,title").order("created_at"),
        supabase.from("lessons").select("id,course_slug,title").order("position"),
        supabase.from("creator_materials").select("*").order("created_at"),
      ]);
      const failed = [courseResult, lessonResult, resourceResult].find((result) => result.error);
      if (failed) throw new Error(failed.error.message);
      setCourses(courseResult.data || []);
      setLessons(lessonResult.data || []);
      const resourcesWithFiles = await Promise.all((resourceResult.data || []).map(async (resource) => {
        if (!resource.storage_path) return resource;
        const { data, error } = await supabase.storage.from("creator-materials")
          .createSignedUrl(resource.storage_path, 3600);
        if (error) throw new Error(error.message);
        return { ...resource, signed_file_url: data.signedUrl };
      }));
      setResources(resourcesWithFiles);
      return true;
    } catch (error) {
      console.error("Unable to load creator materials.", error);
      setMessage(`Could not load creator materials: ${errorMessage(error)}. Make sure the creator materials database setup has been applied.`);
      return false;
    } finally {
      setLoading(false);
    }
  }

  const isCreator = role === "teacher" || role === "admin";

  useEffect(() => {
    if (isCreator) reload();
  }, [isCreator]);

  const formLessons = useMemo(
    () => lessons.filter((lesson) => lesson.course_slug === form.course_slug),
    [lessons, form.course_slug]
  );

  function changeForm(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "course_slug" ? { lesson_id: "" } : {}),
    }));
  }

  function editResource(resource) {
    setForm({
      id: resource.id,
      kind: resource.kind,
      title: resource.title,
      content: resource.content || "",
      url: resource.url || "",
      course_slug: resource.course_slug,
      lesson_id: resource.lesson_id || "",
      published: resource.published,
      file: null,
      file_url: resource.file_url || "",
      storage_path: resource.storage_path || "",
    });
    setMessage("");
  }

  function cancelEdit() {
    setForm(emptyForm());
    setMessage("");
  }

  async function saveResource(event) {
    event.preventDefault();
    if (!form.title.trim() || !form.course_slug) {
      setMessage("Choose a course and enter a title.");
      return;
    }
    const trimmedUrl = form.url.trim();
    if (trimmedUrl) {
      try {
        const parsed = new URL(trimmedUrl);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
      } catch {
        setMessage("Enter a valid link beginning with http:// or https://.");
        return;
      }
    }
    if (!trimmedUrl && !form.content.trim() && !form.file && !form.file_url) {
      setMessage("Add a link, written content, or a file.");
      return;
    }
    if (form.file && form.file.size > MAX_FILE_SIZE) {
      setMessage("Files must be 25 MB or smaller.");
      return;
    }

    setBusy(true);
    setMessage("");
    let uploadedPath = "";
    let cleanupWarning = "";
    try {
      let fileUrl = form.file_url || null;
      let storagePath = form.storage_path || null;
      if (form.file) {
        const safeName = form.file.name.replace(/[^\w.-]/g, "_");
        uploadedPath = `${user.id}/${Date.now()}-${safeName}`;
        const upload = await supabase.storage.from("creator-materials").upload(uploadedPath, form.file, {
          contentType: form.file.type || "application/octet-stream",
          upsert: false,
        });
        if (upload.error) throw new Error(upload.error.message);
        fileUrl = null;
        storagePath = uploadedPath;
      }
      const row = {
        creator_id: user.id,
        course_slug: form.course_slug,
        lesson_id: form.lesson_id || null,
        kind: form.kind,
        title: form.title.trim(),
        content: form.content.trim() || null,
        url: trimmedUrl || null,
        file_url: fileUrl,
        storage_path: storagePath,
        published: form.published,
      };
      const result = form.id
        ? await supabase.from("creator_materials").update(row).eq("id", form.id)
        : await supabase.from("creator_materials").insert(row);
      if (result.error) throw new Error(result.error.message);

      if (form.id && uploadedPath && form.storage_path) {
        const removal = await supabase.storage.from("creator-materials").remove([form.storage_path]);
        if (removal.error) {
          cleanupWarning = `Material saved, but the old uploaded file could not be removed: ${removal.error.message}`;
        }
      }
      setForm(emptyForm());
      const refreshed = await reload();
      if (cleanupWarning) setMessage(cleanupWarning);
      else if (refreshed) setMessage(form.id ? "Material updated." : "Material saved.");
    } catch (error) {
      if (uploadedPath) {
        const cleanup = await supabase.storage.from("creator-materials").remove([uploadedPath]);
        if (cleanup.error) console.error("Unable to clean up an unlinked creator upload.", cleanup.error);
      }
      console.error("Unable to save creator material.", error);
      setMessage(`Could not save material: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteResource(resource) {
    if (!window.confirm(`Delete "${resource.title}"?`)) return;
    setMessage("");
    try {
      const { error } = await supabase.from("creator_materials").delete().eq("id", resource.id);
      if (error) throw new Error(error.message);
      let cleanupWarning = "";
      if (resource.storage_path) {
        const removal = await supabase.storage.from("creator-materials").remove([resource.storage_path]);
        if (removal.error) {
          cleanupWarning = `Material deleted, but the uploaded file could not be removed: ${removal.error.message}`;
        }
      }
      if (form.id === resource.id) setForm(emptyForm());
      await reload();
      if (cleanupWarning) setMessage(cleanupWarning);
    } catch (error) {
      console.error("Unable to delete creator material.", error);
      setMessage(`Could not delete material: ${errorMessage(error)}`);
    }
  }

  if (user === undefined) return <div className="wrap"><p className="muted">Checking sign-in...</p></div>;
  if (!supabase) return <div className="wrap"><h1>Creator Studio</h1><p>Sign-in and creator storage are not configured. Add the Supabase keys to .env.local.</p></div>;
  if (!user) return <div className="wrap"><h1>Creator Studio</h1><p>You must sign in with a creator account to access this page.</p><Link className="btn" href="/login">Log in</Link></div>;
  if (role === null) return <div className="wrap"><p className="muted">Verifying creator access...</p></div>;
  if (!isCreator) return <div className="wrap"><h1>Creator Studio</h1><p role="alert">This page is only available to teacher and admin accounts.</p></div>;

  return (
    <div className="wrap creator-studio">
      <h1>Creator Studio</h1>
      <p className="muted">Add links, assignments, notes, and files to published courses. Materials marked public are visible to learners.</p>
      {message && <p className="notice" role="status">{message}</p>}
      <section className="panel">
        <h2>{form.id ? "Edit material" : "Add material"}</h2>
        <form className="form" onSubmit={saveResource}>
          <label>
            Material type
            <select value={form.kind} onChange={(event) => changeForm("kind", event.target.value)}>
              {RESOURCE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            Course
            <select required value={form.course_slug} onChange={(event) => changeForm("course_slug", event.target.value)}>
              <option value="">Choose a course</option>
              {courses.map((course) => <option key={course.slug} value={course.slug}>{course.title}</option>)}
            </select>
          </label>
          <label>
            Lesson (optional)
            <select value={form.lesson_id} onChange={(event) => changeForm("lesson_id", event.target.value)}>
              <option value="">Course-wide material</option>
              {formLessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
            </select>
          </label>
          <label>
            Title
            <input required maxLength={160} value={form.title} onChange={(event) => changeForm("title", event.target.value)} placeholder="Material title" />
          </label>
          <label>
            Description or assignment instructions
            <textarea rows={5} maxLength={10000} value={form.content} onChange={(event) => changeForm("content", event.target.value)} placeholder="Add notes, instructions, or details" />
          </label>
          <label>
            External link (optional)
            <input type="url" value={form.url} onChange={(event) => changeForm("url", event.target.value)} placeholder="https://example.com" />
          </label>
          <label>
            Attach a file (optional, 25 MB maximum)
            <input type="file" onChange={(event) => changeForm("file", event.target.files?.[0] || null)} />
          </label>
          {form.file_url && <p className="muted">Current file attached. Choose a replacement or leave empty to keep it.</p>}
          <label className="creator-publish">
            <input type="checkbox" checked={form.published} onChange={(event) => changeForm("published", event.target.checked)} />
            Visible to learners
          </label>
          <div className="row">
            <button type="submit" disabled={busy || loading}>{busy ? "Saving..." : form.id ? "Save changes" : "Save material"}</button>
            {form.id && <button className="alt" type="button" onClick={cancelEdit}>Cancel</button>}
          </div>
        </form>
      </section>

      <section className="creator-material-list">
        <h2>Saved materials</h2>
        {loading && <p className="muted">Loading materials...</p>}
        {!loading && resources.length === 0 && <p className="muted">No materials yet.</p>}
        {resources.map((resource) => {
          const course = courses.find((item) => item.slug === resource.course_slug);
          const lesson = lessons.find((item) => item.id === resource.lesson_id);
          const label = RESOURCE_TYPES.find(([type]) => type === resource.kind)?.[1] || "Material";
          return (
            <article className="panel creator-material" key={resource.id}>
              <div>
                <p className="muted">{label} · {course?.title || resource.course_slug}{lesson ? ` · ${lesson.title}` : " · Course-wide"} · {resource.published ? "Visible to learners" : "Draft"}</p>
                <h3>{resource.title}</h3>
                {resource.content && <p className="creator-content">{resource.content}</p>}
                {resource.url && <a href={resource.url} target="_blank" rel="noopener noreferrer">{resource.url}</a>}
                {(resource.signed_file_url || resource.file_url) && <p><a href={resource.signed_file_url || resource.file_url} target="_blank" rel="noopener noreferrer">Open attached file</a></p>}
              </div>
              <div className="creator-actions">
                <button className="tb" type="button" onClick={() => editResource(resource)}>Edit</button>
                <button className="tb" type="button" onClick={() => deleteResource(resource)}>Delete</button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
