'use client';

// ============================================================================
// lib/storage/tus-upload.ts
// Subida de archivos grandes a Supabase Storage via signed upload URLs.
// El service_role_key NUNCA sale del servidor — se genera un signed URL
// por archivo y el cliente sube directamente a esa URL.
// ============================================================================

export const TUS_THRESHOLD = 50 * 1024 * 1024; // 50MB — umbral de referencia

// ── Signed Upload ───────────────────────────────────────────────────────────

interface TusUploadParams {
  file: File;
  bucketName: string;
  objectName: string;
  onProgress: (bytesUploaded: number, bytesTotal: number) => void;
}

export function tusUpload(params: TusUploadParams): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Obtener signed upload URL del servidor (service_role queda server-side)
      const res = await fetch('/api/admin/storage/tus-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket: params.bucketName,
          objectName: params.objectName,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Error al obtener URL de subida (${res.status})`);
      }

      const { signedUrl } = await res.json();

      // 2. Subir archivo usando XMLHttpRequest para reporte de progreso
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          params.onProgress(e.loaded, e.total);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Error al subir archivo: ${xhr.status} ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Error de red al subir archivo')));
      xhr.addEventListener('abort', () => reject(new Error('Subida cancelada')));

      xhr.open('PUT', signedUrl);
      xhr.setRequestHeader('Content-Type', params.file.type || 'application/octet-stream');
      xhr.send(params.file);
    } catch (err) {
      reject(err);
    }
  });
}
