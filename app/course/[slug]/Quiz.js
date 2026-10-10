"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

const QUESTIONS_PER_BATCH = 10;

export default function Quiz({ quiz, slug, lessonId, user, onResult }) {
  const [pick, setPick] = useState({});
  const [score, setScore] = useState(null);
  const [best, setBest] = useState(null);
  const [visibleCount, setVisibleCount] = useState(QUESTIONS_PER_BATCH);
  const [message, setMessage] = useState("");
  const key = `quiz:${slug}:${lessonId}`;
  const visibleQuiz = quiz.slice(0, visibleCount);

  useEffect(() => {
    setPick({});
    setScore(null);
    setBest(null);
    setVisibleCount(QUESTIONS_PER_BATCH);
    setMessage("");
    if (supabase && user) {
      supabase.from("quiz_results").select("score,total").eq("user_id", user.id)
        .eq("course_slug", slug).eq("lesson_id", lessonId).maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            setMessage(`Could not load your saved score: ${error.message}`);
            return;
          }
          if (data) setBest(data);
        })
        .catch((error) => {
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
  }, [key, user, slug, lessonId]);

  async function check() {
    const s = visibleQuiz.filter((q, i) => pick[i] === q.answer).length;
    const result = { score: s, total: visibleQuiz.length };
    setScore(s);
    setMessage("");
    const isBetter = !best
      || s * best.total > best.score * result.total
      || (s * best.total === best.score * result.total && result.total > best.total);
    if (!isBetter) {
      if (onResult) onResult();
      return;
    }

    try {
      if (supabase && user) {
        const { error } = await supabase.from("quiz_results").upsert(
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
      setMessage("Your score could not be saved. Please try again.");
    }
  }

  const all = visibleQuiz.every((q, i) => pick[i] !== undefined);
  return (
    <div className="quiz">
      <h3>Quick quiz</h3>
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
      {score === null ? (
        <div className="row"><button disabled={!all} onClick={check}>Check answers</button></div>
      ) : (
        <div className="row">
          <strong>You got {score} of {visibleQuiz.length}.</strong>
          <button onClick={() => { setPick({}); setScore(null); }}>Try again</button>
        </div>
      )}
      {message && <p role="alert">{message}</p>}
    </div>
  );
}
