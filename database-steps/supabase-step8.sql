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
