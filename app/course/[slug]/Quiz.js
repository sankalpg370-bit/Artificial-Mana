"use client";
import { useEffect, useState } from "react";
import { backend } from "../../../lib/backend";

const QUESTIONS_PER_BATCH = 10;

export default function Quiz({ quiz, slug, lessonId, user, onResult }) {
  const [pick, setPick] = useState({});
  const [score, setScore] = useState(null);
  const [best, setBest] = useState(null);
  const [visibleCount, setVisibleCount] = useState(QUESTIONS_PER_BATCH);
  const [message, setMessage] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const key = `quiz:${slug}:${lessonId}`;
  const visibleQuiz = quiz.slice(0, visibleCount);

  useEffect(() => {
    let active = true;
    setPick({});
    setScore(null);
    setBest(null);
    setVisibleCount(QUESTIONS_PER_BATCH);
    setMessage("");
    setSaveFailed(false);
    if (backend && user) {
      backend.from("quiz_results").select("score,total").eq("user_id", user.id)
        .eq("course_slug", slug).eq("lesson_id", lessonId).maybeSingle()
        .then(({ data, error }) => {
          if (!active) return;
          if (error) {
            setMessage(`Could not load your saved score: ${error.message}`);
            return;
          }
          if (data) setBest(data);
        })
        .catch((error) => {
          if (!active) return;
          console.error("Unable to load the saved quiz score.", error);
          setMessage("Could not load your saved score. Please try again.");
        });
    } else {
      try {
        setBest(JSON.parse(localStorage.getItem(key)));
      } catch (error) {
        console.error("Unable to load the saved quiz score.", error);
        setMessage("Could not load your saved score from this browser.");
      }
    }
    return () => { active = false; };
  }, [key, user, slug, lessonId]);

  async function check() {
    if (saving || !quiz.length || !quiz.every((q, i) => pick[i] !== undefined)) return;
    const s = quiz.filter((q, i) => pick[i] === q.answer).length;
    const result = { score: s, total: quiz.length };
    setScore(s);
    setMessage("");
    const isBetter = !best || best.total !== quiz.length
      || s * best.total > best.score * result.total
      || (s * best.total === best.score * result.total && result.total > best.total);
    if (!isBetter) {
      if (onResult) onResult();
      return;
    }

    setSaving(true);
    setSaveFailed(false);
    try {
      if (backend && user) {
        const { error } = await backend.from("quiz_results").upsert(
          { user_id: user.id, course_slug: slug, lesson_id: lessonId, ...result },
          { onConflict: "user_id,course_slug,lesson_id" }
        );
        if (error) throw new Error(error.message);
      } else {
        window.localStorage.setItem(key, JSON.stringify(result));
      }
      setBest(result);
      if (onResult) onResult();
    } catch (error) {
      console.error("Unable to save the quiz score.", error);
      setSaveFailed(true);
      setMessage("Your score could not be saved. Please try again.");
    } finally { setSaving(false); }
  }

  async function downloadAnswerKey() {
    setPdfBusy(true);
    setMessage("");
    try {
      const { makeQuizPdf } = await import("../../../lib/quiz-pdf");
      const bytes = await makeQuizPdf({ quiz, title: "Artificial Mana Quick Quiz" });
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `quiz-answer-key-${slug}-${lessonId}.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Unable to create the quiz answer key PDF.", error);
      setMessage("Could not create the PDF. Check that the quiz text uses supported characters and try again.");
    } finally {
      setPdfBusy(false);
    }
  }

  const all = quiz.length > 0 && quiz.every((q, i) => pick[i] !== undefined);
  return (
    <div className="quiz">
      <h3>Quick quiz</h3>
      <div className="row">
        <button className="alt" type="button" disabled={pdfBusy} onClick={downloadAnswerKey}>
          {pdfBusy ? "Creating PDF..." : "Download quiz + answer key PDF"}
        </button>
      </div>
      {best && <p className="muted">Your best score: {best.score} of {best.total}</p>}
      {visibleQuiz.map((q, i) => (
        <div key={i} className="q">
          <p><b>{i + 1}. {q.q}</b></p>
          {q.options.map((o, j) => {
            let cls = "opt";
            if (score !== null) cls += j === q.answer ? " right" : pick[i] === j ? " wrong" : "";
            return (
              <label key={j} className={cls}>
                <input type="radio" name={`q${i}`} disabled={score !== null} checked={pick[i] === j}
                  onChange={() => setPick({ ...pick, [i]: j })} />
                <span>{o}</span>
              </label>
            );
          })}
        </div>
      ))}
      {visibleCount < quiz.length && (
        <div className="row">
          <button
            className="alt"
            type="button"
            disabled={score !== null}
            onClick={() => setVisibleCount((count) => Math.min(count + QUESTIONS_PER_BATCH, quiz.length))}
          >
            Show {Math.min(QUESTIONS_PER_BATCH, quiz.length - visibleCount)} more questions
          </button>
        </div>
      )}
      {visibleCount < quiz.length && <p className="muted">Show and answer all {quiz.length} questions before checking your answers.</p>}
      {score === null ? (
        <div className="row"><button disabled={!all || saving} onClick={check}>Check answers</button></div>
      ) : (
        <div className="row">
          <strong>You got {score} of {visibleQuiz.length}.</strong>
          <button disabled={saving} onClick={() => { setPick({}); setScore(null); setSaveFailed(false); }}>Try again</button>
          {saveFailed && <button disabled={saving} onClick={check}>Retry saving score</button>}
        </div>
      )}
      {message && <p role="alert">{message}</p>}
    </div>
  );
}
