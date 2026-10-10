"use client";
import { useState } from "react";
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
  const editor = useEditor({
    extensions,
    content: "",
    immediatelyRender: false,
    editorProps: { attributes: { class: "editor", "aria-label": "Write a note for this lesson" } },
    onFocus: () => setT(getTime()),
  });

  function submit() {
    if (!editor || editor.isEmpty) return;
    onAdd(editor.getHTML(), t);
    editor.commands.clearContent();
  }

  return (
    <div className="notes">
      <h3>My notes</h3>
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
      <div className="row">
        <button onClick={submit}>Save note at {fmt(t)}</button>
        <button className="alt" onClick={onExport}>Download notes as PDF</button>
      </div>
      {!loggedIn && <p className="muted">Your notes stay in this browser. Log in to keep them on all your devices.</p>}
      {notes.map((n) => (
        <div key={n.id} className="note">
          <button className="ts" onClick={() => onSeek(n.seconds)}>▶ {fmt(n.seconds)}</button>
          {/* safeHtml keeps only the formats the editor allows */}
          <div className="rich" dangerouslySetInnerHTML={{ __html: safeHtml(n.content) }} />
          <button className="del" onClick={() => onDelete(n.id)} aria-label="Delete note">✕</button>
        </div>
      ))}
    </div>
  );
}
