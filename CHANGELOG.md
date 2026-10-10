# Changes from v1 to v11

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

Final package (v12): all of the above in one project. All database steps are in `supabase-all.sql`.

The project guide (`artificialmana-guide.html`) is now the complete version: updated diagram, features, roles, database tables, teacher steps, set-up, safety, fixes, and a list of what is not built yet.
