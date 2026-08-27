-- Google Drive classroom materials: teacher-owned OAuth grants, classroom folders,
-- and explicit source metadata for imports into the existing private material pipeline.

BEGIN;

ALTER TABLE public.classroom_materials
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'local_upload'
    CHECK (source_type IN ('local_upload', 'google_drive')),
  ADD COLUMN IF NOT EXISTS drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_modified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS drive_web_view_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS classroom_materials_drive_file_unique_idx
  ON public.classroom_materials (classroom_id, drive_file_id)
  WHERE drive_file_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.google_drive_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id TEXT NOT NULL UNIQUE,
  google_email TEXT,
  encrypted_refresh_token TEXT NOT NULL,
  granted_scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'revoked', 'error')),
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.classroom_drive_folders (
  classroom_id UUID PRIMARY KEY REFERENCES public.classrooms(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.google_drive_connections(id) ON DELETE CASCADE,
  drive_folder_id TEXT NOT NULL UNIQUE,
  folder_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS classroom_drive_folders_connection_idx
  ON public.classroom_drive_folders (connection_id);

ALTER TABLE public.google_drive_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_drive_folders ENABLE ROW LEVEL SECURITY;

-- No authenticated or anonymous policies are intentionally created for these tables.
-- OAuth refresh tokens and Drive folder mappings are backend service-role data only.

COMMIT;
