"use client";
import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import { useEffect, useRef, useState } from "react";
import { backend } from "../../../lib/backend";
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
        if (backend && user) {
          const { data, error } = await backend.from("boards").select("data").eq("user_id", user.id).eq("course_slug", slug).eq("lesson_id", dbId).maybeSingle();
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
      if (backend && user) {
        const { error } = await backend.from("boards").upsert({ user_id: user.id, course_slug: slug, lesson_id: dbId, data }, { onConflict: "user_id,course_slug,lesson_id" });
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
