# Credits

This project uses open-source code. Each part keeps its own license.

| Part | Use | License |
|---|---|---|
| Next.js, React | The website | MIT |
| Excalidraw (@excalidraw/excalidraw) | The diagram board | MIT |
| pdf-lib | The certificate PDF | MIT |
| Tiptap (@tiptap/*) | The rich note editor | MIT |
| Vitest, Testing Library, jsdom | Tests only (dev tools) | MIT |
| Playwright | Browser tests only | Apache-2.0 |
| @next/env | Loads local test settings | MIT |
| Inter font (@fontsource-variable/inter) | Text font, hosted by the site itself | OFL-1.1 |

Accounts, local database access, file storage, and the admin access gate use built-in Next.js and Node.js features. SQLite is bundled with Node.js and is public domain; it is not a separately installed package.

Rule: add only MIT, Apache 2.0, or BSD code. Fonts under the OFL license are also fine. Check the license before you add a library.
Add each new library to this table.
