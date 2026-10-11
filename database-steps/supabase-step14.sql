-- Step 14. Limit the declared MIME types and file sizes accepted by the storage buckets.
-- Run this one time in the Supabase SQL Editor, after step 13.
-- Storage checks the MIME type supplied by the uploader; it does not scan file contents.

update storage.buckets set
  allowed_mime_types = array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'text/markdown',
  'application/epub+zip',
  'application/zip',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
  ],
  file_size_limit = 26214400
where id = 'creator-materials';

-- Lesson PDFs (public bucket): PDF files only.
update storage.buckets set
  allowed_mime_types = array['application/pdf'],
  file_size_limit = 26214400
where id = 'lesson-pdfs';
