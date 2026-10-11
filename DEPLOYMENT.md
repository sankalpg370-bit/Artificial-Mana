# Run Artificial Mana publicly from a Windows PC

This setup runs the Next.js application, SQLite database, account service, and uploaded files on your Windows PC. A Cloudflare Tunnel connects its localhost server to your public HTTPS domain. Anyone can browse published courses and register; application roles protect private learning data and administration.

These are installation instructions for your PC. The Windows startup task, domain, and tunnel have not been installed or tested on that machine during the code audit. No Supabase project or Vercel deployment is required.

## 1. Install and configure locally

Install **Node.js 24 LTS** from the [official download page](https://nodejs.org/en/download). Reopen PowerShell, run `node --version`, and confirm `v24.x`. This project uses Node's built-in SQLite API. Install Git if you will update through Git, or copy the project files to `C:\ArtificialMana` without copying another machine's `node_modules` or `.next` directories.

In PowerShell:

```powershell
Set-Location C:\ArtificialMana
npm.cmd ci
Copy-Item .env.local.example .env.local
New-Item -ItemType Directory -Force C:\ArtificialManaData
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
notepad .env.local
```

Use the generated random value for `ADMIN_TEMP_ACCESS_KEY`. Configure:

```dotenv
APP_ORIGIN=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
DATA_DIR=C:/ArtificialManaData
ADMIN_TEMP_ACCESS_KEY=replace-with-your-generated-value
DISABLE_SIGNUP=0
NEXT_PUBLIC_LOCAL_ONLY=0
```

Use an absolute `DATA_DIR` outside the checkout so code updates do not replace accounts and uploads. Keep it on a local disk, outside OneDrive/network shares; the server's Windows account needs read/write access. The database and directories are created automatically. Keep `.env.local` private and out of Git. `npm.cmd` avoids PowerShell's npm script execution-policy issue.

Create your administrator **before** opening registration to the internet:

```powershell
npm.cmd run admin:create
```

Enter your email and a password of at least 10 characters at the prompts. The password is hidden. An existing signup with the same email is refused; use an unused address. Public signup never creates administrators automatically.

## 2. Verify the app on the PC

```powershell
npm.cmd run check
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run test:smoke
npm.cmd start
```

`check` includes the production build. The two browser suites run sequentially on ports 3200 and 3100 using isolated test state. Stop any other development server first. They do not require production credentials. Browser tests simulate video completion, so actual playback is part of manual QA below.

Visit [http://localhost:3000](http://localhost:3000). Sign in with your administrator, open `/management`, and enter the portal key. Create and publish a test course, add a lesson, and verify a second student account saves notes and progress after reload. The server listens only on `127.0.0.1`; use `localhost` in the browser to match the configured origin. Stop it with **Ctrl+C** when finished.

## 3. Set the public address and build

Use a domain you control. The following example uses `www.artificialmana.com`; replace it everywhere if your chosen hostname differs. Add the domain to Cloudflare and finish its DNS activation before setting up the route.

Change these two lines in `.env.local`:

```dotenv
APP_ORIGIN=https://www.artificialmana.com
NEXT_PUBLIC_SITE_URL=https://www.artificialmana.com
```

Keep `DATA_DIR` unchanged and `NEXT_PUBLIC_LOCAL_ONLY=0`. Rebuild and start:

```powershell
npm.cmd run build
npm.cmd start
```

`APP_ORIGIN` controls accepted browser mutations and secure session cookies. Its scheme and hostname must match the browser URL exactly. Once set to the public HTTPS address, use that address for login and edits; mutations from `http://localhost:3000` will be rejected. Choose one canonical hostname and redirect any alternatives to it.

`NEXT_PUBLIC_SITE_URL` is captured at build time for site links and metadata. Changing it requires another build. This app requires a running Node server with persistent disk; do not use a static export. [Next.js self-hosting documentation](https://nextjs.org/docs/app/guides/self-hosting) describes Node hosting and environment behavior.

## 4. Connect a public Cloudflare Tunnel

In the Cloudflare dashboard, open **Networking → Tunnels**, create a named tunnel such as `artificial-mana-home`, and choose **Windows**. Run the provided connector installation/service command in an administrator terminal on the PC. Keep its tunnel token private. Continue when the connector is connected.

Select that tunnel, then **Routes → Add route → Published application**. Choose the subdomain `www` and your domain; leave the path unrestricted. Set **Service URL** to `http://127.0.0.1:3000` and save. A published application is internet-accessible; leave Cloudflare Access restrictions off for this public site. Follow the [official tunnel setup instructions](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/) if dashboard labels change.

The connector makes an [outbound tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/); keep the application bound to localhost and do not forward port 3000 through the router. Visitors use HTTPS at the public domain while the local connector reaches the application over localhost HTTP. Cloudflare handles visitor traffic; the database and uploaded files stay on your PC. Keep the default caching behavior; do not add a rule that caches `/api/*` or authenticated responses.

Open your public HTTPS address from a phone using cellular data. Verify browsing, registration, login, and an authenticated save. Check the tunnel reports healthy. A successful homepage alone does not verify account origin/cookie settings.

## 5. Start the app when you sign in

Stop the manual `npm.cmd start` process with **Ctrl+C**. In PowerShell as the Windows user who owns this checkout, run:

```powershell
Set-Location C:\ArtificialMana
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-windows-startup.ps1
Start-ScheduledTask -TaskName ArtificialMana
Get-ScheduledTask -TaskName ArtificialMana
Get-Content C:\ArtificialManaData\logs\server.log -Tail 40
```

The script registers a Task Scheduler entry for **this user's sign-in**. It starts the local server, logs output, and restarts the Node application after an unexpected exit. The task remains usable while the session is locked. **After reboot, this user must sign in before the application starts.** This task is not a boot-time Windows service; the Cloudflare connector service starts separately. For unattended operation before sign-in, configure a Windows service or an appropriate Task Scheduler identity separately and test its permissions and restart behavior.

To run the same supervisor manually instead of the task, use `npm.cmd run start:home`; stop it with Ctrl+C. Run only one instance. Keep the PC awake and connected to power/internet. Schedule Windows restarts, sign back in afterward, and test the public address. Check disk space and periodically archive `logs/server.log` while the app is stopped; the supplied logger has no automatic rotation.

## 6. Back up and restore

Back up both SQLite and uploads as one snapshot. Stop the app **and its restart supervisor** first so uploads cannot change during the backup. For the scheduled installation:

```powershell
Disable-ScheduledTask -TaskName ArtificialMana
Stop-ScheduledTask -TaskName ArtificialMana
```

Also stop any manually launched app with Ctrl+C. Confirm port 3000 is no longer listening:

```powershell
if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
  throw "Port 3000 is still listening. Stop the remaining Artificial Mana process before backing up."
}
```

If a child Node process remains after stopping the task, identify the Artificial Mana process in Task Manager and end it, then repeat the check. Do not stop unrelated Node applications. If you configured another port, substitute that port in this check.

Create a unique backup outside `DATA_DIR` (change `D:` to your backup drive):

```powershell
Set-Location C:\ArtificialMana
$backupPath = "D:\ManaBackups\$(Get-Date -Format 'yyyy-MM-dd-HHmmss')"
npm.cmd run backup -- $backupPath
if ($LASTEXITCODE -ne 0) { throw "Backup failed; inspect the error before restarting." }
Enable-ScheduledTask -TaskName ArtificialMana
Start-ScheduledTask -TaskName ArtificialMana
```

The command uses SQLite's backup API and copies `uploads` when present. Keep a protected copy on another device and retain your `.env.local` separately. Backups contain account hashes and private learning data. Do not copy only the live `.sqlite` file while the app runs: SQLite may have committed data in its WAL file.

For restoration, stop/disable the task and verify the port is closed as above. Use the data path matching `.env.local` and a verified backup. Preserve the current directory, then restore into a clean one so stale WAL files cannot be mixed with the restored database:

```powershell
$ErrorActionPreference = "Stop"
$dataPath = "C:\ArtificialManaData"
$backupPath = "D:\ManaBackups\2026-10-11-120000" # Replace with your actual backup.
if (!(Test-Path "$backupPath\artificialmana.sqlite")) { throw "Backup database missing." }
$previousData = "$dataPath.before-restore-$(Get-Date -Format 'yyyyMMddHHmmss')"
Move-Item -LiteralPath $dataPath -Destination $previousData
New-Item -ItemType Directory -Path $dataPath
Copy-Item "$backupPath\artificialmana.sqlite" "$dataPath\artificialmana.sqlite"
if (Test-Path "$backupPath\uploads") {
  Copy-Item "$backupPath\uploads" "$dataPath\uploads" -Recurse
}
Enable-ScheduledTask -TaskName ArtificialMana
Start-ScheduledTask -TaskName ArtificialMana
```

Confirm login, saved notes, course content, and an uploaded-file download before removing the retained directory. If you use manual startup, replace task restart commands with `npm.cmd run start:home`.

## 7. Maintain accounts and update code

There is no SMTP, email verification, or emailed password-reset flow. Registration accepts an unverified email identifier. To reset an existing account after verifying who owns it, run this on the PC:

```powershell
Set-Location C:\ArtificialMana
npm.cmd run account:reset
```

Enter the email and new hidden password. All existing sessions for that account are revoked. Use **Full site control** in Admin for student/teacher/admin role changes. Set `DISABLE_SIGNUP=1` and restart if you want to close registration. No Supabase users, credentials, records, or files have been migrated automatically; preserve any prior exports and plan a separate import if you need them.

For updates, stop/disable the task, take a backup, then copy or pull the reviewed code into the checkout without overwriting `.env.local`. Run `npm.cmd ci`, `npm.cmd run check`, and the two browser suites sequentially. Restart the task only after the checks pass. Keep `DATA_DIR` pointing to the same directory. Retain the prior source revision and pre-update backup; rolling back code does not undo database changes. Rebuild the prior revision to roll back code, and restore data only if the rollback requires it and the resulting loss of newer records is acceptable.

## Pre-launch QA

- [ ] Public HTTPS browsing works from outside home Wi-Fi; login/logout and signup work at the same hostname. An incorrect password shows a clear error.
- [ ] A student can save notes, progress, bookmarks, quiz results, and boards, then reload and sign in on another device to retrieve them. Wait for save completion before closing a page.
- [ ] A second student sees their own private data. Student requests cannot change roles or edit teacher/admin content; unpublished content remains hidden.
- [ ] An administrator can enter the management gate, create/edit/reorder/publish/delete test content, and change an appropriate test account's role. The portal key alone does not grant data access.
- [ ] Creator uploads/downloads work; draft creator files require owner/admin access, and published files are available to learners of published courses.
- [ ] In two browser sessions, teacher-board edits appear for the student within a few seconds; student viewers cannot edit them. Private drawing and diagram boards reload correctly.
- [ ] Real YouTube videos play, pause, seek, and mark completion. Quizzes and the eligible certificate download work. Test an unavailable video too.
- [ ] Rich notes, comments/replies, retry states, dark/light mode across reloads, keyboard navigation, and narrow mobile layouts work without overflow.
- [ ] `/robots.txt`, `/sitemap.xml`, and direct course links use the intended public domain. Freshly published content appears after the cache refresh interval.
- [ ] Restart the PC, sign in, and verify both the tunnel and app recover. Practice a backup restoration and verify an uploaded file survives it.

One local application instance and SQLite are the supported deployment shape. Teacher-board updates use polling; this is not a high-volume multi-server deployment. Availability depends on the PC, storage, home connection, power, and tunnel. The code audit's automated checks do not substitute for the Windows, public-domain, and real-video checks above.
