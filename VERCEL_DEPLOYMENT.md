# Vercel and Supabase deployment

The production app uses `NEXT_PUBLIC_BACKEND=supabase`. The browser talks directly to Supabase Auth, PostgreSQL through its API, and Storage. Row-level policies enforce ownership and roles. Only published catalog content is read anonymously on the Next.js server. File bodies bypass Vercel functions, retaining the 25 MiB upload limit. Local mode remains a separate development option.

## 1. Provision the application schema

Use the selected Supabase project. Confirm its `public` schema has no existing app tables before applying `database/hosted-schema.sql`. The migration intentionally fails if app tables already exist. Do not run the older SQL files with it. Existing Auth accounts are retained and receive student profiles. Apply `database/hosted-seed.sql` if you want the sample catalog; it never overwrites existing course edits. Replace the sample videos and PDF with your own lesson content before announcing launch.

The schema installs ownership policies, student defaults, creator/admin permissions, safe content URLs, quiz validation, comment attribution/rate limits, deletion cleanup, and a teacher-board Realtime publication. The `creator-materials` bucket is private; it grants read access to an owner/admin or a file attached to a published material in a published course. The `lesson-pdfs` bucket is public. Both restrict declared MIME types and size. Supabase does not scan these uploads for malware.

The current production policy is guest learning with public registration closed. Hosted mode defaults to hiding signup unless `NEXT_PUBLIC_ALLOW_SIGNUP=1` is explicitly set. Supabase **Allow new users to sign up** is disabled as well, so hiding the button is not the only control. Existing accounts can still sign in. SMTP is not required for guest learning; configure it before reopening registration.

Promote only the owner's verified account to admin through an authorized database operation. Public registration cannot choose a role. Keep Supabase email confirmation enabled; configure the Site URL and allowed redirect URLs to the production domain. Configure password length of at least 10, signup/email rate limits, and SMTP if public email delivery is required. Closing registration uses Supabase Auth settings; local `DISABLE_SIGNUP` is not used by hosted Auth.

## 2. Configure Vercel

Use Node.js 24, Next.js framework detection, `npm ci` and `npm run build`. No custom output directory is needed. Set the variables from `.env.hosted.example` for production and the appropriate preview environment before deploying. Use a Supabase publishable key (or a legacy anon key), never a secret or service-role key in a `NEXT_PUBLIC` variable. The frontend does not need a privileged key.

`ADMIN_TEMP_ACCESS_KEY` is a separate, random server-only management portal key. Set it in Vercel and store it in your password manager. It opens the portal; PostgreSQL roles grant data access. `APP_ORIGIN` must match the canonical production HTTPS origin for the management gate. Do not share production administrator keys or use a production database for destructive preview tests. Prefer a separate Supabase test project for previews.

Environment changes require rebuilding because public values are bundled. For local testing of hosted mode, copy `.env.hosted.example` to ignored `.env.local`, fill in the public configuration, set `APP_ORIGIN=http://localhost:3000`, and run `npm run dev`. Auth sessions use the Supabase browser SDK's persistent storage; every data request is still authorized by PostgreSQL RLS.

## 3. Restore public access

Inspect the latest deployment and fix any provisioning/build errors before promoting it. Vercel Authentication applied to all deployments sends ordinary visitors to Vercel login. Keep previews protected and make the production domain public only after the application and its data policies are verified and the owner approves that access change.

Confirm both the apex and `www` domain are attached to the intended project. Redirect the secondary domain to the canonical `https://www.artificialmana.com`. A DNS or platform setting cannot be fixed solely by changing repository files.

## 4. Verify the hosted release

Run `npm run check`, `npm run test:e2e`, and `npm run test:smoke` sequentially. Browser suites explicitly force isolated local mode and never mutate the hosted database. The PostgreSQL suite executes the hosted schema in an in-memory PostgreSQL runtime, including real RLS under separate user identities; it does not emulate Supabase Auth, Storage, or Realtime infrastructure.

Test the hosted preview using disposable approved accounts: signup and confirmation, login/logout, cross-account isolation, teacher/admin access, course publication, notes/progress/bookmarks after reload, complete quizzes, certificate/answer-key downloads, private uploads before/after publication, and two-browser teacher-board updates. Check actual video playback and mobile touch drawing. Then verify the production domain in a signed-out browser after release.

Certificates are generated in the browser and quiz scores are supplied by the client. They are learning aids, not cryptographically verifiable credentials. If you require authoritative exams, add server-side grading and certificate issuance as a separate feature.

Supabase contains persistent data and files independently of Vercel deployments. Configure database and Storage backups appropriate to the account plan. Redeploying does not migrate local SQLite data or local uploads.

## Private staff onboarding

Provision staff through Supabase Auth’s private Create new user flow. For the owner’s explicitly authorized email, grant the intended role through a trusted database operation; browser registration never grants roles. The `/staff/setup` portal signs in an existing teacher/admin account, changes its password with Supabase Auth, and signs out after success. It neither creates accounts nor enforces temporary-password expiry. The owner must enter credentials directly in the dashboard/portal; do not send passwords in chat.
