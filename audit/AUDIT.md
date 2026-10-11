# Artificial Mana frontend audit — October 11, 2026

The authorized target is the existing Artificial Mana learning app. Its frontend uses Next.js, React, custom CSS, local SQLite, Tiptap, Excalidraw, and YouTube. Following the frontend audit, the backend was migrated to run on the user’s Windows home PC, with public access through an HTTPS tunnel. Chat history, AI token streaming, Markdown chat rendering, and chat copy buttons are not part of this application.

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
| Course materials | One failed file URL could hide every successful file URL | Resolve individual file requests independently and retain accessible materials; local downloads now recheck authorization on every request |
| Comments | Post/delete/network failures and duplicate submissions were not handled consistently | Preserve drafts, show failures, guard concurrent actions, invalidate stale loads |
| Quiz scores | Failed score persistence had no retry without answering again | Add score-save retry with existing answers retained |
| Admin actions | Rejected network calls escaped handlers; lesson upload could leave a stuck busy indicator | Catch CRUD/reorder failures and reset busy state; best-effort rollback of a partially failed reorder |
| Layout/accessibility | Narrow grid minimums, long text/admin JSON overflow, incomplete tab keyboard controls | Allow cells to shrink, scroll long code blocks, wrap mobile/tablet header, add skip link, connected tab panels and arrow/Home/End navigation |
| Theme/errors/loading | No root-layout error boundary; blocked storage and cross-tab theme changes inconsistent | Explicit default theme before hydration, storage-event synchronization, global error boundary, Next 16.4 retry that re-fetches failed content, and loading placeholders |
| Downloads/data | Object URLs leaked; malformed rich-note values could crash rendering | Revoke board/certificate download URLs and normalize note text |

Source files include comments explaining the critical ordering, cleanup, and persistence decisions. `corrected-files.md` contains complete code blocks for changed production sources/configuration; the repository files are the authoritative implementation.

## Local backend implementation

- Replaced Supabase auth/data/storage calls with same-origin Next.js API routes and a parameterized, allowlisted SQLite query layer. Students can access their own learning records; teachers manage course content and their own materials; admins retain the existing support/role controls.
- Added salted scrypt passwords, opaque cookie sessions stored as token hashes, logout/session revocation, mutation-origin checks, bounded JSON/uploads, rate limits, and server-authoritative comment attribution.
- Files are stored under `DATA_DIR/uploads`; creator files require ownership or a published material in a published course. Download responses use MIME restrictions, `nosniff`, sandboxing and no-store caching. Windows paths reject traversal and reserved syntax.
- Teacher boards now poll the local API every 1.5 seconds while the page is visible. Pending polls cannot update a stopped subscription.
- Added interactive admin creation/password recovery, SQLite-and-upload backups, a server restart runner, and Windows sign-in task registration. The deployment guide uses a persistent data folder outside the checkout and a Cloudflare named tunnel to `127.0.0.1:3000`.
- Removed Supabase and analytics packages and configuration. Historical SQL and HTML setup guides are explicitly marked as old references. Existing Supabase users, password hashes and data have not been imported.
- Patched vulnerable production transitive dependencies used by the diagram board and verified that the actual editor loads and follows theme changes in a browser.

## Verification

The latest full verification passed 100 unit tests across 22 files, ESLint, the existing security-boundary TypeScript check, and an optimized production build. Seven public UI Playwright tests and two authenticated local-backend E2E tests pass. CLI checks confirmed admin creation, database/upload backup, password reset with session revocation, and reopening the backup. A production-only dependency audit reports zero known vulnerabilities; this does not make a claim about development-only packages or guarantee the absence of unknown vulnerabilities.

The unit suite covers notes failure/retry, board debounce/flush/retry/serialization, player cleanup/errors, malformed browser progress, delayed reads, creator file cleanup, cross-tab themes, salted password verification, session revocation, private-row isolation, role escalation attempts, draft visibility, database restart persistence, safe query fields, comment limits, file permissions/path traversal, and request origins. Historical SQL tests are retained separately and are not evidence for the current backend’s permissions.

