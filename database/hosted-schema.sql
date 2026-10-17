-- Fresh Supabase project only. Do not combine with the historical database-steps SQL.
-- Tables fail if already present, so existing production schemas are never silently replaced.
begin;
create schema mana_private;
grant usage on schema mana_private to anon, authenticated;
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student','teacher','admin'))
);
create function mana_private.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where user_id=auth.uid() and role='admin');
$$;
create function mana_private.is_teacher() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where user_id=auth.uid() and role in ('teacher','admin'));
$$;
create function public.new_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into profiles(user_id) values(new.id); return new; end;
$$;
create trigger mana_new_profile after insert on auth.users for each row execute function public.new_profile();
insert into profiles(user_id) select id from auth.users;
create table public.courses (
  slug text primary key check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check(length(title) between 1 and 4000), description text, category text,
  published boolean not null default false, created_at timestamptz not null default now()
);
create table public.lessons (
  id text primary key, course_slug text not null references courses(slug) on delete cascade,
  position integer not null default 1 check(position>=0), title text not null,
  youtube_id text not null check(youtube_id ~ '^[A-Za-z0-9_-]{11}$'), pdf_url text, quiz jsonb
);
create table public.progress (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_slug text not null references courses(slug) on delete cascade, lesson_id text not null,
  completed_at timestamptz not null default now(), primary key(user_id,course_slug,lesson_id)
);
create table public.notes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_slug text not null references courses(slug) on delete cascade, lesson_id text not null,
  seconds integer not null default 0 check(seconds>=0), content text not null check(length(content)<=100000),
  created_at timestamptz not null default now()
);
create table public.course_state (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_slug text not null references courses(slug) on delete cascade, bookmarked boolean not null default false,
  last_lesson text, updated_at timestamptz not null default now(), primary key(user_id,course_slug)
);
create table public.quiz_results (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_slug text not null references courses(slug) on delete cascade, lesson_id text not null,
  score integer not null check(score>=0), total integer not null check(total>0 and score<=total),
  updated_at timestamptz not null default now(), primary key(user_id,course_slug,lesson_id)
);
create table public.boards (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_slug text not null references courses(slug) on delete cascade, lesson_id text not null,
  data jsonb not null check(octet_length(data::text)<=1500000), updated_at timestamptz not null default now(),
  primary key(user_id,course_slug,lesson_id)
);
create table public.lesson_boards (
  course_slug text not null references courses(slug) on delete cascade, lesson_id text not null,
  data jsonb not null check(octet_length(data::text)<=1500000), updated_at timestamptz not null default now(),
  primary key(course_slug,lesson_id)
);
create table public.comments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_slug text not null references courses(slug) on delete cascade, lesson_id text not null,
  parent_id uuid references comments(id) on delete cascade,
  author_name text not null check(length(author_name) between 1 and 40), author_is_teacher boolean not null default false,
  body text not null check(length(body) between 1 and 1000), created_at timestamptz not null default now()
);
create table public.creator_materials (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_slug text not null references courses(slug) on delete cascade,
  lesson_id text references lessons(id) on delete set null,
  kind text not null check(kind in ('link','assignment','note','file','other')),
  title text not null check(length(title) between 1 and 160), content text check(length(content)<=100000),
  url text, file_url text, storage_path text, published boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(storage_path is null or split_part(storage_path,'/',1)=creator_id::text)
);
create index notes_owner on notes(user_id,course_slug,lesson_id);
create index comments_lesson on comments(course_slug,lesson_id);
create index lessons_course on lessons(course_slug,position);
create index materials_file on creator_materials(storage_path);
-- Private counters cannot be reset by deleting comments or forging timestamps.
create table public.comment_limits(user_id uuid primary key references auth.users(id) on delete cascade, count integer not null, expires_at timestamptz not null);
alter table comment_limits enable row level security;
revoke all on comment_limits from anon, authenticated;
create function public.validate_learning_record() returns trigger language plpgsql set search_path = public as $$
declare lid text; expected integer;
begin
  lid := case when tg_table_name='course_state' then to_jsonb(new)->>'last_lesson' else to_jsonb(new)->>'lesson_id' end;
  if tg_table_name='boards' and lid like '%:diagram' then lid := left(lid,-8); end if;
  if lid is not null and not exists(select 1 from lessons where id=lid and course_slug=new.course_slug) then
    raise exception 'Choose an existing lesson in this course.';
  end if;
  if tg_table_name='quiz_results' then
    select jsonb_array_length(quiz) into expected from lessons where id=lid and course_slug=new.course_slug;
    if expected is null or expected=0 or new.total<>expected then raise exception 'Answer the complete current quiz.'; end if;
  end if;
  if tg_table_name in ('course_state','quiz_results','boards','lesson_boards','creator_materials') then new.updated_at:=now(); end if;
  return new;
