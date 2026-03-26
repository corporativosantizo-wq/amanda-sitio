-- ============================================================================
-- Migration: Storage bucket config + RLS policies for 'documentos' & 'notariado'
-- Fixes: signed URLs not working + uploads failing
-- Run in Supabase SQL Editor
-- ============================================================================

-- 1. Ensure buckets exist with correct config
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos', 'documentos', false,
  1073741824, -- 1GB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'notariado', 'notariado', false,
  157286400, -- 150MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Storage RLS policies on storage.objects
--    Service role bypasses RLS, but signed URLs issued by service_role
--    still need valid policies for the token to work on download.

-- Bucket: documentos
CREATE POLICY IF NOT EXISTS "documentos_service_select"
  ON storage.objects FOR SELECT
  TO service_role
  USING (bucket_id = 'documentos');

CREATE POLICY IF NOT EXISTS "documentos_service_insert"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'documentos');

CREATE POLICY IF NOT EXISTS "documentos_service_update"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'documentos');

CREATE POLICY IF NOT EXISTS "documentos_service_delete"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'documentos');

-- Signed URLs use the 'anon' role for verification, so we also need anon policies
CREATE POLICY IF NOT EXISTS "documentos_anon_select"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'documentos');

CREATE POLICY IF NOT EXISTS "documentos_anon_insert"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'documentos');

CREATE POLICY IF NOT EXISTS "documentos_anon_update"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'documentos');

-- Bucket: notariado
CREATE POLICY IF NOT EXISTS "notariado_service_select"
  ON storage.objects FOR SELECT
  TO service_role
  USING (bucket_id = 'notariado');

CREATE POLICY IF NOT EXISTS "notariado_service_insert"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'notariado');

CREATE POLICY IF NOT EXISTS "notariado_service_update"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'notariado');

CREATE POLICY IF NOT EXISTS "notariado_service_delete"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'notariado');

CREATE POLICY IF NOT EXISTS "notariado_anon_select"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'notariado');

CREATE POLICY IF NOT EXISTS "notariado_anon_insert"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'notariado');

CREATE POLICY IF NOT EXISTS "notariado_anon_update"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'notariado');
