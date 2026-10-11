-- Step 13. Give admin accounts full control of site and account data.
-- Run after steps 5-12 in the Supabase SQL Editor.

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "admins read all profiles" on profiles;
create policy "admins read all profiles" on profiles
  for select using (is_admin());
drop policy if exists "admins update all profiles" on profiles;
create policy "admins update all profiles" on profiles
  for update using (is_admin()) with check (is_admin());

drop policy if exists "admins manage all progress" on progress;
create policy "admins manage all progress" on progress
  for all using (is_admin()) with check (is_admin());
drop policy if exists "admins manage all notes" on notes;
create policy "admins manage all notes" on notes
  for all using (is_admin()) with check (is_admin());
drop policy if exists "admins manage all course state" on course_state;
create policy "admins manage all course state" on course_state
  for all using (is_admin()) with check (is_admin());
drop policy if exists "admins manage all quiz results" on quiz_results;
create policy "admins manage all quiz results" on quiz_results
  for all using (is_admin()) with check (is_admin());
drop policy if exists "admins manage all learner boards" on boards;
create policy "admins manage all learner boards" on boards
  for all using (is_admin()) with check (is_admin());
drop policy if exists "admins manage all comments" on comments;
create policy "admins manage all comments" on comments
  for all using (is_admin()) with check (is_admin());
drop policy if exists "admins manage all creator materials" on creator_materials;
create policy "admins manage all creator materials" on creator_materials
  for all using (is_admin()) with check (is_admin());

drop policy if exists "admins manage all creator material files" on storage.objects;
create policy "admins manage all creator material files" on storage.objects
  for all using (bucket_id = 'creator-materials' and is_admin())
  with check (bucket_id = 'creator-materials' and is_admin());
