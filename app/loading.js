export default function Loading() {
  return <div className="wrap" role="status" aria-live="polite">
    <p className="muted">Loading courses...</p>
    <div className="skeleton" aria-hidden="true" />
    <div className="skeleton" aria-hidden="true" />
  </div>;
}
