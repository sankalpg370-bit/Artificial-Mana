// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';

let db;
const ids = { student: '11111111-1111-4111-8111-111111111111', other: '22222222-2222-4222-8222-222222222222', teacher: '33333333-3333-4333-8333-333333333333', admin: '44444444-4444-4444-8444-444444444444' };
async function as(role, identity, query) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${identity || ''}',false);`);
  try { return await db.query(query); } finally { await db.exec('reset role'); }
}
beforeAll(async () => {
  db = new PGlite();
  // Supabase provides these schemas/roles. The actual application SQL is executed unchanged.
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public,storage to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert,delete on storage.objects to anon,authenticated;`);
  await db.exec(readFileSync(new URL('../database/hosted-schema.sql', import.meta.url), 'utf8'));
  for (const id of Object.values(ids)) await db.query('insert into auth.users values($1)', [id]);
  await db.query("update profiles set role='teacher' where user_id=$1", [ids.teacher]);
  await db.query("update profiles set role='admin' where user_id=$1", [ids.admin]);
  await db.exec(`insert into courses(slug,title,published) values('public-course','Public',false),('draft-course','Draft',false);
    insert into lessons(id,course_slug,title,youtube_id,quiz) values('public-lesson','public-course','Lesson','aircAruvnKk','[{"q":"Q1","options":["a","b"],"answer":0},{"q":"Q2","options":["a","b"],"answer":0}]'),('draft-lesson','draft-course','Draft','aircAruvnKk',null);
    update courses set published=true where slug='public-course';`);
}, 30000);
afterAll(async () => { await db?.close(); });

describe('hosted PostgreSQL permissions and integrity', () => {
  it('blocks empty publication through direct teacher and admin writes, including upserts', async () => {
    for (const role of ['teacher', 'admin']) {
      await expect(as('authenticated', ids[role], `insert into courses(slug,title,published) values('${role}-empty','Empty',true)`)).rejects.toThrow(/at least one lesson/);
      await as('authenticated', ids[role], `insert into courses(slug,title) values('${role}-empty','Empty')`);
      await expect(as('authenticated', ids[role], `update courses set published=true where slug='${role}-empty'`)).rejects.toThrow(/at least one lesson/);
      await expect(as('authenticated', ids[role], `insert into courses(slug,title,published) values('${role}-empty','Empty',true) on conflict(slug) do update set published=excluded.published`)).rejects.toThrow(/at least one lesson/);
      expect((await as('authenticated', ids[role], `select published from courses where slug='${role}-empty'`)).rows).toEqual([{ published: false }]);
      await as('authenticated', ids[role], `delete from courses where slug='${role}-empty'`);
    }
  });
  it('keeps a course published until its last lesson is removed, then returns it to draft', async () => {
    await as('authenticated', ids.teacher, "insert into courses(slug,title) values('publication-flow','Publication flow')");
    await as('authenticated', ids.teacher, "insert into lessons(id,course_slug,title,youtube_id) values('publication-1','publication-flow','First','aircAruvnKk'),('publication-2','publication-flow','Second','aircAruvnKk')");
    await as('authenticated', ids.teacher, "update courses set published=true where slug='publication-flow'");
    await as('authenticated', ids.teacher, "delete from lessons where id='publication-1'");
    expect((await as('anon', '', "select slug from courses where slug='publication-flow'")).rows).toHaveLength(1);
    await as('authenticated', ids.teacher, "delete from lessons where id='publication-2'");
    expect((await as('anon', '', "select slug from courses where slug='publication-flow'")).rows).toHaveLength(0);
    expect((await as('authenticated', ids.teacher, "select published from courses where slug='publication-flow'")).rows).toEqual([{ published: false }]);
    await as('authenticated', ids.teacher, "insert into lessons(id,course_slug,title,youtube_id) values('publication-3','publication-flow','Replacement','aircAruvnKk')");
    expect((await as('authenticated', ids.teacher, "select published from courses where slug='publication-flow'")).rows).toEqual([{ published: false }]);
    await as('authenticated', ids.teacher, "update courses set published=true where slug='publication-flow'");
    await as('authenticated', ids.teacher, "delete from courses where slug='publication-flow'");
  });
  it('repairs existing empty publications safely and can apply the forward update again', async () => {
    await db.exec("drop trigger mana_course_publication on courses; insert into courses(slug,title,published) values('legacy-empty','Preserve my title',true)");
    const forward = readFileSync(new URL('../database/hosted-course-publication.sql', import.meta.url), 'utf8');
    await db.exec(forward);
    await db.exec(forward);
    expect((await db.query("select title,published from courses where slug='legacy-empty'")).rows).toEqual([{ title: 'Preserve my title', published: false }]);
    expect((await db.query("select published from courses where slug='public-course'")).rows).toEqual([{ published: true }]);
    await expect(as('authenticated', ids.teacher, "update courses set published=true where slug='legacy-empty'")).rejects.toThrow(/at least one lesson/);
    await db.exec("delete from courses where slug='legacy-empty'");
  });
  it('seeds new users as students and blocks self-promotion', async () => {
    const rows = await as('authenticated', ids.student, 'select role from profiles');
    expect(rows.rows).toEqual([{ role: 'student' }]);
    await as('authenticated', ids.student, "update profiles set role='admin'");
    expect((await db.query('select role from profiles where user_id=$1', [ids.student])).rows[0].role).toBe('student');
    await expect(as('authenticated', ids.student, `insert into profiles(user_id,role) values('${ids.other}','admin')`)).rejects.toThrow();
  });
  it('exposes published courses and lessons to visitors while hiding drafts', async () => {
    expect((await as('anon', '', 'select slug from courses')).rows).toEqual([{ slug: 'public-course' }]);
    expect((await as('anon', '', 'select id from lessons')).rows).toEqual([{ id: 'public-lesson' }]);
    expect((await as('authenticated', ids.teacher, 'select slug from courses')).rows).toHaveLength(2);
    await expect(as('authenticated', ids.student, "insert into courses(slug,title) values('forged','No')")).rejects.toThrow();
  });
  it('isolates notes across students and teachers but allows administrator support', async () => {
    await as('authenticated', ids.student, "insert into notes(course_slug,lesson_id,content) values('public-course','public-lesson','Private')");
    expect((await as('authenticated', ids.other, 'select * from notes')).rows).toHaveLength(0);
    expect((await as('authenticated', ids.teacher, 'select * from notes')).rows).toHaveLength(0);
    expect((await as('authenticated', ids.admin, 'select * from notes')).rows).toHaveLength(1);
    await expect(as('authenticated', ids.other, `insert into notes(user_id,course_slug,lesson_id,content) values('${ids.student}','public-course','public-lesson','Forged')`)).rejects.toThrow();
  });
  it('rejects partial quizzes, invalid lessons, executable links and identity changes', async () => {
    await expect(as('authenticated', ids.student, "insert into quiz_results(course_slug,lesson_id,score,total) values('public-course','public-lesson',1,1)")).rejects.toThrow(/complete/);
    await as('authenticated', ids.student, "insert into quiz_results(course_slug,lesson_id,score,total) values('public-course','public-lesson',2,2)");
    await expect(as('authenticated', ids.student, "insert into boards(course_slug,lesson_id,data) values('public-course','draft-lesson','{}')")).rejects.toThrow(/lesson/);
    await expect(as('authenticated', ids.teacher, "update lessons set id='changed' where id='public-lesson'")).rejects.toThrow(/identities/);
    await expect(as('authenticated', ids.teacher, "update lessons set pdf_url='javascript:alert(1)' where id='public-lesson'")).rejects.toThrow();
    await expect(as('authenticated', ids.teacher, `update lessons set quiz='[{"q":"Q","options":["a","b"],"answer":9}]' where id='public-lesson'`)).rejects.toThrow(/answer/);
  });
  it('derives comment attribution and prevents spam-limit bypass via deletion', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await as('authenticated', ids.student, "insert into comments(course_slug,lesson_id,author_name,body,author_is_teacher,created_at) values('public-course','public-lesson','Ada','Q',true,'2000-01-01') returning id,author_is_teacher,created_at");
      expect(r.rows[0].author_is_teacher).toBe(false);
      expect(Date.parse(r.rows[0].created_at)).toBeGreaterThan(Date.now() - 10000);
      await as('authenticated', ids.student, `delete from comments where id='${r.rows[0].id}'`);
    }
    await expect(as('authenticated', ids.student, "insert into comments(course_slug,lesson_id,author_name,body) values('public-course','public-lesson','Ada','Q')")).rejects.toThrow(/slow_down/);
  });
  it('keeps creator uploads private until their material and course are published', async () => {
    const name = `${ids.teacher}/private.txt`;
    await as('authenticated', ids.teacher, `insert into storage.objects(bucket_id,name) values('creator-materials','${name}')`);
    expect((await as('anon', '', 'select * from storage.objects')).rows).toHaveLength(0);
    await as('authenticated', ids.teacher, `insert into creator_materials(course_slug,kind,title,storage_path) values('public-course','file','File','${name}')`);
    expect((await as('authenticated', ids.student, 'select * from storage.objects')).rows).toHaveLength(0);
    await as('authenticated', ids.teacher, "update creator_materials set published=true");
    expect((await as('anon', '', 'select * from storage.objects')).rows).toHaveLength(1);
    await expect(as('authenticated', ids.student, "insert into storage.objects(bucket_id,name) values('lesson-pdfs','forged.pdf')")).rejects.toThrow();
    await expect(as('authenticated', ids.teacher, `insert into creator_materials(course_slug,kind,title,storage_path) values('public-course','file','Forged','${ids.other}/private.txt')`)).rejects.toThrow();
  });
  it('cleans removed lessons including diagram boards and blocks delayed writes', async () => {
    await as('authenticated', ids.student, "insert into boards(course_slug,lesson_id,data) values('public-course','public-lesson:diagram','{}')");
    await as('authenticated', ids.teacher, "delete from lessons where id='public-lesson'");
    expect((await as('authenticated', ids.student, 'select * from notes')).rows).toHaveLength(0);
    expect((await as('authenticated', ids.student, 'select * from boards')).rows).toHaveLength(0);
    await expect(as('authenticated', ids.student, "insert into notes(course_slug,lesson_id,content) values('public-course','public-lesson','Late')")).rejects.toThrow(/lesson/);
  });
  it('seeds a complete sample and preserves an existing decision to keep it in draft', async () => {
    const seed = readFileSync(new URL('../database/hosted-seed.sql', import.meta.url), 'utf8');
    await db.exec(seed);
    expect((await db.query("select published from courses where slug='intro-to-ai'")).rows).toEqual([{ published: true }]);
    expect((await db.query("select id from lessons where course_slug='intro-to-ai'")).rows).toHaveLength(3);
    await db.exec("update courses set published=false where slug='intro-to-ai'");
    await db.exec(seed);
    expect((await db.query("select published from courses where slug='intro-to-ai'")).rows).toEqual([{ published: false }]);
  });
});
