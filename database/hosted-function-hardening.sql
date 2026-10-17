-- Tighten function exposure without modifying accounts or learning records.
begin;
create schema mana_private;
grant usage on schema mana_private to anon, authenticated;
alter function public.is_admin() set schema mana_private;
alter function public.is_teacher() set schema mana_private;
alter function public.safe_content_url(text) set search_path = public;
alter function public.validate_quiz() set search_path = public;
create or replace function public.validate_comment() returns trigger language plpgsql security definer set search_path = public as $$
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
commit;
