-- ARTIFICIAL MANA: all database steps in one file.
-- Run this ONE time in the Supabase SQL Editor (New query > paste > Run).
-- Run it only once. Running it again shows 'already exists' errors.
-- Order: progress, notes, bookmarks, quizzes, boards, teachers, teacher board, comments.

-- ===================== supabase.sql =====================
-- Run this one time in Supabase. Open SQL Editor > New query. Paste this file. Click Run.
create table if not exists progress (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_slug text not null,
  lesson_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, course_slug, lesson_id)
);
alter table progress enable row level security;
create policy "read own progress" on progress for select using (auth.uid() = user_id);
create policy "add own progress" on progress for insert with check (auth.uid() = user_id);
create policy "update own progress" on progress for update using (auth.uid() = user_id);

-- ===================== supabase-notes.sql =====================
-- Step 3. Run this one time in the Supabase SQL Editor.
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_slug text not null,
  lesson_id text not null,
  seconds integer not null default 0,
  content text not null,
  created_at timestamptz not null default now()
);
alter table notes enable row level security;
create policy "read own notes" on notes for select using (auth.uid() = user_id);
create policy "add own notes" on notes for insert with check (auth.uid() = user_id);
create policy "delete own notes" on notes for delete using (auth.uid() = user_id);

-- ===================== supabase-step5.sql =====================
-- Step 5. Run this one time in the Supabase SQL Editor.
create table if not exists course_state (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_slug text not null,
  bookmarked boolean not null default false,
  last_lesson text,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_slug)
);
alter table course_state enable row level security;
create policy "read own state" on course_state for select using (auth.uid() = user_id);
create policy "add own state" on course_state for insert with check (auth.uid() = user_id);
create policy "update own state" on course_state for update using (auth.uid() = user_id);

-- ===================== supabase-step6.sql =====================
-- Step 6. Run this one time in the Supabase SQL Editor.
create table if not exists quiz_results (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_slug text not null,
  lesson_id text not null,
  score integer not null,
  total integer not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_slug, lesson_id)
);
alter table quiz_results enable row level security;
create policy "read own results" on quiz_results for select using (auth.uid() = user_id);
create policy "add own results" on quiz_results for insert with check (auth.uid() = user_id);
create policy "update own results" on quiz_results for update using (auth.uid() = user_id);

-- ===================== supabase-step7.sql =====================
-- Step 7. Run this one time in the Supabase SQL Editor.
create table if not exists boards (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_slug text not null,
  lesson_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_slug, lesson_id)
);
alter table boards enable row level security;
create policy "read own boards" on boards for select using (auth.uid() = user_id);
create policy "add own boards" on boards for insert with check (auth.uid() = user_id);
create policy "update own boards" on boards for update using (auth.uid() = user_id);

-- ===================== supabase-step8.sql =====================
-- Step 8. Teachers and the admin page.
-- Run this one time in the Supabase SQL Editor.

-- 1. Roles. Every new account is a student.
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student','teacher','admin'))
);
alter table profiles enable row level security;
create policy "read own profile" on profiles for select using (auth.uid() = user_id);
-- No update policy. A user cannot change their own role.

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
insert into profiles (user_id) select id from auth.users on conflict do nothing;

create or replace function is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where user_id = auth.uid() and role in ('teacher','admin'));
$$;

-- 2. Courses and lessons.
create table if not exists courses (
  slug text primary key,
  title text not null,
  description text,
  category text,
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  course_slug text not null references courses(slug) on delete cascade on update cascade,
  position integer not null default 1,
  title text not null,
  youtube_id text not null,
  pdf_url text,
  quiz jsonb
);
alter table courses enable row level security;
alter table lessons enable row level security;
create policy "read courses" on courses for select using (published or is_teacher());
create policy "teachers add courses" on courses for insert with check (is_teacher());
create policy "teachers change courses" on courses for update using (is_teacher());
create policy "teachers delete courses" on courses for delete using (is_teacher());
create policy "read lessons" on lessons for select using (
  is_teacher() or exists (select 1 from courses c where c.slug = course_slug and c.published));
