# Corrected Artificial Mana source files

Complete code blocks for changed production source and configuration from the October 11, 2026 audit. The actual repository files remain authoritative. Inline comments explain the critical fixes; see `AUDIT.md` for findings, validation and QA, and `../DEPLOYMENT.md` for Vercel steps.

## .env.local.example

```dotenv
# Copy this file to .env.local. Add your own values from Supabase (Project Settings > API).
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY

NEXT_PUBLIC_SITE_URL=https://www.artificialmana.com

# Set only while temporary admin access is needed. Keep this server-only.
# Generate a strong key with: openssl rand -base64 32
ADMIN_TEMP_ACCESS_KEY=

# Use these only for Playwright tests with a separate test project.
E2E_TEST_PROJECT_REF=YOUR-TEST-PROJECT-REF
E2E_LIVE_PROJECT_REF=YOUR-LIVE-PROJECT-REF
E2E_ADMIN_EMAIL=admin@example.com
E2E_ADMIN_PASSWORD=YOUR-TEST-ADMIN-PASSWORD
```

## .github/workflows/ci.yml

```yaml
name: Test and build

on:
  push:
  pull_request:

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Check out the project
        uses: actions/checkout@v4
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - name: Install packages
        run: npm ci
      - name: Lint
        run: npm run lint
      - name: Typecheck security boundaries
        run: npm run typecheck
      - name: Run tests
        run: npm test
      - name: Build the site
        run: npm run build

      - name: Install browser for public UI checks
        run: npx playwright install --with-deps chromium
      - name: Run public UI smoke tests
        run: npm run test:smoke
```

## app/AuthButton.js

```jsx
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
    let changed = false;
    supabase.auth.getSession()
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
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { changed = true; if (active) { setUser(s?.user ?? null); setMessage(""); } });
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
```

## app/CourseBrowser.js

```jsx
"use client";
import Link from "next/link";
import { useState } from "react";
import Cover from "./Cover";

export default function CourseBrowser({ courses }) {
  const [text, setText] = useState("");
  const [cat, setCat] = useState("All");
  const cats = ["All", ...new Set(courses.map((c) => c.category).filter(Boolean))];
  const q = text.trim().toLowerCase();
  const list = courses.filter((c) => {
    if (cat !== "All" && c.category !== cat) return false;
    if (!q) return true;
    const hay = [c.title, c.description, ...c.lessons.map((l) => l.title)].join(" ").toLowerCase();
    return hay.includes(q);
  });
  return (
    <div>
      <div className="section-head">
        <h2 style={{ margin: 0 }}>Browse courses</h2>
        <input className="search" type="search" aria-label="Search courses and lessons" placeholder="Search courses and lessons" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {cats.length > 2 && (
        <div className="chips">
          {cats.map((c) => (
            <button key={c} type="button" aria-pressed={c === cat} className={"chip" + (c === cat ? " on" : "")} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
      )}
      <div className="course-grid">
        {list.map((c) => (
          <Link key={c.slug} href={`/course/${c.slug}`} className="course-card">
            <Cover seed={c.slug} />
            <div className="cc-body">
              {c.category && <span className="pill" style={{ alignSelf: "flex-start" }}>{c.category}</span>}
              <h3>{c.title}</h3>
              <p>{c.description}</p>
              <div className="cc-meta">{c.lessons.length} {c.lessons.length === 1 ? "lesson" : "lessons"}</div>
            </div>
          </Link>
        ))}
      </div>
      {!list.length && <p className="empty">No course found. Try a different word, or clear the search.</p>}
    </div>
  );
}
```

## app/MyList.js

```jsx
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
```

## app/ThemeToggle.js

```jsx
"use client";

import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "artificial-mana-theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    try {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (storedTheme === "light" || storedTheme === "dark") {
        setTheme(storedTheme);
        document.documentElement.dataset.theme = storedTheme;
      }
    } catch (error) {
      setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
      console.error("Unable to load the saved theme preference.", error);
    }
    // Another tab may change the saved preference while this tab is open.
    const sync = (event) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const value = event.newValue === "light" ? "light" : "dark";
      document.documentElement.dataset.theme = value;
      setTheme(value);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (error) {
      console.error("Unable to save the theme preference.", error);
    }
  }

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      className="theme-toggle icon-btn"
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      {nextTheme === "light" ? (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
        </svg>
      )}
    </button>
  );
}
```

## app/admin/AdminControlCenter.js

```jsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

const TABLES = [
  { name: "profiles", label: "Users & roles", key: ["user_id"], order: "user_id", privateData: false },
  { name: "progress", label: "Lesson progress", key: ["user_id", "course_slug", "lesson_id"], order: "completed_at", privateData: true },
  { name: "notes", label: "Private notes", key: ["id"], order: "created_at", privateData: true },
  { name: "course_state", label: "Bookmarks & state", key: ["user_id", "course_slug"], order: "updated_at", privateData: true },
  { name: "quiz_results", label: "Quiz scores", key: ["user_id", "course_slug", "lesson_id"], order: "updated_at", privateData: true },
  { name: "boards", label: "Private learner boards", key: ["user_id", "course_slug", "lesson_id"], order: "updated_at", privateData: true },
  { name: "lesson_boards", label: "Public lesson boards", key: ["course_slug", "lesson_id"], order: "updated_at", privateData: false },
  { name: "comments", label: "Public comments", key: ["id"], order: "created_at", privateData: false },
  { name: "creator_materials", label: "Creator materials & drafts", key: ["id"], order: "created_at", privateData: false },
];

const PAGE_SIZE = 100;

function rowKey(record, fields) {
  return fields.map((field) => `${field}: ${record[field] ?? "?"}`).join(", ");
}

export default function AdminControlCenter() {
  const request = useRef(0);
  const [table, setTable] = useState(TABLES[0]);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    const id = ++request.current;
    if (!supabase) {
      setRows([]);
      setMessage("Supabase is not configured.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const start = page * PAGE_SIZE;
      const { data, error } = await supabase.from(table.name).select("*")
        .order(table.order, { ascending: false })
        .range(start, start + PAGE_SIZE - 1);
      if (error) throw error;
      if (id !== request.current) return;
      setRows(data || []);
      setHasMore((data || []).length === PAGE_SIZE);
    } catch (error) {
      if (id !== request.current) return;
      console.error(`Unable to load ${table.label.toLowerCase()}.`, error);
      setRows([]);
      setHasMore(false);
      setMessage(`Could not load ${table.label.toLowerCase()}. Check your connection and try again.`);
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [page, table]);

  useEffect(() => {
    const counter = request;
    reload();
    return () => { counter.current++; };
  }, [reload]);

  function selectTable(nextTable) {
    setTable(nextTable);
    setPage(0);
  }

  async function saveRecord(record, serialized) {
    try {
      let edited;
      try {
        edited = JSON.parse(serialized);
      } catch {
        setMessage("The record must be valid JSON before it can be saved.");
        return;
      }
      if (!edited || Array.isArray(edited) || typeof edited !== "object") {
        setMessage("A record must be a JSON object.");
        return;
      }
      const payload = { ...edited };
      const query = supabase.from(table.name).update(payload);
      for (const key of table.key) query.eq(key, record[key]);
      const { error } = await query;
      if (error) {
        setMessage(`Could not save record: ${error.message}`);
        return;
      }
      setMessage("Record saved.");
      await reload();
    } catch (error) {
      console.error("Admin record action failed.", error);
      setMessage("Could not complete this action. Check your connection and retry.");
    }
  }

  async function saveRole(record, role) {
    try {
      const { error } = await supabase.from("profiles").update({ role }).eq("user_id", record.user_id);
      if (error) {
        setMessage(`Could not update user role: ${error.message}`);
        return;
      }
      setMessage("User role updated.");
      await reload();
    } catch (error) {
      console.error("Admin record action failed.", error);
      setMessage("Could not complete this action. Check your connection and retry.");
    }
  }

  async function deleteRecord(record) {
    try {
      if (!window.confirm(`Permanently delete this ${table.label.toLowerCase()} record (${rowKey(record, table.key)})?`)) return;
      const query = supabase.from(table.name).delete();
      for (const key of table.key) query.eq(key, record[key]);
      const { error } = await query;
      if (error) {
        setMessage(`Could not delete record: ${error.message}`);
        return;
      }
      setMessage("Record deleted.");
      await reload();
    } catch (error) {
      console.error("Admin record action failed.", error);
      setMessage("Could not complete this action. Check your connection and retry.");
    }
  }

  return (
    <section className="panel admin-control-center">
      <h2>Full site control</h2>
      <p className="muted">
        Admin access includes drafts, published content, and account-owned learning records.
        Private records are visible here to authorized admins. Changes affect the live database.
      </p>
      <div className="row" role="tablist" aria-label="Admin data categories">
        {TABLES.map((item) => (
          <button
            key={item.name}
            type="button"
            className={item.name === table.name ? "tb on" : "tb"}
            role="tab"
            aria-selected={item.name === table.name}
            onClick={() => selectTable(item)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <h3>{table.label}{table.privateData ? " · Private account data" : " · Public or creator data"}</h3>
      <p className="muted">Showing up to {PAGE_SIZE} records per page. Record edits and deletions are permanent.</p>
      {message && <p className="notice" role="status">{message}</p>}
      {loading && <p className="muted">Loading records...</p>}
      {!loading && !rows.length && !message && <p className="muted">No records found.</p>}
      {!loading && rows.map((record) => {
        const identity = rowKey(record, table.key);
        return (
          <details className="note admin-record" key={`${table.name}:${identity}`}>
            <summary>{identity}</summary>
            {table.name === "profiles" && (
              <label>
                Account role
                <select
                  aria-label={`Role for ${record.user_id}`}
                  value={record.role}
                  onChange={(event) => saveRole(record, event.target.value)}
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            )}
            {table.name !== "profiles" && <RecordEditor record={record} onSave={saveRecord} />}
            {table.name !== "profiles" && <button className="del" type="button" onClick={() => deleteRecord(record)}>Delete record</button>}
          </details>
        );
      })}
      <div className="row">
        <button className="alt" type="button" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>Previous</button>
        <span className="muted">Page {page + 1}</span>
        <button className="alt" type="button" disabled={!hasMore || loading} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </section>
  );
}

function RecordEditor({ record, onSave }) {
  const [serialized, setSerialized] = useState(JSON.stringify(record, null, 2));

  useEffect(() => {
    setSerialized(JSON.stringify(record, null, 2));
  }, [record]);

  return (
    <>
      <label>
        Record data (JSON)
        <textarea
          aria-label="Record data (JSON)"
          rows={8}
          value={serialized}
          onChange={(event) => setSerialized(event.target.value)}
        />
      </label>
      <button className="tb" type="button" onClick={() => onSave(record, serialized)}>Save record</button>
    </>
  );
}
```

