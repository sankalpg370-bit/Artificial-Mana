-- Step 12. Reassert private per-user data access. Run after steps 5-11.
-- Public course content, published creator materials, teacher boards, and comments remain public.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where (
      schemaname = 'public'
      and tablename = any(array[
        'profiles', 'progress', 'notes', 'course_state',
        'quiz_results', 'boards', 'creator_materials', 'comments'
      ])
    ) or (
      schemaname = 'storage'
      and tablename = 'objects'
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%creator-materials%'
    )
  loop
    execute format(
      'drop policy %I on %I.%I',
      existing_policy.policyname,
      existing_policy.schemaname,
      existing_policy.tablename
    );
  end loop;
end $$;

alter table profiles enable row level security;
create policy "read own profile" on profiles
  for select using (auth.uid() = user_id);

alter table progress enable row level security;
create policy "read own progress" on progress
  for select using (auth.uid() = user_id);
create policy "add own progress" on progress
  for insert with check (auth.uid() = user_id);
create policy "update own progress" on progress
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table notes enable row level security;
create policy "read own notes" on notes
  for select using (auth.uid() = user_id);
create policy "add own notes" on notes
  for insert with check (auth.uid() = user_id);
create policy "update own notes" on notes
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "delete own notes" on notes
  for delete using (auth.uid() = user_id);

alter table course_state enable row level security;
create policy "read own state" on course_state
  for select using (auth.uid() = user_id);
create policy "add own state" on course_state
  for insert with check (auth.uid() = user_id);
create policy "update own state" on course_state
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table quiz_results enable row level security;
create policy "read own results" on quiz_results
  for select using (auth.uid() = user_id);
create policy "add own results" on quiz_results
  for insert with check (auth.uid() = user_id);
create policy "update own results" on quiz_results
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table boards enable row level security;
create policy "read own boards" on boards
  for select using (auth.uid() = user_id);
create policy "add own boards" on boards
  for insert with check (auth.uid() = user_id);
create policy "update own boards" on boards
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "delete own boards" on boards
  for delete using (auth.uid() = user_id);

alter table creator_materials enable row level security;
create policy "read own or published creator materials" on creator_materials
  for select using (
    creator_id = auth.uid()
    or (
      published and exists (
        select 1 from courses c
        where c.slug = creator_materials.course_slug and c.published
      )
    )
  );
create policy "teachers add own creator materials" on creator_materials
  for insert with check (auth.uid() = creator_id and is_teacher());
create policy "teachers update own creator materials" on creator_materials
  for update using (auth.uid() = creator_id and is_teacher())
  with check (auth.uid() = creator_id and is_teacher());
create policy "teachers delete own creator materials" on creator_materials
  for delete using (auth.uid() = creator_id and is_teacher());

alter table comments enable row level security;
create policy "everyone reads comments" on comments
  for select using (true);
create policy "add own comments" on comments
  for insert with check (auth.uid() = user_id);
create policy "delete own comment or teacher" on comments
  for delete using (auth.uid() = user_id or is_teacher());

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
        and (
          m.creator_id = auth.uid()
          or (
            m.published and exists (
              select 1 from courses c
              where c.slug = m.course_slug and c.published
            )
          )
        )
    )
  );
drop policy if exists "teachers upload creator material files" on storage.objects;
create policy "teachers upload own creator material files" on storage.objects
  for insert with check (
    bucket_id = 'creator-materials' and is_teacher()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "teachers update creator material files" on storage.objects;
create policy "teachers update own creator material files" on storage.objects
  for update using (
    bucket_id = 'creator-materials' and is_teacher()
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or owner_id = auth.uid()::text
    )
  )
  with check (
    bucket_id = 'creator-materials' and is_teacher()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "teachers delete creator material files" on storage.objects;
create policy "teachers delete own creator material files" on storage.objects
  for delete using (
    bucket_id = 'creator-materials' and is_teacher()
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or owner_id = auth.uid()::text
    )
  );
