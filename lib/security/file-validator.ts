// ============================================================================
// lib/security/file-validator.ts
// Validates file uploads: MIME type, size, and filename sanitization
// ============================================================================

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export function validateFile(
  file: File,
  options?: { allowedMimeTypes?: string[]; maxSize?: number },
): { valid: boolean; reason?: string } {
  const allowed = options?.allowedMimeTypes ?? ALLOWED_MIME_TYPES;
  const maxSize = options?.maxSize ?? MAX_FILE_SIZE;

  if (!allowed.includes(file.type)) {
    return { valid: false, reason: `Tipo de archivo no permitido: ${file.type}` };
  }
  if (file.size > maxSize) {
    return { valid: false, reason: `Archivo excede el límite de ${Math.round(maxSize / (1024 * 1024))}MB` };
  }
  return { valid: true };
}

export function sanitizeFileName(name: string): string {
  return name
    .replace(/\.\./g, '') // prevent path traversal
    .replace(/[^a-zA-Z0-9._-]/g, '_') // only safe characters
    .substring(0, 255); // max length
}