## app/admin/page.js

```jsx
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
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
    if (!supabase) { setUser(null); return; }
    let active = true;
    let authChanged = false;
    supabase.auth.getSession()
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
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      authChanged = true;
      if (active) { setUser(session?.user ?? null); setRole(null); }
    });
    return () => { active = false; subscription.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!supabase || !user) return;
    let active = true;
    setRole(null);
    supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle()
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
        supabase.from("courses").select("*").order("created_at"),
        supabase.from("lessons").select("*").order("position"),
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
      const { error } = await supabase.from("courses").insert({
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
      const { error } = await supabase.from("courses").update({ published: !c.published }).eq("slug", c.slug);
      if (error) setMsg(error.message); else reload();
    } catch (error) {
      console.error("Admin action failed.", error);
      setMsg("Could not complete this action. Check your connection and try again.");
    }
  }
  async function deleteCourse(c) {
    try {
      if (!window.confirm(`Delete the course "${c.title}" and all its lessons?`)) return;
      const { error } = await supabase.from("courses").delete().eq("slug", c.slug);
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
  if (!supabase) return <div className="wrap"><p role="alert">Supabase is not configured. Set the public Supabase URL and anon key in the environment, then rebuild.</p></div>;
  if (!user) return <div className="wrap"><h1>Admin</h1><p><Link href="/login?next=%2Fadmin">Log in to your admin account</Link></p></div>;
  if (role === null) return <div className="wrap"><p className="muted">Loading...</p></div>;
  if (role === "error") return <div className="wrap"><h1>Admin</h1><p role="alert">{msg}</p></div>;
  if (!isTeacher) return <div className="wrap"><h1>Admin</h1><p>This page is for teachers only.</p></div>;

  return (
    <div className="wrap">
      <h1>Admin</h1>
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
  const [title, setTitle] = useState(initial ? initial.title : "");
  const [link, setLink] = useState(initial ? initial.youtube_id : "");
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
        const up = await supabase.storage.from("lesson-pdfs").upload(path, file, { contentType: "application/pdf" });
        if (up.error) { setMsg(up.error.message); setBusy(false); return; }
        pdf_url = supabase.storage.from("lesson-pdfs").getPublicUrl(path).data.publicUrl;
      }
      const row = { title: title.trim(), youtube_id: id, pdf_url, quiz: cleanQuiz.length ? cleanQuiz : null };
      const res = edit
        ? await supabase.from("lessons").update(row).eq("id", initial.id)
        : await supabase.from("lessons").insert({ ...row, course_slug: course.slug, position: lessons.reduce((m, l) => Math.max(m, l.position), 0) + 1 });
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
      <input placeholder="Lesson title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input placeholder="Paste a YouTube link or video ID" value={link} onChange={(e) => setLink(e.target.value)} />
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
        <button disabled={busy} onClick={save}>{busy ? "Saving..." : edit ? "Save lesson" : "Add lesson"}</button>
        {onCancel && <button className="alt" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}

function CourseEditor({ course, lessons, onPublish, onDelete, reload, setMsg }) {
  const [editLesson, setEditLesson] = useState(null);
  const [ed, setEd] = useState(false);
  const [d, setD] = useState({ title: course.title, description: course.description || "", category: course.category || "" });

  async function saveDetails() {
    try {
      if (!d.title.trim()) { setMsg("The course needs a title."); return; }
      const { error } = await supabase.from("courses").update({
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
      if (!window.confirm(`Delete the lesson "${l.title}"?`)) return;
      const { error } = await supabase.from("lessons").delete().eq("id", l.id);
      if (error) setMsg(error.message); else reload();
    } catch (error) {
      console.error("Admin action failed.", error);
      setMsg("Could not complete this action. Check your connection and try again.");
    }
  }
  async function move(i, dir) {
    try {
      const a = lessons[i], b = lessons[i + dir];
      if (!a || !b) return;
      const first = await supabase.from("lessons").update({ position: b.position }).eq("id", a.id);
      if (first.error) throw first.error;
      const second = await supabase.from("lessons").update({ position: a.position }).eq("id", b.id);
      if (second.error) {
        // Best-effort rollback keeps a failed reorder from silently duplicating positions.
        await supabase.from("lessons").update({ position: a.position }).eq("id", a.id);
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
          <button className="tb on" onClick={onPublish}>{course.published ? "Unpublish" : "Publish"}</button>
          <button className="tb" onClick={onDelete}>Delete course</button>
        </div>
      </div>
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
```

## app/course/[slug]/Certificate.js

```jsx
"use client";
import { useEffect, useState } from "react";

export default function Certificate({ course, complete, quizOk }) {
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { setName(localStorage.getItem("cert-name") || ""); } catch (e) {}
  }, []);

  async function make() {
    if (!name.trim()) { setMsg("Write your name."); return; }
    setBusy(true); setMsg("");
    try {
      const { makeCertificate } = await import("../../../lib/certificate");
      const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const bytes = await makeCertificate({ name: name.trim(), courseTitle: course.title, date });
      const a = document.createElement("a");
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      a.href = url;
      a.download = `certificate-${course.slug}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      try { localStorage.setItem("cert-name", name.trim()); } catch (e) {}
    } catch (e) {
      setMsg("The certificate cannot print one of the letters. Use English letters in the name.");
    }
    setBusy(false);
  }

  if (!(complete && quizOk)) {
    return <p className="muted" style={{ marginTop: 20 }}>Finish all lessons and pass every quiz (60% or more) to get your certificate.</p>;
  }
  return (
    <div className="panel cert">
      <h3 style={{ margin: "0 0 6px" }}>🎓 You finished this course!</h3>
      <p className="muted">Write your name as you want it on the certificate.</p>
      <div className="wb-bar">
        <input className="search" style={{ margin: 0, maxWidth: 320 }} aria-label="Your full name" placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="tb on" disabled={busy} onClick={make}>{busy ? "Making..." : "Download certificate"}</button>
      </div>
      {msg && <p className="muted" role="status">{msg}</p>}
    </div>
  );
}
```

## app/course/[slug]/Classroom.js

```jsx
"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Quiz from "./Quiz";
import Certificate from "./Certificate";
import Comments from "./Comments";
import Whiteboard from "./Whiteboard";
import Notes, { fmt } from "./Notes";
import { safeHtml } from "../../../lib/richtext";
import { supabase } from "../../../lib/supabase";

