"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { publicSignupEnabled } from "../../../lib/backend-config";
import { backend } from "../../../lib/backend";

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
    if (!backend) return;
    const id = ++request.current;
    setLoading(true);
    try {
      const { data, error } = await backend.from("comments").select("*").eq("course_slug", slug).eq("lesson_id", lessonId).order("created_at");
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

  if (!backend) return null;

  async function post(body, parent) {
    if (!name.trim()) { setMsg("Write your name first."); return false; }
    if (!body.trim()) return false;
    if (!user || pending.current) return false;
    pending.current = true;
    setBusy(true);
    try {
      const { error } = await backend.from("comments").insert({
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
      const { error } = await backend.from("comments").delete().eq("id", comment.id);
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
        <p className="muted">{publicSignupEnabled() ? <><Link href="/login" style={{ textDecoration: "underline" }}>Log in</Link> to ask a question or write a comment.</> : "Everyone can read comments. Posting is available to existing accounts."}</p>
      )}
      {loading && <p role="status">Loading comments...</p>}
      {msg && <p className="notice" role="alert">{msg} <button type="button" onClick={load}>Retry loading</button></p>}
      {top.map((c) => (
        <div key={c.id}>
          {item(c, false)}
          {list.filter((r) => r.parent_id === c.id).map((r) => <div key={r.id}>{item(r, true)}</div>)}
        </div>
      ))}
      {!loading && !msg && !top.length && <p className="muted">No comments yet.{(user || publicSignupEnabled()) && " Be the first."}</p>}
    </div>
  );
}
