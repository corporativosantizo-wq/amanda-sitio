-- Agregar columnas de archivos PDF/DOCX a trámites mercantiles y laborales

ALTER TABLE legal.tramites_mercantiles
  ADD COLUMN archivo_pdf_url text,
  ADD COLUMN archivo_pdf_nombre text,
  ADD COLUMN archivo_docx_url text,
  ADD COLUMN archivo_docx_nombre text;

ALTER TABLE legal.tramites_laborales
  ADD COLUMN archivo_pdf_url text,
  ADD COLUMN archivo_pdf_nombre text,
  ADD COLUMN archivo_docx_url text,
  ADD COLUMN archivo_docx_nombre text;