export default function Classroom({ course }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!supabase);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let authChanged = false;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active || authChanged) return;
      if (error) console.error("Unable to check the current session.", error);
      setUser(data?.session?.user ?? null);
      setAuthReady(true);
    }).catch((error) => {
      if (!active || authChanged) return;
      console.error("Unable to check the current session.", error);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
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
    if (!supabase || !user) {
      try { const saved = JSON.parse(localStorage.getItem(key)); setDone(Array.isArray(saved) ? saved : []); } catch (error) {
        console.error("Unable to load local lesson progress.", error);
        setDone([]);
      }
      return;
    }
    setDone([]);
    let active = true;
    supabase.from("progress").select("lesson_id").eq("user_id", user.id).eq("course_slug", course.slug)
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
    if (supabase && user) {
      supabase.from("progress").upsert(
        { user_id: user.id, course_slug: course.slug, lesson_id: id },
        { onConflict: "user_id,course_slug,lesson_id" }
      ).then(({ error }) => {
        if (error) { console.error("Unable to save account lesson progress.", error); setSaveError("Lesson progress could not be saved. Replay the lesson to retry."); }
      }).catch(() => setSaveError("Lesson progress could not be saved. Replay the lesson to retry."));
    }
    setDone((d) => {
      if (d.includes(id)) return d;
      const n = [...d, id];
      if (!supabase || !user) {
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
    if (supabase && user) {
      supabase.from("notes").select("id,seconds,content").eq("user_id", user.id).eq("course_slug", course.slug)
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
    if (supabase && user) {
      const { data, error } = await supabase.from("notes")
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
    if (supabase && user) {
      const { error } = await supabase.from("notes").delete().eq("user_id", user.id).eq("id", id);
      if (error) throw error;
      if (noteContext.current === context) setNotes((current) => current.filter((note) => note.id !== id));
    } else saveLocal(notes.filter((note) => note.id !== id));
  }
  useEffect(() => {
    if (!supabase || !user) { setTeacher(false); return; }
    let active = true;
    supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle()
      .then(({ data, error }) => { if (active) setTeacher(!error && !!data && (data.role === "teacher" || data.role === "admin")); })
      .catch(() => { if (active) setTeacher(false); });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!supabase) {
      setCreatorMaterials([]);
      setMaterialsError("");
      return;
    }
    let active = true;
    supabase.from("creator_materials")
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
          const { data: file, error: fileError } = await supabase.storage
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
    if (supabase && user) {
      setQuizOk(false);
      supabase.from("quiz_results").select("lesson_id,score,total").eq("user_id", user.id).eq("course_slug", course.slug).then(({ data, error }) => {
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
    if (supabase && user) {
      supabase.from("course_state").upsert(
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
    if (supabase && user) {
      supabase.from("course_state").select("bookmarked,last_lesson")
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
    if (supabase && user) {
      const { data, error } = await supabase.from("notes").select("lesson_id,seconds,content")
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
            <span className="muted">{`${doneCount} of ${course.lessons.length} lessons done`}{!user && supabase ? " · Log in to save your progress" : ""}</span>
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
```

## app/course/[slug]/Comments.js

```jsx
"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";

const when = (d) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function Comments({ slug, lessonId, user, teacher }) {
  const [list, setList] = useState([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [rtext, setRtext] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const pending = useRef(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const id = ++request.current;
    setLoading(true);
    try {
      const { data, error } = await supabase.from("comments").select("*").eq("course_slug", slug).eq("lesson_id", lessonId).order("created_at");
      if (error) throw error;
      if (request.current === id) { setList(data || []); setMsg(""); }
    } catch {
      if (request.current === id) setMsg("The comments cannot load now. Please retry.");
    } finally { if (request.current === id) setLoading(false); }
  }, [slug, lessonId]);
  useEffect(() => {
    const counter = request;
    setList([]); setReplyTo(null); setText(""); setRtext(""); load();
    // Invalidate reads when navigating; late responses belong to the old lesson.
    return () => { counter.current++; };
  }, [load]);
  useEffect(() => { try { setName(localStorage.getItem("comment-name") || ""); } catch (e) {} }, []);

  if (!supabase) return null;

  async function post(body, parent) {
    if (!name.trim()) { setMsg("Write your name first."); return false; }
    if (!body.trim()) return false;
    if (!user || pending.current) return false;
    pending.current = true;
    setBusy(true);
    try {
      const { error } = await supabase.from("comments").insert({
        course_slug: slug, lesson_id: lessonId, parent_id: parent,
        author_name: name.trim().slice(0, 40), body: body.trim().slice(0, 1000),
      });
      if (error) throw error;
      try { localStorage.setItem("comment-name", name.trim()); } catch {}
      setMsg(""); await load();
      return true;
    } catch (error) {
      setMsg(error?.message?.includes("slow_down") ? "Please wait one minute before you post again." : "Could not post your comment. Your draft is still here; please retry.");
      return false;
    } finally { pending.current = false; setBusy(false); }
  }
  async function remove(comment) {
    if (pending.current || !window.confirm("Delete this comment?")) return;
    pending.current = true;
    setBusy(true);
    try {
      const { error } = await supabase.from("comments").delete().eq("id", comment.id);
      if (error) throw error;
      await load();
    } catch { setMsg("Could not delete this comment. Please retry."); }
    finally { pending.current = false; setBusy(false); }
  }

  // A plain function (not a component), so the text boxes keep focus while you type.
  const item = (c, reply) => (
    <div className={"cm" + (reply ? " reply" : "")}>
      <div className="cm-head">
        <b>{c.author_name}</b>
        {c.author_is_teacher && <span className="badge">Teacher</span>}
        <span className="muted">{when(c.created_at)}</span>
      </div>
      <p>{c.body}</p>
      <div className="cm-actions">
        {!reply && user && <button className="del" onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setRtext(""); }}>Reply</button>}
        {(teacher || (user && c.user_id === user.id)) && <button disabled={busy} className="del" onClick={() => remove(c)}>Delete</button>}
      </div>
      {replyTo === c.id && (
        <div className="form">
          <textarea aria-label="Your reply" maxLength={1000} rows={2} className="cm-input" placeholder="Write a reply" value={rtext} onChange={(e) => setRtext(e.target.value)} />
          <div className="row">
            <button disabled={busy || !rtext.trim()} onClick={async () => { if (await post(rtext, c.id)) { setReplyTo(null); setRtext(""); } }}>Post reply</button>
          </div>
        </div>
      )}
    </div>
  );

  const top = list.filter((c) => !c.parent_id);
  return (
    <div className="comments">
      <h3>Questions and comments</h3>
      {user ? (
        <div className="form">
          <input className="cm-input" aria-label="Your name" placeholder="Your name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
          <textarea rows={3} className="cm-input" aria-label="Your comment" placeholder="Ask a question or share an idea" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="row">
            <button disabled={busy || !text.trim()} onClick={async () => { if (await post(text, null)) setText(""); }}>Post</button>
          </div>
        </div>
      ) : (
        <p className="muted"><Link href="/login" style={{ textDecoration: "underline" }}>Log in</Link> to ask a question or write a comment.</p>
      )}
      {loading && <p role="status">Loading comments...</p>}
      {msg && <p className="notice" role="alert">{msg} <button type="button" onClick={load}>Retry loading</button></p>}
      {top.map((c) => (
        <div key={c.id}>
          {item(c, false)}
          {list.filter((r) => r.parent_id === c.id).map((r) => <div key={r.id}>{item(r, true)}</div>)}
        </div>
      ))}
      {!loading && !msg && !top.length && <p className="muted">No comments yet. Be the first.</p>}
    </div>
  );
}
```

## app/course/[slug]/ExcalidrawBoard.js

```jsx
"use client";
import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useDebouncedSave } from "../../../lib/use-debounced-save";

export default function ExcalidrawBoard({ slug, lessonId, user }) {
  const [init, setInit] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [theme, setTheme] = useState("dark");
  const signature = useRef("");
  const persistence = useDebouncedSave(1200);
  const dbId = `${lessonId}:diagram`;
  const key = `xboard:${slug}:${lessonId}`;

  useEffect(() => {
    const update = () => setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    setInit(null);
    setError("");
    async function load() {
      try {
        let saved;
        if (supabase && user) {
          const { data, error } = await supabase.from("boards").select("data").eq("user_id", user.id).eq("course_slug", slug).eq("lesson_id", dbId).maybeSingle();
          if (error) throw error;
          saved = data?.data;
        } else saved = JSON.parse(localStorage.getItem(key));
        if (!active) return;
        const elements = Array.isArray(saved?.elements) ? saved.elements : [];
        signature.current = JSON.stringify(elements);
        setInit({ elements });
      } catch (error) {
        console.error("Unable to load the diagram.", error);
        if (active) setError("Your diagram could not be loaded.");
      }
    }
    load();
    return () => { active = false; };
  }, [key, user, slug, dbId, attempt]);

  function onChange(elements) {
    const data = { elements: elements.filter((element) => !element.isDeleted) };
    const next = JSON.stringify(data.elements);
    if (signature.current === next) return;
    signature.current = next;
    persistence.schedule(async () => {
      if (supabase && user) {
        const { error } = await supabase.from("boards").upsert({ user_id: user.id, course_slug: slug, lesson_id: dbId, data }, { onConflict: "user_id,course_slug,lesson_id" });
        if (error) throw error;
      } else localStorage.setItem(key, JSON.stringify(data));
    });
  }

  if (error) return <p role="alert">{error} <button onClick={() => setAttempt((count) => count + 1)}>Retry</button></p>;
  if (!init) return <p className="muted" role="status">Loading the board...</p>;
  return <>
    {persistence.message && <p role="alert">{persistence.message} <button onClick={persistence.retry}>Retry saving</button></p>}
    <Excalidraw key={`${key}:${user?.id || "guest"}`} theme={theme} onChange={onChange}
      initialData={{ elements: init.elements, appState: { viewBackgroundColor: "#1f3b2d" } }} />
  </>;
}
```

## app/course/[slug]/Notes.js

```jsx
"use client";
import { useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { extensions, safeHtml } from "../../../lib/richtext";

export const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Toolbar({ editor }) {
  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"), italic: e.isActive("italic"), strike: e.isActive("strike"),
      h2: e.isActive("heading", { level: 2 }), bullet: e.isActive("bulletList"), ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"), code: e.isActive("code"),
    }),
  });
  const b = (on, label, run, title) => (
    <button type="button" title={title} className={"fmt" + (on ? " on" : "")} onMouseDown={(e) => e.preventDefault()} onClick={run}>{label}</button>
  );
  const c = () => editor.chain().focus();
  return (
    <div className="wb-bar fmtbar">
      {b(st.bold, <b>B</b>, () => c().toggleBold().run(), "Bold")}
      {b(st.italic, <i>I</i>, () => c().toggleItalic().run(), "Italic")}
      {b(st.strike, <s>S</s>, () => c().toggleStrike().run(), "Strike")}
      {b(st.h2, "H", () => c().toggleHeading({ level: 2 }).run(), "Heading")}
      {b(st.bullet, "• List", () => c().toggleBulletList().run(), "Bullet list")}
      {b(st.ordered, "1. List", () => c().toggleOrderedList().run(), "Numbered list")}
      {b(st.quote, "“ ”", () => c().toggleBlockquote().run(), "Quote")}
      {b(st.code, "</>", () => c().toggleCode().run(), "Code")}
    </div>
  );
}

export default function Notes({ notes, onAdd, onDelete, onSeek, getTime, loggedIn, onExport }) {
  const [t, setT] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const editor = useEditor({
    extensions,
    content: "",
    immediatelyRender: false,
    editorProps: { attributes: { class: "editor", "aria-label": "Write a note for this lesson" } },
    onFocus: () => setT(getTime()),
  });

  async function run(action, failure) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage("");
    try { await action(); }
    catch (error) {
      console.error(failure, error);
      setMessage(failure);
    } finally { pending.current = false; setBusy(false); }
  }

  function submit() {
    if (!editor || editor.isEmpty || pending.current) return;
    const content = editor.getHTML();
    run(async () => {
      // Keep the draft until persistence succeeds, including browser quota failures.
      editor.setEditable(false);
      try { await onAdd(content, t); editor.commands.clearContent(); }
      finally { editor.setEditable(true); }
    }, "Could not save your note. Your draft is still here; try again.");
  }

  return (
    <div className="notes">
      <h3>My notes</h3>
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
      <div className="row">
        <button disabled={busy} onClick={submit}>{busy ? "Working..." : `Save note at ${fmt(t)}`}</button>
        <button disabled={busy} className="alt" onClick={() => run(onExport, "Could not export your notes. Please try again.")}>Download notes as PDF</button>
      </div>
      {!loggedIn && <p className="muted">Your notes stay in this browser. Log in to keep them on all your devices.</p>}
      {message && <p role="alert">{message}</p>}
      {notes.map((n) => (
        <div key={n.id} className="note">
          <button className="ts" onClick={() => onSeek(n.seconds)}>▶ {fmt(n.seconds)}</button>
          {/* safeHtml keeps only the formats the editor allows */}
          <div className="rich" dangerouslySetInnerHTML={{ __html: safeHtml(n.content) }} />
          <button disabled={busy} className="del" onClick={() => run(() => onDelete(n.id), "Could not delete your note. Please try again.")} aria-label="Delete note">✕</button>
        </div>
      ))}
    </div>
  );
}
```

## app/course/[slug]/Quiz.js

```jsx
"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

const QUESTIONS_PER_BATCH = 10;

export default function Quiz({ quiz, slug, lessonId, user, onResult }) {
  const [pick, setPick] = useState({});
  const [score, setScore] = useState(null);
  const [best, setBest] = useState(null);
  const [visibleCount, setVisibleCount] = useState(QUESTIONS_PER_BATCH);
  const [message, setMessage] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const key = `quiz:${slug}:${lessonId}`;
  const visibleQuiz = quiz.slice(0, visibleCount);

  useEffect(() => {
    let active = true;
    setPick({});
    setScore(null);
    setBest(null);
    setVisibleCount(QUESTIONS_PER_BATCH);
    setMessage("");
    setSaveFailed(false);
    if (supabase && user) {
      supabase.from("quiz_results").select("score,total").eq("user_id", user.id)
        .eq("course_slug", slug).eq("lesson_id", lessonId).maybeSingle()
        .then(({ data, error }) => {
          if (!active) return;
          if (error) {
            setMessage(`Could not load your saved score: ${error.message}`);
            return;
          }
          if (data) setBest(data);
        })
        .catch((error) => {
          if (!active) return;
          console.error("Unable to load the saved quiz score.", error);
          setMessage("Could not load your saved score. Please try again.");
        });
    } else {
      try {
        setBest(JSON.parse(localStorage.getItem(key)));
      } catch (error) {
        console.error("Unable to load the saved quiz score.", error);
        setMessage("Could not load your saved score from this browser.");
      }
    }
    return () => { active = false; };
  }, [key, user, slug, lessonId]);

  async function check() {
    const s = visibleQuiz.filter((q, i) => pick[i] === q.answer).length;
    const result = { score: s, total: visibleQuiz.length };
    setScore(s);
    setMessage("");
    const isBetter = !best
      || s * best.total > best.score * result.total
      || (s * best.total === best.score * result.total && result.total > best.total);
    if (!isBetter) {
      if (onResult) onResult();
      return;
    }

    setSaving(true);
    setSaveFailed(false);
    try {
      if (supabase && user) {
        const { error } = await supabase.from("quiz_results").upsert(
          { user_id: user.id, course_slug: slug, lesson_id: lessonId, ...result },
          { onConflict: "user_id,course_slug,lesson_id" }
        );
        if (error) throw new Error(error.message);
      } else {
        window.localStorage.setItem(key, JSON.stringify(result));
      }
      setBest(result);
      if (onResult) onResult();
    } catch (error) {
      console.error("Unable to save the quiz score.", error);
      setSaveFailed(true);
      setMessage("Your score could not be saved. Please try again.");
    } finally { setSaving(false); }
  }

  async function downloadAnswerKey() {
    setPdfBusy(true);
    setMessage("");
    try {
      const { makeQuizPdf } = await import("../../../lib/quiz-pdf");
      const bytes = await makeQuizPdf({ quiz, title: "Artificial Mana Quick Quiz" });
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `quiz-answer-key-${slug}-${lessonId}.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Unable to create the quiz answer key PDF.", error);
      setMessage("Could not create the PDF. Check that the quiz text uses supported characters and try again.");
    } finally {
      setPdfBusy(false);
    }
  }

  const all = visibleQuiz.every((q, i) => pick[i] !== undefined);
  return (
    <div className="quiz">
      <h3>Quick quiz</h3>
      <div className="row">
        <button className="alt" type="button" disabled={pdfBusy} onClick={downloadAnswerKey}>
          {pdfBusy ? "Creating PDF..." : "Download quiz + answer key PDF"}
        </button>
      </div>
      {best && <p className="muted">Your best score: {best.score} of {best.total}</p>}
      {visibleQuiz.map((q, i) => (
        <div key={i} className="q">
          <p><b>{i + 1}. {q.q}</b></p>
          {q.options.map((o, j) => {
            let cls = "opt";
            if (score !== null) cls += j === q.answer ? " right" : pick[i] === j ? " wrong" : "";
            return (
              <label key={j} className={cls}>
                <input type="radio" name={`q${i}`} disabled={score !== null} checked={pick[i] === j}
                  onChange={() => setPick({ ...pick, [i]: j })} />
                <span>{o}</span>
              </label>
            );
          })}
        </div>
      ))}
      {visibleCount < quiz.length && (
        <div className="row">
          <button
            className="alt"
            type="button"
            disabled={score !== null}
            onClick={() => setVisibleCount((count) => Math.min(count + QUESTIONS_PER_BATCH, quiz.length))}
          >
            Show {Math.min(QUESTIONS_PER_BATCH, quiz.length - visibleCount)} more questions
          </button>
        </div>
      )}
      {score === null ? (
        <div className="row"><button disabled={!all || saving} onClick={check}>Check answers</button></div>
      ) : (
        <div className="row">
          <strong>You got {score} of {visibleQuiz.length}.</strong>
          <button disabled={saving} onClick={() => { setPick({}); setScore(null); setSaveFailed(false); }}>Try again</button>
          {saveFailed && <button disabled={saving} onClick={check}>Retry saving score</button>}
        </div>
      )}
      {message && <p role="alert">{message}</p>}
    </div>
  );
}
```

## app/course/[slug]/Whiteboard.js

```jsx
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useDebouncedSave } from "../../../lib/use-debounced-save";
import { supabase } from "../../../lib/supabase";

const ExcalidrawBoard = dynamic(() => import("./ExcalidrawBoard"), { ssr: false, loading: () => <p className="muted">Loading the board...</p> });

const W = 1200, H = 700;
const BG = { blackboard: "#1f3b2d", whiteboard: "#ffffff", grid: "#ffffff" };
const COLORS = ["#ffffff", "#111111", "#ff5a5f", "#4f8cff", "#2fd17a", "#ffd23f"];
const TOOLS = [["pen", "Pen"], ["marker", "Marker"], ["highlighter", "Highlight"], ["line", "Line"],
  ["rect", "Box"], ["ellipse", "Circle"], ["text", "Text"], ["eraser", "Eraser"]];

function drawStroke(c, s) {
  c.save();
  c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = s.color; c.fillStyle = s.color;
  const p = s.pts;
  if (s.tool === "text") {
    c.font = `${s.size * 4 + 12}px system-ui, sans-serif`; c.textBaseline = "top";
    c.fillText(s.text, p[0][0], p[0][1]); c.restore(); return;
  }
  c.lineWidth = s.tool === "marker" ? s.size * 2.5 : s.tool === "highlighter" ? s.size * 6 : s.size;
  c.globalAlpha = s.tool === "highlighter" ? 0.35 : 1;
  const a = p[0], b = p[p.length - 1];
  c.beginPath();
  if (s.tool === "line") { c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
  else if (s.tool === "rect") c.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
  else if (s.tool === "ellipse") c.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2, Math.abs(b[1] - a[1]) / 2, 0, 0, Math.PI * 2);
  else {
    c.moveTo(a[0], a[1]);
    if (p.length === 1) c.lineTo(a[0] + 0.1, a[1]);
    for (let i = 1; i < p.length - 1; i++) {
      c.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
    }
    if (p.length > 1) c.lineTo(b[0], b[1]);
  }
  c.stroke();
  c.restore();
}

function hit(s, q) {
  const near = (a, r) => Math.hypot(a[0] - q[0], a[1] - q[1]) < r;
  if (s.tool === "text") return q[0] > s.pts[0][0] - 8 && q[0] < s.pts[0][0] + s.text.length * (s.size * 2.4 + 6) + 8 && q[1] > s.pts[0][1] - 8 && q[1] < s.pts[0][1] + s.size * 4 + 20;
  if (s.tool === "rect" || s.tool === "ellipse") {
    const a = s.pts[0], b = s.pts[s.pts.length - 1];
    return q[0] > Math.min(a[0], b[0]) - 12 && q[0] < Math.max(a[0], b[0]) + 12 && q[1] > Math.min(a[1], b[1]) - 12 && q[1] < Math.max(a[1], b[1]) + 12;
  }
  if (s.tool === "line") {
    const a = s.pts[0], b = s.pts[s.pts.length - 1];
    for (let t = 0; t <= 1; t += 0.05) if (near([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], 18)) return true;
    return false;
  }
  return s.pts.some((pt) => near(pt, 18));
}

export default function Whiteboard({ slug, lessonId, user, canEdit }) {
  const [open, setOpen] = useState(false);
  const [excal, setExcal] = useState(false);
  const [shared, setShared] = useState(false); // true = the teacher board
  const canDraw = !shared || !!canEdit;
  const [board, setBoardRaw] = useState("blackboard");
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#ffffff");
  const [size, setSize] = useState(4);
  const [strokes, setStrokes] = useState([]);
  const canvas = useRef(null), wrap = useRef(null);
  const cur = useRef([]), hist = useRef([]), fut = useRef([]);
  const drawing = useRef(null), loaded = useRef(false);
  const dirty = useRef(false);
  const [loadError, setLoadError] = useState("");
  const persistence = useDebouncedSave();
  const { schedule, flush } = persistence;
  const key = `board:${slug}:${lessonId}`;

  function setBoard(b) {
    dirty.current = true;
    setBoardRaw(b);
    if (b !== "blackboard" && color === "#ffffff") setColor("#111111");
    if (b === "blackboard" && color === "#111111") setColor("#ffffff");
  }

  const render = useCallback(() => {
    const cv = canvas.current;
    if (!cv) return;
    const c = cv.getContext("2d");
    if (!c) return;
    c.fillStyle = BG[board]; c.fillRect(0, 0, W, H);
    if (board === "grid") {
      c.strokeStyle = "#dfe5f1"; c.lineWidth = 1; c.beginPath();
      for (let x = 0; x <= W; x += 40) { c.moveTo(x, 0); c.lineTo(x, H); }
      for (let y = 0; y <= H; y += 40) { c.moveTo(0, y); c.lineTo(W, y); }
      c.stroke();
    }
    cur.current.forEach((s) => drawStroke(c, s));
    if (drawing.current && drawing.current.pts) drawStroke(c, drawing.current);
  }, [board]);

  useEffect(() => { if (open) render(); }, [open, strokes, render]);

  // A failed read must not silently become an empty board that overwrites saved work.
  useEffect(() => {
    if (!open) return;
    let active = true;
    loaded.current = false;
    dirty.current = false;
    drawing.current = null;
    cur.current = [];
    hist.current = [];
    fut.current = [];
    setStrokes([]);
    setLoadError("");
    const apply = (data) => {
      if (!active) return;
      const saved = Array.isArray(data?.strokes) ? data.strokes.filter((stroke) => Array.isArray(stroke?.pts) && stroke.pts.length) : [];
      cur.current = saved;
      setStrokes(saved);
      setBoardRaw(BG[data?.board] ? data.board : "blackboard");
      loaded.current = true;
    };
    const read = async () => {
      try {
        if (shared && supabase) {
          const { data, error } = await supabase.from("lesson_boards").select("data").eq("course_slug", slug).eq("lesson_id", lessonId).maybeSingle();
          if (error) throw error;
          apply(data?.data);
        } else if (supabase && user && !shared) {
          const { data, error } = await supabase.from("boards").select("data").eq("user_id", user.id).eq("course_slug", slug).eq("lesson_id", lessonId).maybeSingle();
          if (error) throw error;
          apply(data?.data);
        } else apply(shared ? null : JSON.parse(localStorage.getItem(key)));
      } catch (error) {
        console.error("Unable to load the board.", error);
        if (active) setLoadError("Your board could not be loaded. Close and reopen it to retry.");
      }
    };
    read();
    return () => { active = false; };
  }, [open, key, user, shared, slug, lessonId]);

  useEffect(() => {
    if (!loaded.current || !dirty.current || !canDraw) return;
    dirty.current = false;
    const data = { board, strokes };
    schedule(async () => {
      if (shared && canEdit && supabase) {
        const { error } = await supabase.from("lesson_boards").upsert({ course_slug: slug, lesson_id: lessonId, data, updated_at: new Date().toISOString() }, { onConflict: "course_slug,lesson_id" });
        if (error) throw error;
      } else if (!shared && supabase && user) {
        const { error } = await supabase.from("boards").upsert({ user_id: user.id, course_slug: slug, lesson_id: lessonId, data }, { onConflict: "user_id,course_slug,lesson_id" });
        if (error) throw error;
      } else if (!shared) localStorage.setItem(key, JSON.stringify(data));
    });
  }, [strokes, board, canDraw, canEdit, shared, slug, lessonId, user, key, schedule]);

  // Students watch the teacher board. It updates when the teacher saves (about 1 to 2 seconds).
  useEffect(() => {
    if (!open || !shared || canEdit || !supabase) return;
    const ch = supabase.channel(`tboard-${slug}-${lessonId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lesson_boards", filter: `lesson_id=eq.${lessonId}` }, (p) => {
        const row = p.new;
        if (!row || row.course_slug !== slug || !row.data) return;
        cur.current = row.data.strokes || [];
        setStrokes(cur.current);
        if (row.data.board) setBoardRaw(row.data.board);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [open, shared, canEdit, slug, lessonId]);

  function commit(next) { dirty.current = true; hist.current.push(cur.current); fut.current = []; cur.current = next; setStrokes(next); }
  function undo() { if (!hist.current.length) return; dirty.current = true; fut.current.push(cur.current); cur.current = hist.current.pop(); setStrokes(cur.current); }
  function redo() { if (!fut.current.length) return; dirty.current = true; hist.current.push(cur.current); cur.current = fut.current.pop(); setStrokes(cur.current); }

  function pos(e) {
    const r = canvas.current.getBoundingClientRect();
    return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height];
  }
  function erase(p) {
    const d = drawing.current;
    const keep = cur.current.filter((s) => !hit(s, p));
    if (keep.length === cur.current.length) return;
    if (!d.pushed) { hist.current.push(cur.current); fut.current = []; d.pushed = true; }
    dirty.current = true;
    cur.current = keep; setStrokes(keep);
  }
  function down(e) {
    if (e.button > 0 || !canDraw || !loaded.current) return;
    e.preventDefault();
    canvas.current.setPointerCapture(e.pointerId);
    const p = pos(e);
    if (tool === "text") {
      const t = window.prompt("Type your text");
      if (t && t.trim()) commit([...cur.current, { tool, color, size, text: t.trim(), pts: [p] }]);
      return;
    }
    if (tool === "eraser") { drawing.current = { erase: true }; erase(p); return; }
    drawing.current = { tool, color, size, pts: [p] };
    render();
  }
  function move(e) {
    const d = drawing.current;
    if (!d) return;
    const p = pos(e);
    if (d.erase) { erase(p); return; }
    if (["line", "rect", "ellipse"].includes(d.tool)) d.pts = [d.pts[0], p];
    else d.pts.push(p);
    render();
  }
  function up() {
    const d = drawing.current;
    drawing.current = null;
    if (d && d.pts) commit([...cur.current, d]);
  }
  function savePng() {
    canvas.current.toBlob((b) => {
      const a = document.createElement("a");
      if (!b) return;
      const url = URL.createObjectURL(b);
      a.href = url; a.download = `board-${lessonId}.png`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  if (excal) return (
    <div className="wb-wrap">
      <div className="titlebar">
        <h3 style={{ margin: 0 }}>Diagram board</h3>
        <button className="tb" onClick={() => setExcal(false)}>Close</button>
      </div>
      <div className="xwrap"><ExcalidrawBoard slug={slug} lessonId={lessonId} user={user} /></div>
    </div>
  );
  if (!open) return (
    <div className="wb-wrap wb-bar">
      <button className="tb on" onClick={() => { setShared(false); setOpen(true); }}>✏️ Open chalkboard</button>
      <button className="tb on" onClick={() => { setShared(true); setOpen(true); }}>{canEdit ? "👩‍🏫 Open teacher board" : "👩‍🏫 Watch teacher board"}</button>
      <button className="tb on" onClick={() => setExcal(true)}>🎨 Open diagram board</button>
    </div>
  );
  return (
    <div className="wb-wrap wb" ref={wrap}>
      <div className="titlebar">
        <h3 style={{ margin: 0 }}>{shared ? (canEdit ? "Teacher board (students can watch)" : "Teacher board") : "Whiteboard"}</h3>
        <div className="wb-bar">
          <button className="tb" onClick={() => wrap.current.requestFullscreen?.().catch(() => setLoadError("Full screen is unavailable in this browser."))}>Full screen</button>
          <button className="tb" onClick={() => { flush(); setOpen(false); }}>Close</button>
        </div>
      </div>
      {loadError && <p role="alert">{loadError}</p>}
      {persistence.message && <p role="alert">{persistence.message} <button onClick={persistence.retry}>Retry saving</button></p>}
      {canDraw && !loadError && <>
      <div className="wb-bar">
        {TOOLS.map(([t, l]) => <button key={t} className={"tb" + (tool === t ? " on" : "")} onClick={() => setTool(t)}>{l}</button>)}
      </div>
      <div className="wb-bar">
        {COLORS.map((c) => <button key={c} className={"sw" + (color === c ? " on" : "")} style={{ background: c }} onClick={() => setColor(c)} aria-label={"Color " + c} />)}
        <input type="range" min="1" max="16" value={size} onChange={(e) => setSize(+e.target.value)} aria-label="Size" />
        <select aria-label="Board background" value={board} onChange={(e) => setBoard(e.target.value)}>
          <option value="blackboard">Blackboard</option>
          <option value="whiteboard">Whiteboard</option>
          <option value="grid">Grid paper</option>
        </select>
        <button className="tb" disabled={!hist.current.length} onClick={undo}>Undo</button>
        <button className="tb" disabled={!fut.current.length} onClick={redo}>Redo</button>
        <button className="tb" onClick={() => window.confirm("Clear the whole board?") && commit([])}>Clear</button>
        <button className="tb" onClick={savePng}>Save image</button>
      </div>
      </>}
      <canvas ref={canvas} width={W} height={H} className="wb-canvas"
        style={canDraw ? undefined : { touchAction: "auto", cursor: "default" }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      <p className="muted">{canDraw ? (shared ? "Students see your board while you draw. It saves by itself." : "Use a mouse, a finger, or a pen. The board saves by itself.") : "You are watching the teacher board. It updates by itself."}</p>
    </div>
  );
}
```

## app/course/[slug]/loading.js

```jsx
export default function LoadingCourse() {
  return <div className="wrap" role="status" aria-live="polite">
    <p className="muted">Loading course and lessons...</p>
    <div className="skeleton video-skeleton" aria-hidden="true" />
  </div>;
}
```

## app/course/[slug]/page.js

```jsx
import { notFound } from "next/navigation";
import { getCourses } from "../../../lib/courses";
import Classroom from "./Classroom";

export const revalidate = 60;

export async function generateStaticParams() {
  return (await getCourses()).map((c) => ({ slug: c.slug }));
}
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const c = (await getCourses()).find((x) => x.slug === slug);
  return c ? { title: c.title, description: c.description || undefined } : { title: "Not found" };
}
export default async function CoursePage({ params }) {
  const { slug } = await params;
  const course = (await getCourses()).find((c) => c.slug === slug);
  if (!course) notFound();
  return <Classroom key={course.slug} course={course} />;
}
```

## app/creator-studio/studio.js

```jsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
// Allowed file types. Web pages (html, svg) and programs are not allowed, for safety.
const FILE_TYPES = {
  pdf: "application/pdf", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv", txt: "text/plain", md: "text/markdown", epub: "application/epub+zip", zip: "application/zip",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
};
const fileExt = (name) => (name.split(".").pop() || "").toLowerCase();

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
  const request = useRef(0);
  const [user, setUser] = useState(undefined);
  const [role, setRole] = useState(null);
  const [courses, setCourses] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [resources, setResources] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setUser(null);
      return;
    }
    let active = true;
    let authChanged = false;
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active || authChanged) return;
        if (error) throw error;
        if (active) setUser(data.session?.user ?? null);
      })
      .catch((error) => {
        console.error("Unable to check creator sign-in.", error);
        if (active) {
          setUser(null);
          setMessage(`Unable to check sign-in: ${errorMessage(error)}`);
        }
      });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      authChanged = true;
      if (active) setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !user) {
      setRole(null);
      setResources([]);
      setForm(emptyForm());
      return;
    }
    let active = true;
    setRole(null);
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

  const reload = useCallback(async () => {
    const id = ++request.current;
    if (!user || !supabase) return false;
    setLoading(true);
    setLoadError("");
    try {
      const [courseResult, lessonResult, resourceResult] = await Promise.all([
        supabase.from("courses").select("slug,title").order("created_at"),
        supabase.from("lessons").select("id,course_slug,title").order("position"),
        supabase.from("creator_materials").select("*")
          .eq("creator_id", user.id).order("created_at"),
      ]);
      const failed = [courseResult, lessonResult, resourceResult].find((result) => result.error);
      if (failed) throw new Error(failed.error.message);
      if (id !== request.current) return false;
      setCourses(courseResult.data || []);
      setLessons(lessonResult.data || []);
      const resourcesWithFiles = await Promise.all((resourceResult.data || []).map(async (resource) => {
        if (!resource.storage_path) return resource;
        const { data, error } = await supabase.storage.from("creator-materials")
          .createSignedUrl(resource.storage_path, 3600);
        if (error) throw new Error(error.message);
        return { ...resource, signed_file_url: data.signedUrl };
      }));
      if (id !== request.current) return false;
      setResources(resourcesWithFiles);
      setMessage("");
      return true;
    } catch (error) {
      if (id !== request.current) return false;
      console.error("Unable to load creator materials.", error);
      setLoadError("Could not load creator materials. Check your connection and try again.");
      setMessage(`Could not load creator materials: ${errorMessage(error)}. Make sure the creator materials database setup has been applied.`);
      return false;
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [user]);

  const isCreator = role === "teacher" || role === "admin";

  useEffect(() => {
    const counter = request;
    if (isCreator) reload();
    return () => { counter.current++; };
  }, [isCreator, reload]);

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
    const expectedContentType = form.file && FILE_TYPES[fileExt(form.file.name)];
    if (form.file && (!expectedContentType || (form.file.type && form.file.type.toLowerCase() !== expectedContentType))) {
      setMessage("This file type is not allowed. Use PDF, Word, PowerPoint, Excel, CSV, text, Markdown, EPUB, ZIP, or an image.");
      return;
    }
    if (form.file && form.file.size > MAX_FILE_SIZE) {
      setMessage("Files must be 25 MB or smaller.");
      return;
    }

    setBusy(true);
    setMessage("");
    let uploadedPath = "";
    let committed = false;
    let cleanupWarning = "";
    try {
      let fileUrl = form.file_url || null;
      let storagePath = form.storage_path || null;
      if (form.file) {
        const safeName = form.file.name.replace(/[^\w.-]/g, "_");
        uploadedPath = `${user.id}/${Date.now()}-${safeName}`;
        const upload = await supabase.storage.from("creator-materials").upload(uploadedPath, form.file, {
          contentType: FILE_TYPES[fileExt(form.file.name)],
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
      committed = true;

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
      // Once linked, a cleanup failure must never remove the new, live file.
      if (uploadedPath && !committed) {
        const cleanup = await supabase.storage.from("creator-materials").remove([uploadedPath]);
        if (cleanup.error) console.error("Unable to clean up an unlinked creator upload.", cleanup.error);
      }
      console.error("Unable to save creator material.", error);
      setMessage(committed ? `Material saved, but file cleanup failed: ${errorMessage(error)}` : `Could not save material: ${errorMessage(error)}`);
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
  if (!supabase) return <div className="wrap"><h1>Creator Studio</h1><p role="alert">Sign-in and creator storage are not configured. Set the public Supabase URL and anon key in the environment, then rebuild.</p></div>;
  if (!user) return <div className="wrap"><h1>Creator Studio</h1>{message && <p role="alert">{message}</p>}<p>You must sign in with a creator account to access this page.</p><Link className="btn" href="/login">Log in</Link></div>;
  if (role === null) return <div className="wrap"><p className="muted">Verifying creator access...</p></div>;
  if (!isCreator) return <div className="wrap"><h1>Creator Studio</h1><p role="alert">{message || "This page is only available to teacher and admin accounts."}</p></div>;

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
            <input type="file" accept={Object.keys(FILE_TYPES).map((e) => "." + e).join(",")} onChange={(event) => changeForm("file", event.target.files?.[0] || null)} />
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
        {loadError && <p className="notice" role="alert">{loadError} <button className="alt" type="button" disabled={loading} onClick={reload}>Try again</button></p>}
        {!loading && !loadError && resources.length === 0 && <p className="muted">No materials yet.</p>}
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
```

## app/error.js

```jsx
"use client";

// Next 16.4 retry re-fetches failed server content as well as resetting the boundary.
export default function Error({ retry }) {
  return (
    <div className="wrap" role="alert">
      <h1>Something went wrong</h1>
      <p className="muted">We could not load this page. Please try again.</p>
      <button type="button" onClick={retry}>Try again</button>
    </div>
  );
}
```

## app/global-error.js

```jsx
"use client";

// Root layout failures bypass app/error.js; this boundary supplies its own document.
// Next 16.4 retry re-fetches failed server content as well as resetting the boundary.
export default function GlobalError({ retry }) {
  return <html lang="en"><body style={{ fontFamily: "system-ui", padding: 24 }}>
    <h1>Something went wrong</h1>
    <p role="alert">We could not load the site. Please try again.</p>
    <button type="button" onClick={retry}>Try again</button>
  </body></html>;
}
```

## app/globals.css

```css
:root{
  color-scheme:light;
  --bg:#fff;--soft:#f4f6fb;--soft2:#e9edf6;--line:#dfe4ee;--ink:#141a26;--muted:#5a6377;
  --primary:#2b59e8;--primary-ink:#fff;--primary-soft:#e8eefe;
  --board:#1f3b2d;--board-ink:#f3f1e7;--chalk:#f4c542;--ok:#1f9d63;--bad:#d64545;
  --shadow:0 1px 2px rgba(20,26,38,.06),0 8px 24px rgba(20,26,38,.07);
}
[data-theme="dark"]{
  color-scheme:dark;
  --bg:#0e1118;--soft:#161a24;--soft2:#1d2230;--line:#2a3042;--ink:#e9ecf3;--muted:#9aa3b8;
  --primary:#6b8cff;--primary-ink:#0b1020;--primary-soft:#1b2542;
  --board:#183024;--board-ink:#f3f1e7;--chalk:#f4c542;--ok:#3ccf8e;--bad:#ff7a7a;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.35);
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Inter Variable",system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
h1,h2,h3{line-height:1.2;letter-spacing:-.02em;margin:0 0 .5em}
h1{font-size:clamp(2rem,4.4vw,3.1rem);font-weight:780;line-height:1.08}
h2{font-size:1.5rem;font-weight:720}
h3{font-size:1.1rem;font-weight:680}
p{margin:.5em 0}
:focus-visible{outline:3px solid var(--primary);outline-offset:3px;border-radius:6px}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
.muted{color:var(--muted)}
.container{max-width:1200px;margin:0 auto;padding:0 24px}
.wrap{max-width:960px;margin:0 auto;padding:40px 24px}
.prose p,.prose li{line-height:1.75;max-width:70ch}

/* header */
.top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.top-in{max-width:1200px;margin:0 auto;padding:0 24px;height:64px;display:flex;align-items:center;gap:28px}
.logo{white-space:nowrap;display:flex;align-items:center;gap:10px;font-weight:780;font-size:1.15rem;letter-spacing:-.02em}
.logo-mark{width:30px;height:30px;border-radius:8px;background:var(--board);display:grid;place-items:center}
.nav{display:flex;gap:6px;flex:1}
.nav a{padding:8px 12px;border-radius:8px;color:var(--muted);font-weight:560;font-size:.95rem}
.nav a:hover{background:var(--soft);color:var(--ink)}
.auth{display:flex;gap:10px;align-items:center;font-size:.9rem}
.icon-btn{width:38px;height:38px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer;display:grid;place-items:center;font-size:1rem}
.icon-btn:hover{background:var(--soft)}
@media(max-width:560px){
  .top-in{height:auto;min-height:64px;flex-wrap:wrap;gap:6px 10px;padding:8px 12px}
  .nav{order:2;flex:1 0 100%;justify-content:center}
  .nav a{padding:6px 12px}
  .auth{gap:4px}
  .auth>span,.auth .btn.primary{display:none}
  .auth button,.auth .btn{padding:7px 8px;font-size:.82rem}
}

/* buttons */
.btn,.auth button,.row button,.tb,.bm{font:inherit;font-weight:600;font-size:.92rem;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--ink);padding:9px 16px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:background .15s,border-color .15s}
.btn:hover,.auth button:hover,.tb:hover,.bm:hover{background:var(--soft)}
.btn.primary,.row button,.tb.on,.bm.on{background:var(--primary);border-color:var(--primary);color:var(--primary-ink)}
.btn.primary:hover,.row button:hover,.tb.on:hover{filter:brightness(1.08);background:var(--primary)}
.row button.alt{background:var(--bg);border-color:var(--line);color:var(--ink)}
.row button.alt:hover{background:var(--soft)}
.row button:disabled,.tb:disabled{opacity:.45;cursor:default;filter:none}
.btn.lg{padding:13px 22px;font-size:1rem}
.row{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:12px}
.row strong{align-self:center}

/* hero */
.hero{background:linear-gradient(180deg,var(--soft),var(--bg));border-bottom:1px solid var(--line)}
.hero-in{max-width:1200px;margin:0 auto;padding:56px 24px 64px;display:grid;grid-template-columns:1.05fr 1fr;gap:48px;align-items:center}
.hero p.lead{font-size:1.15rem;color:var(--muted);max-width:52ch}
.hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin:26px 0 18px}
.hero-facts{color:var(--muted);font-size:.92rem}
.hero-board{border-radius:20px;box-shadow:var(--shadow);overflow:hidden;border:6px solid #b98f5f;background:var(--board)}
.hero-board svg{display:block;width:100%;height:auto}
@media(max-width:860px){.hero-in{grid-template-columns:1fr;padding:36px 24px 44px;gap:32px}}

/* sections */
.section{padding:56px 0 8px}
.section-head{display:flex;justify-content:space-between;align-items:end;gap:16px;flex-wrap:wrap;margin-bottom:18px}
.search{width:100%;max-width:420px;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:12px 14px;color:var(--ink);font:inherit}
.search:focus{border-color:var(--primary)}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px}
.chip{border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:999px;padding:7px 15px;cursor:pointer;font:inherit;font-size:.9rem;font-weight:560}
.chip:hover{background:var(--soft)}
.chip.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.course-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:22px}
.course-card{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:16px;overflow:hidden;background:var(--bg);transition:box-shadow .2s,border-color .2s}
.course-card:hover{box-shadow:var(--shadow);border-color:var(--primary)}
.cover{display:block;width:100%;height:auto}
.board-bg{fill:var(--board)}
.cc-body{padding:16px 18px 18px;display:flex;flex-direction:column;gap:6px;flex:1}
.cc-body h3{margin:0;font-size:1.08rem}
.cc-body p{margin:0;color:var(--muted);font-size:.93rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cc-meta{margin-top:auto;padding-top:10px;display:flex;gap:10px;align-items:center;font-size:.85rem;color:var(--muted)}
.pill{background:var(--primary-soft);color:var(--primary);border-radius:999px;padding:2px 10px;font-weight:620;font-size:.78rem}
.empty{padding:30px;border:1px dashed var(--line);border-radius:14px;text-align:center}

/* features */
.features{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-top:56px}
.feat{padding:28px 24px;border-right:1px solid var(--line)}
.feat:last-child{border-right:0}
.feat svg{width:30px;height:30px;stroke:var(--primary);fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;margin-bottom:12px}
.feat h3{margin-bottom:6px}
.feat p{color:var(--muted);margin:0;font-size:.95rem}
@media(max-width:900px){.features{grid-template-columns:1fr 1fr}.feat:nth-child(2){border-right:0}.feat:nth-child(-n+2){border-bottom:1px solid var(--line)}}
@media(max-width:560px){.features{grid-template-columns:1fr}.feat{border-right:0;border-bottom:1px solid var(--line)}.feat:last-child{border-bottom:0}}
.cta-band{margin:64px 0 0;background:var(--board);color:var(--board-ink)}
.cta-in{max-width:1200px;margin:0 auto;padding:48px 24px;display:flex;justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap}
.cta-in h2{margin:0 0 6px;font-size:1.7rem}
.cta-in p{margin:0;opacity:.85}
.cta-in .btn{background:var(--chalk);border-color:var(--chalk);color:#2a2410}

/* footer */
.foot{border-top:1px solid var(--line);background:var(--soft);margin-top:0}
.foot-in{max-width:1200px;margin:0 auto;padding:40px 24px 28px;display:grid;grid-template-columns:2fr 1fr 1fr;gap:32px}
.foot h3{font-size:.95rem;margin-bottom:10px}
.foot a{display:block;color:var(--muted);padding:3px 0;font-size:.93rem}
.foot a:hover{color:var(--ink)}
.foot-note{max-width:1200px;margin:0 auto;padding:0 24px 28px;color:var(--muted);font-size:.85rem}
@media(max-width:700px){.foot-in{grid-template-columns:1fr}}

/* course page */
.c-head{background:var(--soft);border-bottom:1px solid var(--line);padding:22px 0 20px}
.crumbs{font-size:.88rem;color:var(--muted);display:flex;gap:8px;margin-bottom:10px}
.crumbs a:hover{color:var(--ink);text-decoration:underline}
.c-title{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.c-title h1{font-size:clamp(1.5rem,3vw,2.1rem);margin-bottom:4px}
.c-title p{margin:0}
.progress{display:flex;align-items:center;gap:14px;margin-top:14px;flex-wrap:wrap}
.bar{width:260px;max-width:100%;height:8px;border-radius:99px;background:var(--soft2);overflow:hidden}
.bar span{display:block;height:100%;background:var(--ok);border-radius:99px;transition:width .3s}
.c-layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:28px;padding-top:24px;padding-bottom:60px;align-items:start}
.c-side{position:sticky;top:84px;border:1px solid var(--line);border-radius:16px;padding:10px;max-height:calc(100vh - 110px);overflow-y:auto;background:var(--bg)}
@media(max-width:960px){.c-layout{grid-template-columns:1fr}.c-side{position:static;max-height:none}}
.video{position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:16px;overflow:hidden;box-shadow:var(--shadow)}
.video iframe{position:absolute;inset:0;width:100%;height:100%}
.player-row{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin:16px 0 4px}
.player-row h2{margin:0;font-size:1.3rem}
.player-row .row{margin:0}
.tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);margin:18px 0 20px;overflow-x:auto}
.tab{font:inherit;font-weight:600;font-size:.95rem;background:none;border:0;border-bottom:3px solid transparent;color:var(--muted);padding:10px 16px;cursor:pointer;white-space:nowrap}
.tab:hover{color:var(--ink)}
.tab.on{color:var(--ink);border-bottom-color:var(--primary)}
.toggle{display:flex;gap:10px;align-items:center;padding:10px 12px;font-weight:600;font-size:.92rem;border-bottom:1px solid var(--line);margin-bottom:6px}
.toggle small{font-weight:400}
.lesson{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:none;border:0;color:inherit;padding:11px 10px;border-radius:10px;cursor:pointer;font:inherit;font-size:.93rem}
.lesson:hover{background:var(--soft)}
.lesson.active{background:var(--primary-soft)}
.num{background:var(--soft2);border-radius:8px;min-width:28px;height:28px;display:grid;place-items:center;font-size:.8rem;font-weight:650}
.lesson.active .num{background:var(--primary);color:var(--primary-ink)}
.ltitle{flex:1}
.dot{width:22px;height:22px;border:2px solid var(--line);border-radius:50%;display:grid;place-items:center;font-size:.72rem;color:#fff}
.dot.on{background:var(--ok);border-color:var(--ok)}
.titlebar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap}
.titlebar h1{margin:0}

/* panels, forms */
.panel{background:var(--bg);border:1px solid var(--line);border-radius:14px;padding:18px;margin-top:20px}
.panel h2{margin-top:0}
.cert{background:var(--primary-soft);border-color:transparent;margin-top:14px}
.form{display:flex;flex-direction:column;gap:12px;margin-top:16px}
.form input:not([type=radio]):not([type=file]):not([type=checkbox]),.cm-input,.panel .form input:not([type=radio]):not([type=file]):not([type=checkbox]){background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:11px 13px;color:var(--ink);font:inherit;width:100%}
.form input:focus,.cm-input:focus{border-color:var(--primary)}
.cm-input{resize:vertical}
.notice{background:var(--primary-soft);border-left:4px solid var(--primary);padding:10px 14px;border-radius:8px}
.auth-card{max-width:440px;margin:56px auto;padding:32px;border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow)}
.auth-card h1{font-size:1.8rem}
button:disabled{cursor:not-allowed}

/* notes, quiz, comments, boards */
.notes h3,.quiz h3,.comments h3,.materials h3{margin:0 0 10px}
.editor{min-height:110px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:12px 14px;outline:none;line-height:1.55}
.editor:focus{border-color:var(--primary)}
.editor p,.rich p{margin:4px 0}
.editor ul,.editor ol,.rich ul,.rich ol{padding-left:22px;margin:4px 0}
.editor blockquote,.rich blockquote{border-left:3px solid var(--primary);margin:6px 0;padding-left:12px;color:var(--muted)}
.editor code,.rich code{background:var(--soft2);border-radius:4px;padding:1px 5px}
.editor h2,.rich h2{font-size:1.1rem;margin:8px 0 4px}
.rich{flex:1;min-width:0;word-break:break-word}
.wb-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}
.wb-wrap{margin-top:28px;max-width:900px}
.fmtbar{margin-bottom:8px}
.fmt{background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:5px 10px;cursor:pointer;font:inherit;font-size:.88rem;min-width:34px}
.fmt:hover{background:var(--soft)}
.fmt.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.note{display:flex;gap:12px;align-items:flex-start;background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:10px 14px;margin-top:10px}
.note p{flex:1;margin:0;word-break:break-word}
.ts{background:var(--primary-soft);color:var(--primary);border:0;border-radius:8px;padding:4px 10px;cursor:pointer;font:inherit;font-weight:620;font-size:.82rem;white-space:nowrap}
.del{background:none;border:0;color:var(--muted);cursor:pointer;font:inherit;font-size:.88rem}
.del:hover{color:var(--bad)}
.del:disabled{opacity:.3;cursor:default}
.q{background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-top:12px}
.q p{margin:0 0 8px}
.opt{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:8px;cursor:pointer}
.opt:hover{background:var(--soft2)}
.opt.right{background:color-mix(in srgb,var(--ok) 20%,transparent)}
.opt.wrong{background:color-mix(in srgb,var(--bad) 20%,transparent)}
.cm{background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin-top:10px}
.cm.reply{margin-left:28px;background:var(--bg)}
.cm p{margin:6px 0;white-space:pre-wrap;word-break:break-word}
.cm-head{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.cm-actions{display:flex;gap:14px}
.badge{background:var(--primary);color:var(--primary-ink);border-radius:999px;padding:1px 10px;font-size:.75rem;font-weight:650}
.pdf{width:100%;height:540px;margin-top:12px;border:1px solid var(--line);border-radius:12px;background:#fff}
.sw{width:26px;height:26px;border-radius:50%;border:2px solid var(--line);cursor:pointer;padding:0}
.sw.on{border-color:var(--primary);box-shadow:0 0 0 2px var(--primary)}
.wb select{background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:8px}
.wb-canvas{width:100%;height:auto;aspect-ratio:12/7;border-radius:14px;border:1px solid var(--line);touch-action:none;cursor:crosshair;display:block}
.wb:fullscreen{background:var(--bg);padding:16px;max-width:none;overflow:auto}
.xwrap{height:620px;border:1px solid var(--line);border-radius:14px;overflow:hidden}

/* creator studio and admin (from the repository) */
.creator-studio .form select,.creator-studio .form textarea{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:12px;color:var(--ink);font:inherit}
.creator-studio .form select{display:block;width:100%;margin-top:6px}
.creator-studio .form textarea{width:100%;resize:vertical}
.creator-publish{display:flex;gap:10px;align-items:center}
.creator-material-list{margin-top:32px}
.creator-material{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}
.creator-material h3{margin:0 0 10px}
.creator-content{white-space:pre-wrap;overflow-wrap:anywhere}
.creator-actions{display:flex;gap:8px;flex-shrink:0;align-self:flex-end}
.icon-btn svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
@media(max-width:560px){
  .auth-card{margin:32px 16px;padding:24px}
  .creator-material{flex-direction:column}
  .creator-actions{align-self:flex-start;flex-wrap:wrap}
  .xwrap{height:min(70vh,620px)}
  .pdf{height:min(65vh,540px)}
}

/* Let long course titles, note code, and admin JSON shrink inside flex/grid cells. */
.c-main,.c-title>div,.ltitle,.creator-material>div,.admin-record{min-width:0}
.c-title,.crumbs{flex-wrap:wrap}
.crumbs,.ltitle,.cc-body h3,.cm-head,.admin-record summary{overflow-wrap:anywhere}
.course-grid{grid-template-columns:repeat(auto-fill,minmax(min(270px,100%),1fr))}
.editor pre,.rich pre{max-width:100%;overflow-x:auto;white-space:pre;padding:10px;background:var(--soft2);border-radius:8px}
.admin-record{display:block;overflow-wrap:anywhere}
.admin-record label{display:block;margin-top:12px}
.admin-record textarea{display:block;width:100%;max-width:100%;resize:vertical;font:inherit;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:10px}
.auth{flex-wrap:wrap}
.auth>span[role=status]{max-width:220px;white-space:normal;overflow-wrap:anywhere}
.skip-link{position:fixed;top:8px;left:8px;z-index:100;background:var(--bg);padding:10px;border:2px solid var(--primary);transform:translateY(-150%)}
.skip-link:focus{transform:translateY(0)}
.skeleton{height:140px;background:var(--soft2);border-radius:14px;margin:16px 0}
.skeleton.video-skeleton{aspect-ratio:16/9;height:auto}
@media(max-width:560px){
  .auth{margin-left:auto}
  .note{flex-wrap:wrap}
  .note .rich{flex-basis:calc(100% - 96px)}
  .cm.reply{margin-left:12px}
}

@media(min-width:561px) and (max-width:860px){
  .top-in{height:auto;min-height:64px;flex-wrap:wrap;padding:12px 24px;gap:8px 16px}
  .nav{order:2;flex:1 0 100%;justify-content:center}
  .auth{margin-left:auto;max-width:100%}
}
```

## app/layout.js

```jsx
import "@fontsource-variable/inter";
import "./globals.css";
import Link from "next/link";
import AuthButton from "./AuthButton";
import ThemeToggle from "./ThemeToggle";
import { Analytics } from "@vercel/analytics/next";
import { SITE_URL } from "../lib/site";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Artificial Mana", template: "%s | Artificial Mana" },
  description: "Learn artificial intelligence. Use free video courses.",
  openGraph: { title: "Artificial Mana", description: "Learn artificial intelligence. Use free video courses.", siteName: "Artificial Mana", type: "website" },
};

// Sets the theme before the page shows, so there is no flash. The default is dark.
const themeScript = `(function(){try{var t=localStorage.getItem("artificial-mana-theme");if(t!=="light"&&t!=="dark"){t="dark"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}})()`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <header className="top">
          <div className="top-in">
            <Link href="/" className="logo">
              <span className="logo-mark" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#f3f1e7" strokeWidth="1.6">
                  <circle cx="4" cy="10" r="2"/><circle cx="16" cy="5" r="2"/><circle cx="16" cy="15" r="2" fill="#f4c542" stroke="#f4c542"/>
                  <path d="M6 9.4L14 5.6M6 10.6L14 14.4" strokeLinecap="round"/>
                </svg>
              </span>
              Artificial Mana
            </Link>
            <nav className="nav" aria-label="Main">
              <Link href="/#courses">Courses</Link>
              <Link href="/about">About</Link>
            </nav>
            <div className="auth"><ThemeToggle /><AuthButton /></div>
          </div>
        </header>
        <main id="main-content">{children}</main>
        <footer className="foot">
          <div className="foot-in">
            <div>
              <Link href="/" className="logo">Artificial Mana</Link>
              <p className="muted" style={{ maxWidth: 380 }}>Free video courses on artificial intelligence, with notes, boards, and quizzes in every lesson.</p>
            </div>
            <div><h3>Learn</h3><Link href="/#courses">All courses</Link><Link href="/about">About</Link></div>
            <div><h3>Legal</h3><Link href="/privacy">Privacy</Link></div>
          </div>
          <p className="foot-note">© Artificial Mana</p>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
```

## app/loading.js

```jsx
export default function Loading() {
  return <div className="wrap" role="status" aria-live="polite">
    <p className="muted">Loading courses...</p>
    <div className="skeleton" aria-hidden="true" />
    <div className="skeleton" aria-hidden="true" />
  </div>;
}
```

## app/login/page.js

```jsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function go(mode) {
    if (!supabase) { setMsg("Sign-in is temporarily unavailable. You can still browse courses and save learning progress in this browser."); return; }
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setMsg("Enter your email and password to continue.");
      return;
    }
    if (mode === "signup" && password.length < 6) {
      setMsg("Your password must be at least 6 characters long.");
      return;
    }
    setBusy(true); setMsg("");
    try {
      const fn = mode === "signup" ? supabase.auth.signUp : supabase.auth.signInWithPassword;
      const { data, error } = await fn.call(supabase.auth, { email: cleanEmail, password });
      if (error) { setMsg(error.message); return; }
      if (mode === "signup" && !data.session) { setMsg("Your account is made. Open the email we sent and confirm it. Then log in."); return; }
      const next = new URLSearchParams(window.location.search).get("next");
      const requested = new URL(next || "/", window.location.origin);
      const destination = requested.origin === window.location.origin
        ? `${requested.pathname}${requested.search}${requested.hash}`
        : "/";
      router.push(destination);
    } catch (error) {
      console.error("Unable to authenticate with Supabase.", error);
      setMsg("Could not reach the sign-in service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="login-title">
      <h1 id="login-title">Welcome</h1>
      <p className="muted">Log in to save your progress on all your devices.</p>
      <form className="form" onSubmit={(event) => { event.preventDefault(); go("login"); }}>
        <label htmlFor="login-email">Email</label>
        <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="login-password">Password</label>
        <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="row">
          <button type="submit" disabled={busy}>Log in</button>
          <button type="button" disabled={busy} onClick={() => go("signup")}>Sign up</button>
        </div>
        {msg && <p className="notice" role="status" aria-live="polite">{msg}</p>}
      </form>
    </section>
  );
}
```

## lib/richtext.js

```jsx
import StarterKit from "@tiptap/starter-kit";
import { generateHTML, generateJSON } from "@tiptap/html";

// The note editor allows only these formats: bold, italic, strike, headings, lists, quote, code.
// Links are off on purpose. This keeps the notes safe.
export const extensions = [StarterKit.configure({ link: false })];

const esc = (t) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// Make a note safe to show. The editor rules remove anything else (scripts, images, event code).
// Old notes were plain text. This also shows them.
export function safeHtml(content) {
  // Malformed or legacy database rows must not crash the entire lesson.
  content = typeof content === "string" ? content : "";
  const raw = /^\s*<(p|h[1-6]|ul|ol|blockquote|pre)[\s>]/i.test(content)
    ? content
    : "<p>" + esc(content).replace(/\n/g, "<br>") + "</p>";
  try {
    return generateHTML(generateJSON(raw, extensions), extensions);
  } catch (e) {
    return "<p>" + esc(content) + "</p>";
  }
}
```

## lib/use-debounced-save.js

```jsx
"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Capture each save's destination when scheduling; navigation must never redirect a pending write.
export function useDebouncedSave(delay = 1000) {
  const timer = useRef(null);
  const pending = useRef(null);
  const last = useRef(null);
  const queue = useRef(Promise.resolve());
  const mounted = useRef(true);
  const [message, setMessage] = useState("");
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const action = pending.current;
    pending.current = null;
    if (!action) return;
    last.current = action;
    // Serialize writes so a slow earlier request cannot overwrite a newer drawing.
    queue.current = queue.current.then(action).then(() => {
      if (mounted.current) setMessage("");
    }).catch((error) => {
      console.error("Unable to save the board.", error);
      if (mounted.current) setMessage("Your board could not be saved. Keep this page open and retry.");
    });
  }, []);
  const schedule = useCallback((action) => {
    pending.current = action;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, delay);
  }, [delay, flush]);
  const retry = useCallback(() => { pending.current ||= last.current; flush(); }, [flush]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Flush on in-app navigation/unmount; abrupt browser shutdown is not guaranteed.
      flush();
    };
  }, [flush]);
  return { schedule, flush, retry, message };
}
```

## package.json

```json
{
  "name": "artificialmana",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --project tsconfig.typecheck.json",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "test:smoke": "playwright test --config playwright.smoke.config.js",
    "check": "npm run lint && npm run typecheck && npm test && npm run build"
  },
  "dependencies": {
    "@excalidraw/excalidraw": "0.18.1",
    "@fontsource-variable/inter": "5.3.0",
    "@supabase/supabase-js": "2.117.3",
    "@tiptap/core": "3.31.4",
    "@tiptap/html": "3.31.4",
    "@tiptap/pm": "3.31.4",
    "@tiptap/react": "3.31.4",
    "@tiptap/starter-kit": "3.31.4",
    "@vercel/analytics": "^2.0.1",
    "next": "16.4.0",
    "pdf-lib": "1.17.1",
    "react": "19.3.0",
    "react-dom": "19.3.0"
  },
  "engines": {
    "node": ">=20.9.0"
  },
  "devDependencies": {
    "@next/env": "16.4.0",
    "@playwright/test": "1.64.0",
    "@testing-library/dom": "10.4.2",
    "@testing-library/jest-dom": "7.0.1",
    "@testing-library/react": "16.3.3",
    "@testing-library/user-event": "14.6.7",
    "@vitejs/plugin-react": "6.1.2",
    "eslint": "^9.39.5",
    "eslint-config-next": "^16.4.0",
    "jsdom": "30.1.2",
    "typescript": "^5.9.3",
    "vitest": "5.0.3"
  }
}
```

## playwright.smoke.config.js

```jsx
const { defineConfig } = require("@playwright/test");

// Public UI checks run without credentials or database writes. Full learning E2E
// remains in playwright.config.js with its separate-Supabase-project guard.
module.exports = defineConfig({
  testDir: "./tests/smoke",
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3100",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    env: { NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", ADMIN_TEMP_ACCESS_KEY: "" },
    timeout: 120000,
  },
});
```
