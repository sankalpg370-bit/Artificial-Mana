import "@fontsource-variable/inter";
import "./globals.css";
import Link from "next/link";
import AuthButton from "./AuthButton";
import ThemeToggle from "./ThemeToggle";
import { Analytics } from "@vercel/analytics/next";
import { SITE_URL } from "../lib/site";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Artificial Mana", template: "%s | Artificial Mana" },
  description: "Learn artificial intelligence. Use free video courses.",
  openGraph: { title: "Artificial Mana", description: "Learn artificial intelligence. Use free video courses.", siteName: "Artificial Mana", type: "website" },
};

// Sets the theme before the page shows, so there is no flash. The default is dark.
const themeScript = `(function(){try{var t=localStorage.getItem("artificial-mana-theme");if(t!=="light"&&t!=="dark"){t="dark"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}})()`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <header className="top">
          <div className="top-in">
            <Link href="/" className="logo">
              <span className="logo-mark" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#f3f1e7" strokeWidth="1.6">
                  <circle cx="4" cy="10" r="2"/><circle cx="16" cy="5" r="2"/><circle cx="16" cy="15" r="2" fill="#f4c542" stroke="#f4c542"/>
                  <path d="M6 9.4L14 5.6M6 10.6L14 14.4" strokeLinecap="round"/>
                </svg>
              </span>
              Artificial Mana
            </Link>
            <nav className="nav" aria-label="Main">
              <Link href="/#courses">Courses</Link>
              <Link href="/about">About</Link>
            </nav>
            <div className="auth"><ThemeToggle /><AuthButton /></div>
          </div>
        </header>
        <main id="main-content">{children}</main>
        <footer className="foot">
          <div className="foot-in">
            <div>
              <Link href="/" className="logo">Artificial Mana</Link>
              <p className="muted" style={{ maxWidth: 380 }}>Free video courses on artificial intelligence, with notes, boards, and quizzes in every lesson.</p>
            </div>
            <div><h3>Learn</h3><Link href="/#courses">All courses</Link><Link href="/about">About</Link></div>
            <div><h3>Legal</h3><Link href="/privacy">Privacy</Link></div>
          </div>
          <p className="foot-note">© Artificial Mana</p>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
