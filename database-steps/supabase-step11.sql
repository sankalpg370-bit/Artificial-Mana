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
