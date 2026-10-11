"use client";

export default function Error({ reset }) {
  return (
    <div className="wrap" role="alert">
      <h1>Something went wrong</h1>
      <p className="muted">We could not load this page. Please try again.</p>
      <button type="button" onClick={reset}>Try again</button>
    </div>
  );
}
