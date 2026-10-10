"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function Quiz({ quiz, slug, lessonId, user, onResult }) {
  const [pick, setPick] = useState({});
  const [score, setScore] = useState(null);
  const [best, setBest] = useState(null);
  const key = `quiz:${slug}:${lessonId}`;

  useEffect(() => {
    setPick({}); setScore(null); setBest(null);
    if (supabase && user) {
      supabase.from("quiz_results").select("score,total").eq("course_slug", slug).eq("lesson_id", lessonId)
        .maybeSingle().then(({ data }) => { if (data) setBest(data); });
    } else {
      try { setBest(JSON.parse(localStorage.getItem(key))); } catch (e) {}
    }
  }, [key, user]);

  function check() {
    const s = quiz.filter((q, i) => pick[i] === q.answer).length;
    setScore(s);
    if (best && s < best.score) return; // keep the best score
    const r = { score: s, total: quiz.length };
    setBest(r);
    if (supabase && user) {
      supabase.from("quiz_results").upsert(
        { user_id: user.id, course_slug: slug, lesson_id: lessonId, ...r },
        { onConflict: "user_id,course_slug,lesson_id" }
      ).then(() => onResult && onResult());
    } else {
      try { localStorage.setItem(key, JSON.stringify(r)); } catch (e) {}
      if (onResult) onResult();
    }
  }

  const all = quiz.every((q, i) => pick[i] !== undefined);
  return (
    <div className="quiz">
      <h3>Quick quiz</h3>
      {best && <p className="muted">Your best score: {best.score} of {best.total}</p>}
      {quiz.map((q, i) => (
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
      {score === null ? (
        <div className="row"><button disabled={!all} onClick={check}>Check answers</button></div>
      ) : (
        <div className="row">
          <strong>You got {score} of {quiz.length}.</strong>
          <button onClick={() => { setPick({}); setScore(null); }}>Try again</button>
        </div>
      )}
    </div>
  );
}
