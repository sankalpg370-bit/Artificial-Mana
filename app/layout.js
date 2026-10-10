import "./globals.css";
import Link from "next/link";
import AuthButton from "./AuthButton";
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
        <header className="top"><Link href="/" className="logo">Artificial Mana</Link><AuthButton /></header>
        <main>{children}</main>
        <footer className="foot"><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><span className="muted">© Artificial Mana</span></footer>
      </body>
    </html>
  );
}