end;
$$;
do $$ declare t text; begin
  foreach t in array array['progress','notes','course_state','quiz_results','boards','lesson_boards','creator_materials'] loop
    execute format('create trigger mana_validate before insert or update on public.%I for each row execute function public.validate_learning_record()',t);
  end loop;
end $$;
create function public.validate_comment() returns trigger language plpgsql security definer set search_path = public as $$
declare attempts integer;
begin
  if not exists(select 1 from lessons where id=new.lesson_id and course_slug=new.course_slug) then raise exception 'Choose a lesson in this course.'; end if;
  if new.parent_id is not null and not exists(select 1 from comments where id=new.parent_id and course_slug=new.course_slug and lesson_id=new.lesson_id and parent_id is null) then raise exception 'Reply to an existing question in this lesson.'; end if;
  if tg_op='INSERT' then
    new.created_at:=now();
    if not mana_private.is_admin() then new.author_is_teacher:=mana_private.is_teacher(); end if;
    insert into comment_limits values(auth.uid(),1,now()+interval '60 seconds')
      on conflict(user_id) do update set count=case when comment_limits.expires_at<=now() then 1 else comment_limits.count+1 end,
      expires_at=case when comment_limits.expires_at<=now() then now()+interval '60 seconds' else comment_limits.expires_at end returning count into attempts;
    if attempts>5 then raise exception 'slow_down: Please wait one minute.'; end if;
  end if;
  return new;
end;
$$;
create trigger mana_comment before insert or update on comments for each row execute function validate_comment();
create function public.safe_content_url(value text) returns boolean language sql immutable set search_path = public as $$
  select value is null or value='' or (value !~ '[[:space:]\\]' and (value ~ '^https?://' or (left(value,1)='/' and left(value,2)<>'//')));
$$;
alter table lessons add check(public.safe_content_url(pdf_url));
alter table creator_materials add check(public.safe_content_url(url)), add check(public.safe_content_url(file_url));
create function public.validate_course_identity() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name='courses' then
    if new.slug<>old.slug then raise exception 'Course addresses cannot change.'; end if;
  elsif new.id<>old.id or new.course_slug<>old.course_slug then raise exception 'Lesson identities cannot change.';
  end if;
  return new;
end;
$$;
create trigger mana_course_identity before update on courses for each row execute function validate_course_identity();
create trigger mana_lesson_identity before update on lessons for each row execute function validate_course_identity();
create function public.validate_quiz() returns trigger language plpgsql set search_path = public as $$
declare item jsonb;
begin
  if new.quiz is null then return new; end if;
  if jsonb_typeof(new.quiz)<>'array' or jsonb_array_length(new.quiz)>1000 then raise exception 'Invalid quiz.'; end if;
  for item in select value from jsonb_array_elements(new.quiz) loop
    if jsonb_typeof(item->'q') is distinct from 'string' or jsonb_typeof(item->'options') is distinct from 'array' or jsonb_typeof(item->'answer') is distinct from 'number' then raise exception 'Invalid quiz question.'; end if;
    if jsonb_array_length(item->'options')<2 or (item->>'answer') !~ '^[0-9]+$' then raise exception 'Invalid quiz options.'; end if;
    if (item->>'answer')::numeric>=jsonb_array_length(item->'options') or exists(select 1 from jsonb_array_elements(item->'options') o where jsonb_typeof(o)<>'string') then raise exception 'Invalid quiz answer.'; end if;
  end loop;
  return new;
