"use client";
import { publicSignupEnabled } from "../../../lib/backend-config";
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
      {!loggedIn && <p className="muted">Your notes stay in this browser.{publicSignupEnabled() ? " Log in to keep them on all your devices." : " Download a PDF to keep a copy."}</p>}
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
