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
