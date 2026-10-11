"use client";
import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";

// Diagram board. It uses Excalidraw (MIT license). See CREDITS.md.
export default function ExcalidrawBoard({ slug, lessonId, user }) {
  const [init, setInit] = useState(null);
  const timer = useRef(null);
  const dbId = `${lessonId}:diagram`;
  const key = `xboard:${slug}:${lessonId}`;

  useEffect(() => {
    setInit(null);
    const apply = (d) => setInit({ elements: (d && d.elements) || [] });
    if (supabase && user) {
      supabase.from("boards").select("data").eq("user_id", user.id).eq("course_slug", slug).eq("lesson_id", dbId).maybeSingle()
        .then(({ data }) => apply(data && data.data));
    } else {
      let d = null;
      try { d = JSON.parse(localStorage.getItem(key)); } catch (e) {}
      apply(d);
    }
  }, [key, user]);

  function onChange(elements) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const data = { elements: elements.filter((e) => !e.isDeleted) };
      if (supabase && user) {
        supabase.from("boards").upsert({ user_id: user.id, course_slug: slug, lesson_id: dbId, data },
          { onConflict: "user_id,course_slug,lesson_id" }).then(() => {});
      } else {
        try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
      }
    }, 1200);
  }

  if (!init) return <p className="muted">Loading the board...</p>;
  return (
    <Excalidraw key={key} theme="dark" onChange={onChange}
      initialData={{ elements: init.elements, appState: { viewBackgroundColor: "#1f3b2d" } }} />
  );
}
