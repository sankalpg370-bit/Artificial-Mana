# Deploy Artificial Mana to Vercel

This project is a Next.js App Router application with a server-side admin-access API and proxy. Deploy it using Vercel's Next.js preset, rather than a static export.

## 1. Verify locally

From the repository root:

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:smoke
```

`check` runs ESLint, the existing security-boundary TypeScript check, unit tests, and the production build. `test:smoke` starts an isolated local server on port 3100 with Supabase disabled. It checks public UI and browser storage without touching a database. The player is stubbed in the persistence test; actual YouTube playback needs the manual QA below.

For authenticated E2E, follow the **Browser tests** section in README.md and run `npm run test:e2e`. It requires a separate Supabase test project and admin account; it intentionally creates test records and rejects production targets.

## 2. Configure Supabase

1. Create a Supabase project for production.
2. For a **new database**, run `supabase-all.sql` once in its SQL Editor. For an existing database, review which numbered migrations have already been applied and apply only the missing steps after taking a backup.
3. Confirm the `lesson-pdfs` and `creator-materials` storage buckets and their policies exist. The latter uses signed URLs.
4. Confirm `lesson_boards` is enabled in the `supabase_realtime` publication so students receive teacher board changes (the schema includes this setup).
5. In Authentication URL Configuration, set Site URL to the final HTTPS address and add exact production and trusted preview redirect URLs. Keep email confirmation enabled for production and test delivery.
6. Sign up the intended administrator and grant that account its role through the database's documented bootstrap step. A temporary portal key alone does not grant database permissions.

## 3. Push reviewed changes

Use your existing GitHub repository, or create one and configure its remote. Review the code and ensure real credentials are excluded before committing. Push the branch you intend to deploy. No commit or remote push was performed by this audit.

## 4. Import into Vercel

1. Open Vercel, select **Add New → Project**, and import the GitHub repository.
2. Select **Next.js** as Framework Preset and the repository root as Root Directory.
3. Use `npm ci` as Install Command and `npm run build` as Build Command. Leave the output directory at its framework default.
4. Choose a Vercel-supported Node.js LTS version satisfying this project's `>=20.9.0` engine requirement. Use the same version locally and in CI.
5. Set these variables **before the first build**:

| Variable | Value | Scope |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase production project URL | Production; use a separate test project for Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | That project's public anon key | Corresponding environment |
| `NEXT_PUBLIC_SITE_URL` | Final HTTPS site address | Production; set an appropriate preview address when needed |
| `ADMIN_TEMP_ACCESS_KEY` | Strong random temporary portal key, if admin portal access is needed | Server only, corresponding environment |

Generate the optional portal key locally with `openssl rand -base64 32`. Store it only in environment settings, never in a `NEXT_PUBLIC_` variable. Under the current proxy, `/admin` is gated by this key: removing it disables entry to the admin portal until it is configured again. Teacher/admin Supabase roles and row policies remain necessary. `/creator-studio` uses the signed-in role and database policies.

No service-role key is required by this frontend. Missing/invalid public Supabase configuration deliberately falls back to sample courses and browser-only learning data; that is not a successful production account setup.

## 5. Deploy and validate

1. Deploy the project and open its generated URL.
2. Run the manual QA checklist in `audit/AUDIT.md`, using appropriate test users and content. Confirm both account persistence and actual third-party video playback.
3. Add the custom domain under Vercel Project Settings → Domains and apply the DNS records shown there.
4. Update `NEXT_PUBLIC_SITE_URL` and Supabase Site/Redirect URLs to match, then redeploy. Public Next.js environment variables are captured at build time.
5. Confirm the production URL, `/robots.txt`, `/sitemap.xml`, `/login`, and a direct `/course/<slug>` URL resolve correctly.
6. Inspect deployment logs and verify that published course changes appear after the existing one-minute revalidation window.
7. To roll back, promote the previous verified deployment in Vercel. Database changes and learner records are separate from frontend deployment rollback.

Vercel auto-detects this project; a `vercel.json` override is not needed.

Official references: [Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying), [Vercel environments](https://vercel.com/docs/deployments/environments), [Vercel environment variables](https://vercel.com/kb/guide/how-to-add-vercel-environment-variables), [supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