end;
$$;
create trigger mana_quiz before insert or update on lessons for each row execute function validate_quiz();
create function public.cleanup_lesson() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from progress where course_slug=old.course_slug and lesson_id=old.id;
  delete from notes where course_slug=old.course_slug and lesson_id=old.id;
  delete from quiz_results where course_slug=old.course_slug and lesson_id=old.id;
  delete from boards where course_slug=old.course_slug and lesson_id in (old.id,old.id||':diagram');
  delete from lesson_boards where course_slug=old.course_slug and lesson_id=old.id;
  delete from comments where course_slug=old.course_slug and lesson_id=old.id;
  update course_state set last_lesson=null where course_slug=old.course_slug and last_lesson=old.id;
  return old;
end;
$$;
create trigger mana_cleanup after delete on lessons for each row execute function cleanup_lesson();
-- RLS is the authority for browser SDK requests; frontend role checks only control presentation.
do $$ declare t text; begin
  foreach t in array array['profiles','courses','lessons','progress','notes','course_state','quiz_results','boards','lesson_boards','comments','creator_materials'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('grant select on public.%I to anon, authenticated',t);
    execute format('grant insert,update,delete on public.%I to authenticated',t);
    execute format('create policy mana_admin on public.%I for all to authenticated using (mana_private.is_admin()) with check (mana_private.is_admin())',t);
  end loop;
  foreach t in array array['progress','notes','course_state','quiz_results','boards'] loop
    execute format('create policy mana_owner on public.%I for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid())',t);
  end loop;
end $$;
create policy mana_profile_read on profiles for select to authenticated using(user_id=auth.uid());
create policy mana_course_read on courses for select using(published or mana_private.is_teacher());
create policy mana_course_write on courses for all to authenticated using(mana_private.is_teacher()) with check(mana_private.is_teacher());
create policy mana_lesson_read on lessons for select using(mana_private.is_teacher() or exists(select 1 from courses where slug=course_slug and published));
create policy mana_lesson_write on lessons for all to authenticated using(mana_private.is_teacher()) with check(mana_private.is_teacher());
create policy mana_teacher_board_read on lesson_boards for select using(mana_private.is_teacher() or exists(select 1 from courses where slug=course_slug and published));
create policy mana_teacher_board_write on lesson_boards for all to authenticated using(mana_private.is_teacher()) with check(mana_private.is_teacher());
create policy mana_material_read on creator_materials for select using(creator_id=auth.uid() or (published and exists(select 1 from courses where slug=course_slug and published)));
create policy mana_material_write on creator_materials for all to authenticated using(creator_id=auth.uid() and mana_private.is_teacher()) with check(creator_id=auth.uid() and mana_private.is_teacher());
create policy mana_comment_read on comments for select using(mana_private.is_teacher() or exists(select 1 from courses where slug=course_slug and published));
create policy mana_comment_insert on comments for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from courses where slug=course_slug and published));
create policy mana_comment_delete on comments for delete to authenticated using(user_id=auth.uid() or mana_private.is_teacher());
-- Public PDFs, private creator uploads. Bodies go directly to Storage, not Vercel functions.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('lesson-pdfs','lesson-pdfs',true,26214400,array['application/pdf']),
('creator-materials','creator-materials',false,26214400,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv','text/plain','text/markdown','application/epub+zip','application/zip','image/png','image/jpeg','image/webp','image/gif']);
create policy mana_file_read on storage.objects for select using(
  bucket_id='lesson-pdfs' or (bucket_id='creator-materials' and (mana_private.is_admin() or split_part(name,'/',1)=auth.uid()::text or exists(
    select 1 from creator_materials m join courses c on c.slug=m.course_slug where m.storage_path=name and split_part(name,'/',1)=m.creator_id::text and m.published and c.published
  )))
);
create policy mana_file_insert on storage.objects for insert to authenticated with check(
  mana_private.is_teacher() and (bucket_id='lesson-pdfs' or (bucket_id='creator-materials' and (mana_private.is_admin() or split_part(name,'/',1)=auth.uid()::text)))
);
create policy mana_file_delete on storage.objects for delete to authenticated using(
  mana_private.is_teacher() and (bucket_id='lesson-pdfs' or (bucket_id='creator-materials' and (mana_private.is_admin() or split_part(name,'/',1)=auth.uid()::text)))
);
-- Trigger functions are not public RPCs. Role helpers live outside exposed API schemas.
revoke execute on function new_profile(),validate_comment(),validate_learning_record(),validate_course_identity(),validate_quiz(),cleanup_lesson() from public,anon,authenticated;
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.lesson_boards;
  end if;
end $$;
commit;
