"use client";
import Link from "next/link";
import { useState } from "react";

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
    <div style={{ marginTop: 32 }}>
      <h2>All courses</h2>
      <input className="search" aria-label="Search courses and lessons" placeholder="Search courses and lessons" value={text} onChange={(e) => setText(e.target.value)} />
      {cats.length > 2 && (
        <div className="chips">
          {cats.map((c) => (
            <button key={c} className={"chip" + (c === cat ? " on" : "")} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
      )}
      <div className="grid">
        {list.map((c) => (
          <Link key={c.slug} href={`/course/${c.slug}`} className="card">
            <h2>{c.title}</h2>
            <p className="muted">{c.description}</p>
            <span className="muted">{c.category ? c.category + " · " : ""}{c.lessons.length} lessons</span>
          </Link>
        ))}
      </div>
      {!list.length && <p className="muted">No course found. Try a different word.</p>}
    </div>
  );
}
