-- Forward update for existing hosted projects. Content is preserved; empty courses become drafts.
begin;

create or replace function mana_private.validate_course_publication()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.published and not exists(select 1 from public.lessons where course_slug=new.slug) then
    raise exception 'Add at least one lesson before publishing this course.' using errcode='23514';
  end if;
  return new;
end;
$$;

create or replace function mana_private.draft_empty_course()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  -- Serialize lesson removals against publishing and other removals in this course.
  -- Once the lock is acquired, the next statement sees the latest committed lessons.
  perform 1 from public.courses where slug=old.course_slug for update;
  update public.courses set published=false where slug=old.course_slug and published
    and not exists(select 1 from public.lessons where course_slug=old.course_slug and id<>old.id);
  return old;
end;
$$;

revoke execute on function mana_private.validate_course_publication(),mana_private.draft_empty_course() from public,anon,authenticated;
drop trigger if exists mana_course_publication on public.courses;
create trigger mana_course_publication before insert or update on public.courses
  for each row execute function mana_private.validate_course_publication();
drop trigger if exists mana_draft_empty_course on public.lessons;
create trigger mana_draft_empty_course before delete on public.lessons
  for each row execute function mana_private.draft_empty_course();

update public.courses set published=false where published
  and not exists(select 1 from public.lessons where course_slug=courses.slug);
commit;
