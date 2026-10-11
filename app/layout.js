import "./globals.css";
import Link from "next/link";
import AuthButton from "./AuthButton";
import ThemeToggle from "./ThemeToggle";
import { Analytics } from '@vercel/analytics/next';
export const metadata = {
  metadataBase: new URL("https://artificialmana.com"),
  title: { default: "Artificial Mana", template: "%s | Artificial Mana" },
  description: "Learn artificial intelligence. Use free video courses.",
  openGraph: { title: "Artificial Mana", description: "Learn artificial intelligence. Use free video courses.", siteName: "Artificial Mana", type: "website" },
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <Link href="/" className="logo">Artificial Mana</Link>
          <div className="header-actions">
            <ThemeToggle />
            <AuthButton />
          </div>
        </header>
        <main>{children}</main>
        <footer className="foot"><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><span className="muted">© Artificial Mana</span></footer>
        <Analytics />
      </body>
    </html>
  );
}
