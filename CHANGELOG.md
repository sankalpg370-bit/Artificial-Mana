# Artificial Mana changes

| Version | What was added |
|---|---|
| v1 | Home page, course page, video player, lesson list, Play All |
| v2 | Student sign-up and login, saved progress (Supabase) |
| v3 | Notes with video timestamps |
| v4 | Lesson PDFs, download notes as PDF |
| v5 | Bookmarks, resume, My courses; text rewritten in simple English |
| v6 | Quizzes, search, categories, About and Privacy pages |
| v7 | Chalkboard / whiteboard with pen, marker, highlighter, shapes, text, eraser |
| v8 | Diagram board (Excalidraw); upgrade to Next.js 16 and React 19 (security fix) |
| v9 | Teachers and the Admin page (courses, lessons, PDFs, quizzes) with edit |
| v10 | Certificates (pdf-lib), rich notes (Tiptap) |
| v11 | Live teacher board (Supabase Realtime), questions and comments |
| v12 | 28 automatic tests; fix: progress made before login now copies to the account; fix: progress count could be too high after a lesson was deleted; sitemap, robots, and page titles for search engines; privacy-friendly YouTube player; accessibility labels |
| v13 | New design: sticky header, hero with a chalkboard picture, course cards with drawn covers, features row, call-to-action, footer; course page with progress bar, tabs (Notes, Quiz, Materials, Boards, Questions) and a sticky lesson list; Inter font |
| v14 | Merged with the Creator Studio, Full site control, and private creator files from the repository. Upload extension/MIME checks and storage MIME/size limits in step 14. One site address setting (www). Privacy page says that admins can read account data and mentions analytics. 55 tests |
| v15 | 57 unit tests. Playwright browser tests for visitor, student, and admin flows. GitHub Actions checks tests and production build. Private course-state and creator-material queries now filter by owner. Browser tests require a separate Supabase test project. |
| v16 | Temporary admin portal gate with a short-lived secure cookie, an optional server-only access key, a manual lock button, and tests. Supabase login and admin roles remain required. |

| v17 | Frontend audit: durable notes and drawing saves, stale-request guards, player cleanup, responsive layouts, theme synchronization, accessible tabs, and error recovery. |
| v18 | Home-PC backend: local SQLite accounts/data, protected uploads, cookie sessions, server-side roles, polling teacher boards, Windows startup and backup tools. Supabase and analytics packages removed. See `DEPLOYMENT.md` for current Windows/public hosting instructions. |

The SQL files and `artificialmana-guide.html` describe earlier Supabase releases and remain only as historical references. They are not used by the current server. Current setup, QA, and code are documented in `README.md`, `DEPLOYMENT.md`, and `audit/`.
