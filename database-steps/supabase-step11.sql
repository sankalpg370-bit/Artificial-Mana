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
create policy "read published creator materials" on creator_materials
  for select using (published or is_teacher());
drop policy if exists "teachers add creator materials" on creator_materials;
create policy "teachers add creator materials" on creator_materials
  for insert with check (auth.uid() = creator_id and is_teacher());
drop policy if exists "teachers change creator materials" on creator_materials;
create policy "teachers change creator materials" on creator_materials
  for update using (is_teacher()) with check (is_teacher());
drop policy if exists "teachers delete creator materials" on creator_materials;
create policy "teachers delete creator materials" on creator_materials
  for delete using (is_teacher());

insert into storage.buckets (id, name, public, file_size_limit)
values ('creator-materials', 'creator-materials', true, 26214400)
on conflict (id) do update set public = true, file_size_limit = 26214400;

drop policy if exists "public read creator material files" on storage.objects;
create policy "public read creator material files" on storage.objects
  for select using (bucket_id = 'creator-materials');
drop policy if exists "teachers upload creator material files" on storage.objects;
create policy "teachers upload creator material files" on storage.objects
  for insert with check (bucket_id = 'creator-materials' and is_teacher());
drop policy if exists "teachers update creator material files" on storage.objects;
create policy "teachers update creator material files" on storage.objects
  for update using (bucket_id = 'creator-materials' and is_teacher())
  with check (bucket_id = 'creator-materials' and is_teacher());
drop policy if exists "teachers delete creator material files" on storage.objects;
create policy "teachers delete creator material files" on storage.objects
  for delete using (bucket_id = 'creator-materials' and is_teacher());
