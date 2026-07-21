// ============================================================================
// lib/adjuntos-correo.ts
// Constantes y validación compartidas para adjuntos de correo (bucket
// adjuntos-correo). Se importa tanto en el cliente (validar ANTES de subir)
// como en las API routes (validar de nuevo server-side) — mantener este módulo
// libre de imports de servidor.
// ============================================================================

export const ADJUNTOS_BUCKET = 'adjuntos-correo';

export const MAX_ADJUNTO_SIZE = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_ADJUNTO_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
];

// Supabase Storage rechaza con 400 las claves de objeto con caracteres no-ASCII
// (acentos, ñ, etc.). Saneamos SOLO la clave de almacenamiento; el nombre
// original se conserva en la metadata (`name`) para mostrarlo y adjuntarlo en el
// correo con su nombre correcto.
export function safeStorageName(name: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // elimina diacríticos: É→E, ñ→n
    .replace(/[^a-zA-Z0-9 ._-]/g, '_') // cualquier otro carácter no seguro → _
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'archivo';
}

/**
 * Valida un adjunto por tipo y tamaño. Devuelve un mensaje de error legible
 * para el usuario, o null si el archivo es válido.
 */
export function validarAdjunto(file: { name: string; size: number; type: string }): string | null {
  if (!ALLOWED_ADJUNTO_TYPES.includes(file.type)) {
    return `Tipo no permitido: ${file.name} (${file.type || 'desconocido'}). Se aceptan PDF, Word, Excel, JPG y PNG.`;
  }
  if (file.size > MAX_ADJUNTO_SIZE) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `"${file.name}" pesa ${mb} MB — el máximo por archivo es 25 MB.`;
  }
  return null;
}
