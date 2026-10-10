"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

const when = (d) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function Comments({ slug, lessonId, user, teacher }) {
  const [list, setList] = useState([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [rtext, setRtext] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    if (!supabase) return;
    supabase.from("comments").select("*").eq("course_slug", slug).eq("lesson_id", lessonId)
      .order("created_at").then(({ data, error }) => {
        if (error) setMsg("The comments cannot load now. Try again later.");
        setList(data || []);
      });
  }, [slug, lessonId]);
  useEffect(() => { setList([]); setReplyTo(null); load(); }, [load]);
  useEffect(() => { try { setName(localStorage.getItem("comment-name") || ""); } catch (e) {} }, []);

  if (!supabase) return null;

  async function post(body, parent) {
    if (!name.trim()) { setMsg("Write your name first."); return false; }
    if (!body.trim()) return false;
    const { error } = await supabase.from("comments").insert({
      course_slug: slug, lesson_id: lessonId, parent_id: parent,
      author_name: name.trim().slice(0, 40), body: body.trim().slice(0, 1000),
    });
    if (error) {
      setMsg(error.message.includes("slow_down") ? "Please wait one minute before you post again." : error.message);
      return false;
    }
    try { localStorage.setItem("comment-name", name.trim()); } catch (e) {}
    setMsg(""); load();
    return true;
  }
  async function remove(c) {
    if (!window.confirm("Delete this comment?")) return;
    await supabase.from("comments").delete().eq("id", c.id);
    load();
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
        {(teacher || (user && c.user_id === user.id)) && <button className="del" onClick={() => remove(c)}>Delete</button>}
      </div>
      {replyTo === c.id && (
        <div className="form">
          <textarea rows={2} className="cm-input" placeholder="Write a reply" value={rtext} onChange={(e) => setRtext(e.target.value)} />
          <div className="row">
            <button disabled={!rtext.trim()} onClick={async () => { if (await post(rtext, c.id)) { setReplyTo(null); setRtext(""); } }}>Post reply</button>
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
            <button disabled={!text.trim()} onClick={async () => { if (await post(text, null)) setText(""); }}>Post</button>
          </div>
        </div>
      ) : (
        <p className="muted"><Link href="/login" style={{ textDecoration: "underline" }}>Log in</Link> to ask a question or write a comment.</p>
      )}
      {msg && <p className="notice">{msg}</p>}
      {top.map((c) => (
        <div key={c.id}>
          {item(c, false)}
          {list.filter((r) => r.parent_id === c.id).map((r) => <div key={r.id}>{item(r, true)}</div>)}
        </div>
      ))}
      {!top.length && <p className="muted">No comments yet. Be the first.</p>}
    </div>
  );
}
