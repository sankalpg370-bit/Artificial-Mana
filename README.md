# Artificial Mana

Artificial Mana is a Next.js learning website with video lessons, saved progress, rich notes, quizzes, certificates, drawing boards, teacher boards, comments, and a creator/admin workspace.

The app now runs its backend on your own computer: a local SQLite database stores accounts and learning records, and local folders store uploaded files. Supabase is no longer a dependency. The intended public deployment is a Windows PC running the application, reached through a Cloudflare Tunnel. See [the Windows deployment guide](DEPLOYMENT.md) for the complete setup.

## Start locally on Windows

Install [Node.js 24 LTS](https://nodejs.org/en/download), copy the project to `C:\ArtificialMana`, and open PowerShell:

```powershell
Set-Location C:\ArtificialMana
npm.cmd ci
Copy-Item .env.local.example .env.local
New-Item -ItemType Directory -Force C:\ArtificialManaData
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
notepad .env.local
```

Set `DATA_DIR=C:/ArtificialManaData`, paste the generated value into `ADMIN_TEMP_ACCESS_KEY`, and keep both URL variables at `http://localhost:3000` for this local test. Leave `NEXT_PUBLIC_LOCAL_ONLY=0`. The data directory must be writable by the Windows account running the server; use local disk outside the source folder and any synced folder.

```powershell
npm.cmd run admin:create
npm.cmd run dev -- --hostname 127.0.0.1
```

The admin command prompts for an email and hidden password of at least 10 characters. It creates a new administrator directly in your local database. Use an email that has not already registered; the command intentionally refuses to promote an existing public signup.

Open [localhost:3000](http://localhost:3000), sign in, and visit `/management`. Enter the separate portal key to reach the admin workspace. This key opens the portal; the account's server-checked role grants data permissions. Keep the key server-only. Removing it disables entry through the management gate.

The first database initialization seeds the sample courses once. Later changes to `data/courses.js` do not overwrite live courses. Manage live content through the admin workspace. Deleting every course leaves an empty catalog.

## Content and account management

- **Staff access:** An administrator assigns trusted accounts the `teacher` role in **Full site control → Users & roles**. Teachers and admins see **Manage courses** in the header and enter the existing management key when asked. Student accounts cannot edit teaching content.
- **Courses:** Create courses and lessons in Admin, add YouTube IDs or links, optional PDFs and quizzes, then publish. Use **Preview video** to check that a pasted YouTube link allows playback inside the site before saving. Public course pages refresh through the existing cache, usually after about a minute.
- **Creator Studio:** Teacher/admin accounts can add links, assignments, notes, and files. Learners see materials marked visible on published courses. Uploads support allowed document, archive, text, and image formats up to 25 MiB. HTML/SVG are excluded; file validation does not scan content for malware.
- **Learning:** Signed-in students save notes, progress, bookmarks, quiz results, and private boards to the local server. Teacher-board viewers receive updates by polling roughly every 1.5 seconds while the page is visible. Certificates require all lessons complete and every quiz at least 60%; the PDF currently supports English letters.
- **Access:** Students cannot read another student's private records. Teachers manage teaching content and comments. Administrators can inspect and manage all records and account roles in **Full site control**. Public registration creates student accounts only.
- **Password recovery:** Run `npm.cmd run account:reset` on the server and enter the user's email and new password after verifying their identity. This invalidates their existing sessions. Email verification, SMTP, and emailed password-reset links are not implemented; registration email is an unverified account identifier.
- **Registration:** Set `DISABLE_SIGNUP=1` and restart to close new registrations while retaining existing account login.

Existing Supabase accounts, password hashes, files, and learning records have **not** been imported. Preserve any old exports separately; users need new local accounts unless a separate data migration is implemented. The old `supabase-all.sql`, `database-steps/`, and Supabase setup materials are historical and are not used by this server.

## Verify changes

```powershell
npm.cmd run check
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run test:smoke
```

Run the browser suites sequentially, with no development server already using ports 3100/3200. `check` runs lint, the admin security-boundary typecheck, unit tests, and a production build. The unit suite includes real temporary SQLite databases as well as component mocks. Full browser tests provision a temporary local database and test administrator automatically; they never target the configured production database. The smoke suite uses browser-only demo mode. YouTube completion is simulated in automation, so test actual playback manually before launch.

The migration passed 104 unit tests, 2 complete browser tests, 7 smoke tests, lint, the security-boundary typecheck, and the production build on the audit machine. GitHub Actions runs the release checks. See [the audit report](audit/AUDIT.md), [corrected source blocks](audit/corrected-files.md), and [deployment QA](DEPLOYMENT.md#pre-launch-qa).

## Operate the public site

Follow [DEPLOYMENT.md](DEPLOYMENT.md) for HTTPS domain routing, Windows sign-in startup, backups, restoration, and upgrades. The application, SQLite database, and uploads live on the PC; the tunnel forwards visitor traffic. Keep the PC powered, awake, connected, and signed in after reboot for the supplied startup configuration.

Use one running application instance with this local database. This configuration requires persistent local disk and is not a Vercel/Netlify serverless deployment. The Windows installation and public tunnel must still be set up and verified on the actual host.

The default theme is dark; the header switch remembers the user's choice. Colors live in `app/globals.css`. Excalidraw and other attribution are listed in [CREDITS.md](CREDITS.md). Keep `.env.local`, database files, uploads, logs, and backups out of Git.
