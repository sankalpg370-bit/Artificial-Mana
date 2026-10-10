export const metadata = { title: "Privacy" };
export default function Privacy() {
  return (
    <div className="wrap prose">
      <h1>Privacy</h1>
      <p className="muted">Draft. Read it, change it for your needs, and ask a legal expert to check it before you grow.</p>
      <h2>What we keep</h2>
      <ul>
        <li>Your email address and your password (the password is stored in a protected form).</li>
        <li>Your lesson progress, quiz scores, notes, and bookmarks.</li>
      </ul>
      <h2>Where we keep it</h2>
      <p>We keep this data with Supabase. Only you can read your own notes, scores, and progress.</p>
      <h2>Videos</h2>
      <p>The videos come from YouTube. YouTube can set its own cookies when you play a video.</p>
      <h2>Your choices</h2>
      <p>You can ask us to delete your account and your data. Write to: [your email here]</p>
    </div>
  );
}
