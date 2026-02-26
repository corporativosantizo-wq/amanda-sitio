// ============================================================================
// lib/storage/signed-url-upload.ts
// Upload de archivos a Supabase Storage via signed URL + PUT directo.
// Bypasea Kong completamente — soporta archivos de cualquier tamaño
// hasta el límite del bucket (1GB).
// ============================================================================

export type ProgressCallback = (loaded: number, total: number) => void;

interface UploadResult {
  ok: boolean;
  status: number;
  text: string;
}

/**
 * Sube un archivo a Supabase Storage via PUT directo al signed URL.
 * Usa XMLHttpRequest para reportar progreso de subida.
 */
export function signedUrlUpload(
  signedUrl: string,
  file: File,
  contentType: string,
  onProgress?: ProgressCallback,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('Content-Type', contentType);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded, e.total);
      };
    }

    xhr.onload = () =>
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        text: xhr.responseText,
      });

    xhr.onerror = () => reject(new Error('Error de conexión al subir archivo'));
    xhr.send(file);
  });
}
