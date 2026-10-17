# Chrome website and staff audit — October 17, 2026

Inspected https://www.artificialmana.com in Chrome using the existing signed-in teacher session. This is an audit; no source fixes, role changes, publication, or deletion were performed. The user’s active development server was retained.

## Flags listed before further testing

| Priority | Finding | Evidence and effect |
| --- | --- | --- |
| High functional gap | The intended owner account has teacher access, not administrator access | Read-only Supabase query confirms the chosen email is confirmed with role `teacher`. Course management and Creator Studio open, but the administrator-only control center is hidden. Full live administrator flows cannot be certified from this session. Do not assume the role should be changed without considering the owner's intended access. |
| Medium | Empty courses can have Published status while remaining invisible publicly | C++ initially had zero lessons and was a draft. During inspection it changed to Published, independently of the audit actions. Read-only database query confirms Published with zero lessons. `mapCourseRows` filters empty courses from the catalog. Publishing should explain or prevent this condition. The audit did not publish this course. |
| Medium content readiness | AI course retains the approved sample teaching content | Published course contains three lessons; first lesson embeds the sample neural-network video. Previous sample approval was for testing. Teaching content should be reviewed before broad release. |
| Medium onboarding limitation | Staff setup is a password-change flow, not account creation or automatic temporary-password expiry | Existing implementation requires a provisioned staff account. Private account creation remains a separate owner operation. This is a limitation, not evidence that password changes fail. No password was entered or changed during this audit. |
| Low | Creator Studio repeats the site name in its title | Live Chrome title is `Creator Studio | Artificial Mana | Artificial Mana`. Its metadata includes the name already supplied by the root template. |
| Low accessibility | Management access page nests a main landmark | Current source renders `<main>` inside the root layout's `<main>`. Use a labelled section. |

## Live checks completed

- Existing teacher session opens course management, lists courses/lessons and exposes expected teacher editor actions. Course detail editing opens and closes without saving; lesson boundary reorder buttons are disabled appropriately. Existing published courses were not edited or deleted.
- Creator Studio opens with course/lesson, material-type, text, link, visibility and upload controls. Empty submission invokes required-field validation without creating a material.
- Homepage search shows the no-result state and restores the course list when cleared. Public catalog excludes the empty C++ course despite its Published database status.
- AI course loads embedded video/player controls, lesson navigation and Notes, Quiz, Materials, Boards and Questions tabs. Unanswered first-lesson quiz submission is disabled and explains all 19 questions are required. Materials exposes PDF open/download links. Board actions and authenticated question form render.
- About and Privacy navigation works; their page titles use the root site-name template once.
- No warnings/errors were captured in the inspected lesson and Creator Studio tab logs. This does not certify the absence of errors in untested flows.

## Limits

The live browser used a teacher session. Administrator role changes, private learner-data controls and complete live administrator operations were not exercised. Live upload, save/delete, publication, realtime synchronization, real video completion and credential changes were not submitted. Isolated local browser tests cover destructive/creative workflows without modifying hosted data, but do not prove hosted Auth/Storage/Realtime infrastructure behavior.

An existing Next.js server prevented a second server in this checkout. Browser tests therefore use a temporary copy with isolated SQLite data. Webpack dev mode is used in that copy because Turbopack rejects an external node_modules symlink. Production source configuration was not changed for this workaround.

## Automated results

Lint and administration-boundary typecheck passed. All 130 unit/integration tests across 25 files passed. Local end-to-end browser suite: four passed and one failed. The failure confirms the management page nested-main regression: navigation-and-errors.spec.js expects one main landmark and receives two. The successful full learning-flow test covers local student/admin learning, publication, file and note workflows; the other passing checks cover session retry, API rejection and responsive themes. Expected simulated Unavailable logs belong to the successful session-failure test.

All seven isolated smoke tests passed: course browsing/persistent themes at 320, 390, 768 and 1280 pixels; notes/lesson selection/bookmarks/drawings across reloads; unavailable sign-in handling; and diagram-board loading/theme. Actual hosted video playback was started in Chrome, with advancing video content/captions observed, then the audit video tab was closed to stop playback. Full video completion was not tested. Total browser results: 11 passed, one failed.

Recommended order: (1) decide whether the owner should be teacher or admin and enable the intended role through the trusted setup flow; (2) prevent or explain publication of empty courses; (3) correct the management landmark and Creator Studio title; (4) review sample content; (5) perform hosted write/upload/realtime checks using approved disposable accounts and content. Do not label all live administrator operations verified based on the local test suite.