create policy "teachers add lessons" on lessons for insert with check (is_teacher());
create policy "teachers change lessons" on lessons for update using (is_teacher());
create policy "teachers delete lessons" on lessons for delete using (is_teacher());

-- 3. PDF storage. Everyone can read. Only teachers can upload.
insert into storage.buckets (id, name, public) values ('lesson-pdfs', 'lesson-pdfs', true) on conflict do nothing;
create policy "teachers upload pdfs" on storage.objects for insert with check (bucket_id = 'lesson-pdfs' and is_teacher());
create policy "teachers change pdfs" on storage.objects for update using (bucket_id = 'lesson-pdfs' and is_teacher());
create policy "teachers delete pdfs" on storage.objects for delete using (bucket_id = 'lesson-pdfs' and is_teacher());

-- 4. Make yourself a teacher. Change the email. Run this line after you sign up on the site.
-- update profiles set role = 'admin' where user_id = (select id from auth.users where email = 'you@example.com');

-- ===================== supabase-step9.sql =====================
-- Step 9. Teacher board. Run this one time in the Supabase SQL Editor.
create table if not exists lesson_boards (
  course_slug text not null,
  lesson_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (course_slug, lesson_id)
);
alter table lesson_boards enable row level security;
create policy "everyone reads teacher boards" on lesson_boards for select using (true);
create policy "teachers add boards" on lesson_boards for insert with check (is_teacher());
create policy "teachers change boards" on lesson_boards for update using (is_teacher());
create policy "teachers delete boards" on lesson_boards for delete using (is_teacher());
-- Send changes to students live.
alter publication supabase_realtime add table lesson_boards;

-- ===================== supabase-step10.sql =====================
-- Step 10. Questions and comments under each lesson.
-- Run this one time in the Supabase SQL Editor.
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_slug text not null,
  lesson_id text not null,
  parent_id uuid references comments(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 40),
  author_is_teacher boolean not null default false,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists comments_lesson_idx on comments (course_slug, lesson_id, created_at);
alter table comments enable row level security;
create policy "everyone reads comments" on comments for select using (true);
create policy "add own comments" on comments for insert with check (auth.uid() = user_id);
create policy "delete own comment or teacher" on comments for delete using (auth.uid() = user_id or is_teacher());

