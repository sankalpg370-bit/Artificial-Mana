"use client";

// Next 16.4 retry re-fetches failed server content as well as resetting the boundary.
export default function Error({ retry }) {
  return (
    <div className="wrap" role="alert">
      <h1>Something went wrong</h1>
      <p className="muted">We could not load this page. Please try again.</p>
      <button type="button" onClick={retry}>Try again</button>
    </div>
  );
}
