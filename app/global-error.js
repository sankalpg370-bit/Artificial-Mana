"use client";

// Root layout failures bypass app/error.js; this boundary supplies its own document.
// Next 16.4 retry re-fetches failed server content as well as resetting the boundary.
export default function GlobalError({ retry }) {
  return <html lang="en"><body style={{ fontFamily: "system-ui", padding: 24 }}>
    <h1>Something went wrong</h1>
    <p role="alert">We could not load the site. Please try again.</p>
    <button type="button" onClick={retry}>Try again</button>
  </body></html>;
}
