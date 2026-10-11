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
