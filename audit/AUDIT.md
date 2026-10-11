# Artificial Mana frontend audit — October 11, 2026

The authorized target is the existing Artificial Mana learning app. Its frontend uses Next.js, React, custom CSS, Supabase, Tiptap, Excalidraw, and YouTube. Chat history, AI token streaming, Markdown chat rendering, and chat copy buttons are not part of this application.

## Confirmed issues and fixes

| Area | Confirmed issue | Implemented correction |
| --- | --- | --- |
| Lesson notes | Save cleared the editor before database persistence; insert/delete errors were ignored | Await persistence before clearing, preserve drafts on failure, disable duplicate actions, surface save/delete/export failures |
| Session/lesson changes | Late responses could replace a different lesson's notes, course state, quiz best score, or admin category | Cancel stale reads; isolate classroom state by course/account and lesson tools by lesson; invalidate admin/creator list requests |
| Authentication | Initial session reads could race newer auth events; admin page did not observe logout | Ignore outdated initial session reads; subscribe/clean up auth events and remount account-owned tools |
| YouTube | No player/global callback cleanup; navigation and Strict Mode could retain dead player targets | Release player and callback, recreate iframe target, defer lesson switching until ready, show load timeout and video errors |
| Progress | Malformed browser progress could crash `.includes`; delayed progress load could discard new completions | Validate array shape, merge loaded and newly completed lessons, surface write failures |
| Bookmarks/last lesson | Save could overwrite state before hydration, and failures were silent | Gate writes on successful state loading, disable bookmark while loading, show persistence failures |
| Whiteboard | Read/save failures were silent; stale board loads, delayed writes, and lost pending edits on navigation | Protect reads, avoid writing failed/empty hydration, debounce and serialize captured writes, flush during in-app unmount, offer retry |
| Diagram board | Same persistence failures; theme permanently dark | Share safe autosave behavior, retry failed loads, observe document theme |
| Creator uploads | Cleanup exception after successful material update could delete the newly linked file | Track whether the row commit succeeded; only clean up unlinked uploads |
| Course materials | One failed signed file could hide every successful signed URL | Resolve individual file requests independently and retain accessible materials |
| Comments | Post/delete/network failures and duplicate submissions were not handled consistently | Preserve drafts, show failures, guard concurrent actions, invalidate stale loads |
| Quiz scores | Failed score persistence had no retry without answering again | Add score-save retry with existing answers retained |
| Admin actions | Rejected network calls escaped handlers; lesson upload could leave a stuck busy indicator | Catch CRUD/reorder failures and reset busy state; best-effort rollback of a partially failed reorder |
| Layout/accessibility | Narrow grid minimums, long text/admin JSON overflow, incomplete tab keyboard controls | Allow cells to shrink, scroll long code blocks, wrap mobile/tablet header, add skip link, connected tab panels and arrow/Home/End navigation |
| Theme/errors/loading | No root-layout error boundary; blocked storage and cross-tab theme changes inconsistent | Explicit default theme before hydration, storage-event synchronization, global error boundary, Next 16.4 retry that re-fetches failed content, and loading placeholders |
| Downloads/data | Object URLs leaked; malformed rich-note values could crash rendering | Revoke board/certificate download URLs and normalize note text |

Source files include comments explaining the critical ordering, cleanup, and persistence decisions. `corrected-files.md` contains complete code blocks for changed production sources/configuration; the repository files are the authoritative implementation.

## Verification

The baseline had 82 passing unit tests and seven hook dependency warnings. The final unit suite passes 95 tests across 22 files. ESLint reports zero warnings/errors; the security-boundary TypeScript check and optimized production build pass. All six credential-free Playwright browser tests pass. `git diff --check` reports no whitespace errors. Automated regression coverage includes note failure/retry, board debounce/flush/retry/serialization, player cleanup/errors, malformed browser progress, delayed note reads, creator file cleanup, and cross-tab theme changes.

The credential-free browser suite covers four viewport widths (320, 390, 768, 1280), course search, theme persistence, lesson navigation, bookmarks, timestamped notes, note deletion, drawing undo/redo/save, and unconfigured sign-in. The existing unit suite additionally exercises quizzes, certificates, creator/admin permissions, file types, and schema policy expectations using a fake database.

## Quick manual QA before release

- [ ] Search titles and lessons, clear the search, and switch categories; open a course directly and from its card.
- [ ] Toggle both themes, reload, and change the theme in another tab. Check the diagram board theme too.
- [ ] Check 320px, 390px, tablet and desktop layouts with a signed-in user with a long email; use keyboard Tab and lesson-tab arrow/Home/End keys.
- [ ] Sign up, confirm email, log in/out, and switch accounts. Confirm one student's notes/progress/bookmarks do not appear in another account.
- [ ] Switch lessons rapidly while throttling network requests; confirm old responses never replace the current lesson's notes or scores.
- [ ] Play a real YouTube lesson to completion; verify progress, Previous/Next, Play All on/off, saved last lesson and timestamp seeking.
- [ ] Save, format, delete and export notes; force an API failure and blocked/full browser storage. Ensure unsaved drafts remain available and retry succeeds.
- [ ] Answer quizzes, expand questions, retry, download the answer key, and reload. Fail a score save and use Retry saving score.
- [ ] Complete lessons and pass quizzes; download and inspect the certificate. The existing PDF font supports English characters only.
- [ ] Draw with mouse and touch; use backgrounds, all tools, undo/redo, clear, image export, fullscreen and diagram board. Navigate immediately after drawing and verify the pending in-app save completed.
- [ ] With teacher and student sessions open, update/watch the teacher board and verify realtime updates and read-only learner controls.
- [ ] Post/reply/delete comments, test the rate-limit response and failed deletion; confirm drafts survive failures.
- [ ] Create/edit/publish/unpublish courses and lessons; reorder lessons; upload PDFs and creator files. Verify drafts are hidden from learners and signed files open.
- [ ] Verify student/teacher/admin database policies in the separate Supabase test project; confirm admin category switching, record updates, role edits and portal locking.
- [ ] Visit the Vercel preview, direct lesson URLs and a nonexistent course URL; confirm no unexpected browser exceptions or deployment errors.

## Remaining practical limits

No live database was changed or hosting deployment performed. Authenticated Supabase E2E requires the separately configured test project described in README.md; fake-database tests do not prove that the deployed policies, storage buckets, email delivery, or realtime publication are configured correctly. Actual YouTube playback and email confirmation require the manual checks above.

Board saves flush on in-app navigation; abrupt tab/browser shutdown can still interrupt a pending remote request. The current lesson reorder uses two database writes with best-effort rollback, not an atomic SQL transaction; concurrent administrators should avoid simultaneous reordering. Signed file links last one hour; reload the classroom or creator list if a long-open session's link expires. Certificate and quiz PDFs retain the existing font character limitations. The TypeScript command checks the existing security boundary, not all JavaScript components.

These limitations should be accounted for during preview QA before promoting the app to production. Deployment steps and required environment variables are in `DEPLOYMENT.md`.

The installed Next.js development server generated the root `AGENTS.md` with its version-specific documentation guidance; that generated file is retained.
