# Artificial Mana

A learning website for artificial intelligence. It uses video lessons.

## Run on your computer
1. Install Node.js (LTS version, 20.9 or newer).
2. Run `npm install`.
3. Run `npm run dev`.
4. Open http://localhost:3000.

## Add videos
Open `data/courses.js`. Add a lesson. Write its title and its YouTube ID.

## Set up accounts, notes, quizzes, boards, and comments
1. Make a free project at supabase.com.
2. In the SQL Editor, paste the whole file `supabase-all.sql`. Click Run. Do this one time only.
3. Copy `.env.local.example` to `.env.local`.
4. Add your Supabase URL and anon key to `.env.local`.
5. Stop the site. Run `npm run dev` again.
(The same SQL is also split in the `database-steps` folder. You do not need those files.)

## Add a PDF to a lesson
1. Put the PDF file in `public/pdfs`.
2. In `data/courses.js`, add `pdf: "/pdfs/name.pdf"` to the lesson.

## Put the site online
See `artificialmana-guide.html` for the steps.

## Important
Never upload `.env.local` to GitHub.

## Quizzes, search, and categories
Add a `quiz` list to a lesson in `data/courses.js`. Add a `category` to a course. The home page makes a search box and category buttons by itself.

## About and Privacy pages
Open `app/about/page.js` and `app/privacy/page.js`. Replace the text in [square brackets]. Ask a legal expert to check the privacy page.

## Whiteboard
Each lesson has a whiteboard under the video. It has a blackboard, a whiteboard, and grid paper. Tools: pen, marker, highlighter, line, box, circle, text, and eraser. The student can undo, redo, and save the board as an image.

## Diagram board
Each lesson also has a diagram board (Excalidraw, MIT license). See `CREDITS.md`.

## Teachers and the admin page
1. Run `supabase-step8.sql` in the Supabase SQL Editor.
2. Sign up on the site with your email.
3. In the SQL Editor, run the last line of `supabase-step8.sql`. Change the email first. Remove the `--` at the start.
4. Log in again. An **Admin** button shows in the top bar.
5. In Admin, make a course, add lessons (YouTube link, PDF, quiz), and press **Publish**. You can edit a course or a lesson later with the **Edit** buttons.

If Supabase has no published course, the site shows the sample course from `data/courses.js`.

## Creator Studio
Run `database-steps/supabase-step11.sql` once in the Supabase SQL Editor (or use the updated `supabase-all.sql` for a new setup). Sign in with a teacher or admin account, open **Admin**, then choose **Open Creator Studio**. The unlisted `/creator-studio` page lets creators add links, assignments, notes, and files to a course or lesson. Only materials marked **Visible to learners** appear on published courses.

## Privacy and row access
Run `database-steps/supabase-step12.sql` after steps 5-11 to enforce learner/creator access rules, then run `database-steps/supabase-step13.sql` to enable full admin oversight. Teacher/admin accounts can manage courses and lessons; only admins can use **Full site control** on `/admin` to inspect and edit every account's private progress, notes, bookmarks, quiz results, and learner boards; manage user roles; moderate public comments and lesson boards; and edit or remove creator drafts and published materials. Admins also have access to all private creator uploads. Creator file paths are restricted to the owning creator, including when materials are published. Learners see only published course content and public comments/teacher boards, not one another's private data. The combined `supabase-all.sql` includes these policies for a fresh setup.

The Full site control panel paginates records in batches of 100. Editing data there is permanent. Admin role changes do not create or delete Supabase Auth accounts; account lifecycle operations must be done in Supabase Authentication.

## Certificates
A student gets a certificate PDF after all lessons are done and every quiz has a score of 60% or more. The certificate prints English letters only.

## Rich notes
Students can use bold, italic, headings, lists, quotes, and code in notes. Old plain-text notes still show. The site removes any other formats, so notes stay safe.

## Teacher board
A teacher draws on the **teacher board** of a lesson. Every student can open it and watch. It updates by itself in about 1 to 2 seconds. Run `supabase-step9.sql` first. Students cannot draw on it.

## Questions and comments
Logged-in students can ask questions and reply under each lesson. Teachers can delete any comment and show a Teacher badge. A user can post 5 comments in one minute. Run `supabase-step10.sql` first.

## Tests
Run `npm test`. It runs 28 automatic tests: lesson page, progress, bookmarks, quizzes, certificates, comments, search, course loading, and note safety. Run it before you put a change online.
These tests check each part with a fake database. They do not click through the site in a real browser.
