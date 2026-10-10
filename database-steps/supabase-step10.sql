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
