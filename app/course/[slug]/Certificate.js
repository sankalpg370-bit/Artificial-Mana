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
      a.href = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      a.download = `certificate-${course.slug}.pdf`;
      a.click();
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
        <input className="search" style={{ margin: 0, maxWidth: 320 }} placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="tb on" disabled={busy} onClick={make}>{busy ? "Making..." : "Download certificate"}</button>
      </div>
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}