The browser suites exercise four viewport widths (320, 390, 768, 1280), search, persistent themes, actual Excalidraw loading, lesson navigation, bookmarks, timestamped notes, note deletion, drawing undo/redo/save, browser-only demo login fallback, local account creation/login, admin course/lesson publication, creator upload and student download, saved progress, quizzes, certificate download, comments, and teacher-to-student board updates across two sessions. The E2E databases are disposable; real application data is not used.

The YouTube player is simulated in automated browser tests. Actual playback, touch input, Windows Task Scheduler, and the public tunnel still require the deployment checks below. Local checks ran on macOS; the Windows machine has not been connected or deployed from this workspace.

## Quick manual QA before release

- [ ] Search titles and lessons, clear search, switch categories, and open a course from a card and a direct URL.
- [ ] Toggle themes, reload, and change the theme in another tab; check both drawing boards.
- [ ] Check 320px, 390px, tablet and desktop layouts with a long account email; use keyboard Tab and lesson-tab arrow/Home/End keys.
- [ ] Sign up, log in/out, and switch accounts. Verify a second student cannot see the first student’s notes, progress, bookmarks, scores, or private boards. Email verification is not implemented.
- [ ] Switch lessons quickly under network throttling. Save/delete notes and simulate API failures; drafts must remain available and retry must succeed.
- [ ] Play a real YouTube lesson to completion; verify progress, Previous/Next, Play All, saved last lesson and timestamp seeking.
- [ ] Answer quizzes, retry failed score saves, download answer keys and certificates, and reload to verify saved results.
- [ ] Draw with mouse and touch, use all tools and undo/redo, export images, enter fullscreen, and navigate immediately after drawing. Reopen the lesson to verify the pending save completed.
- [ ] With teacher and student sessions open, edit the teacher board and verify updates within a few seconds and read-only student controls.
- [ ] Post/reply/delete comments, trigger the rate-limit message and a failed request, and verify drafts survive failures.
- [ ] Create/edit/publish/unpublish/delete courses and lessons, reorder lessons, upload PDFs and creator files, and verify draft files remain inaccessible to other users.
- [ ] Verify teacher/admin permissions and portal locking, including a separate student session making a forbidden operation.
- [ ] Visit the public HTTPS domain from cellular data. Test login, upload/download, direct course URLs and a nonexistent URL. Check the browser console and server log.
- [ ] Restart Windows, sign in, and verify automatic app startup and tunnel reconnection. Stop the app, back up, and test recovery into a separate data directory.

## Remaining practical limits

No public deployment or old-data migration was performed. The Windows sign-in task starts the app after that user logs in; it is not a pre-login Windows service. The PC must remain awake and connected for the site to respond. See `../DEPLOYMENT.md` for exact installation, startup, recovery and tunnel steps.

This backend is intended for one persistent Node.js server. Do not place its database on an ephemeral serverless filesystem or run it as a horizontally scaled service. Node’s built-in SQLite API has version-dependent stability; use the documented Node 24 LTS release and test upgrades. There is no email delivery, email verification, or self-service forgotten-password flow; the account recovery CLI is for the operator after verifying the person’s identity.

Board saves flush on in-app navigation; abrupt browser shutdown can still interrupt a pending request. The existing lesson reorder uses two writes with best-effort rollback, so concurrent administrators should avoid simultaneous reordering. Certificate and quiz PDFs retain the existing English-font limitations. Public course pages use a 60-second revalidation interval, so content changes can take a refresh/revalidation cycle to appear. File URLs check current permissions at download time and do not expire like the old signed links. The TypeScript command checks the existing security boundary, not every JavaScript component.

The installed Next.js development server generated the root `AGENTS.md` with its version-specific documentation guidance; that generated file is retained.
