export default function LoadingCourse() {
  return <div className="wrap" role="status" aria-live="polite">
    <p className="muted">Loading course and lessons...</p>
    <div className="skeleton video-skeleton" aria-hidden="true" />
  </div>;
}