-- The database sets the owner and the teacher badge. A user cannot fake them.
-- It also stops spam: 5 comments in one minute is the limit.
create or replace function comments_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.author_is_teacher := is_teacher();
  if (select count(*) from comments where user_id = new.user_id and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'slow_down';
  end if;
  return new;
end $$;
drop trigger if exists comments_before_insert on comments;
create trigger comments_before_insert before insert on comments
  for each row execute function comments_before_insert();

-- ===================== supabase-step11.sql =====================
-- Step 11. Creator materials. Run this one time in the Supabase SQL Editor.
create table if not exists creator_materials (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_slug text not null references courses(slug) on delete cascade on update cascade,
  lesson_id uuid references lessons(id) on delete set null,
  kind text not null check (kind in ('link', 'assignment', 'note', 'file', 'other')),
  title text not null check (char_length(title) between 1 and 160),
  content text,
  url text,
  file_url text,
  storage_path text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_materials_course_idx
  on creator_materials (course_slug, lesson_id, published);

alter table creator_materials enable row level security;
drop policy if exists "read published creator materials" on creator_materials;
drop policy if exists "read own or published creator materials" on creator_materials;
create policy "read published creator materials" on creator_materials
  for select using (
    creator_id = auth.uid()
    or (
      published and exists (
        select 1 from courses c where c.slug = creator_materials.course_slug and c.published
      )
    )
  );
drop policy if exists "teachers add creator materials" on creator_materials;
drop policy if exists "teachers add own creator materials" on creator_materials;
create policy "teachers add creator materials" on creator_materials
  for insert with check (
    auth.uid() = creator_id and is_teacher()
    and (
      storage_path is null
      or (storage.foldername(storage_path))[1] = auth.uid()::text
    )
  );
drop policy if exists "teachers change creator materials" on creator_materials;
drop policy if exists "teachers update own creator materials" on creator_materials;
create policy "teachers change creator materials" on creator_materials
  for update using (auth.uid() = creator_id and is_teacher())
  with check (
    auth.uid() = creator_id and is_teacher()
    and (
      storage_path is null
      or (storage.foldername(storage_path))[1] = auth.uid()::text
    )
  );
drop policy if exists "teachers delete creator materials" on creator_materials;
drop policy if exists "teachers delete own creator materials" on creator_materials;
create policy "teachers delete creator materials" on creator_materials
  for delete using (auth.uid() = creator_id and is_teacher());

insert into storage.buckets (id, name, public, file_size_limit)
values ('creator-materials', 'creator-materials', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

drop policy if exists "public read creator material files" on storage.objects;
drop policy if exists "read own or published creator material files" on storage.objects;
create policy "read own or published creator material files" on storage.objects
  for select using (
    bucket_id = 'creator-materials'
    and exists (
      select 1 from creator_materials m
      where m.storage_path = name
        and (storage.foldername(name))[1] = m.creator_id::text
        and (
          m.creator_id = auth.uid()
          or (
            m.published and exists (
              select 1 from courses c where c.slug = m.course_slug and c.published
            )
          )
        )
    )
  );
drop policy if exists "teachers upload creator material files" on storage.objects;
create policy "teachers upload creator material files" on storage.objects
  for insert with check (
    bucket_id = 'creator-materials' and is_teacher()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "teachers update creator material files" on storage.objects;
create policy "teachers update creator material files" on storage.objects
  for update using (
    bucket_id = 'creator-materials' and is_teacher()
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'creator-materials' and is_teacher()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "teachers delete creator material files" on storage.objects;
create policy "teachers delete creator material files" on storage.objects
  for delete using (
    bucket_id = 'creator-materials' and is_teacher()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can oversee every account record, unpublished item, and creator file.
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create policy "admins read all profiles" on profiles
  for select using (is_admin());
create policy "admins update all profiles" on profiles
  for update using (is_admin()) with check (is_admin());
create policy "admins manage all progress" on progress
  for all using (is_admin()) with check (is_admin());
create policy "admins manage all notes" on notes
  for all using (is_admin()) with check (is_admin());
create policy "admins manage all course state" on course_state
  for all using (is_admin()) with check (is_admin());
create policy "admins manage all quiz results" on quiz_results
  for all using (is_admin()) with check (is_admin());
create policy "admins manage all learner boards" on boards
  for all using (is_admin()) with check (is_admin());
create policy "admins manage all comments" on comments
  for all using (is_admin()) with check (is_admin());
create policy "admins manage all creator materials" on creator_materials
  for all using (is_admin()) with check (is_admin());
create policy "admins manage all creator material files" on storage.objects
  for all using (bucket_id = 'creator-materials' and is_admin())
  with check (bucket_id = 'creator-materials' and is_admin());

-- ===================== supabase-step14.sql =====================
-- Limit the declared MIME types and file sizes accepted by storage buckets.
-- Storage checks the MIME type supplied by the uploader; it does not scan file contents.
update storage.buckets set
  allowed_mime_types = array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'text/markdown',
    'application/epub+zip',
    'application/zip',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif'
  ],
  file_size_limit = 26214400
where id = 'creator-materials';

update storage.buckets set
  allowed_mime_types = array['application/pdf'],
  file_size_limit = 26214400
where id = 'lesson-pdfs';
