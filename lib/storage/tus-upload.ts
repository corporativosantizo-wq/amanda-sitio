'use client';

// ============================================================================
// lib/storage/tus-upload.ts
// Subida resumable de archivos grandes a Supabase Storage via protocolo TUS.
// El token de auth se obtiene del servidor via /api/admin/storage/tus-token
// (protegido por requireAdmin). No está hardcoded en el cliente.
// ============================================================================

import * as tus from 'tus-js-client';

export const TUS_THRESHOLD = 50 * 1024 * 1024; // 50MB — archivos mayores usan TUS

// ── TUS Resumable Upload ─────────────────────────────────────────────────────

interface TusUploadParams {
  file: File;
  bucketName: string;
  objectName: string;
  onProgress: (bytesUploaded: number, bytesTotal: number) => void;
}

export async function tusUpload(params: TusUploadParams): Promise<void> {
  // 1. Obtener credenciales TUS del servidor (solo admins autenticados)
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
    throw new Error(err.error ?? `Error al obtener credenciales de subida (${res.status})`);
  }

  const { tusEndpoint, token } = await res.json();

  // 2. Subir con tus-js-client (chunked, resumable)
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(params.file, {
      endpoint: tusEndpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${token}`,
        'x-upsert': 'true',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: params.bucketName,
        objectName: params.objectName,
        contentType: params.file.type || 'application/octet-stream',
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024, // 6 MB — requerido por Supabase Storage
      onError: (error) => {
        reject(new Error(`Error al subir archivo: ${error.message}`));
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        params.onProgress(bytesUploaded, bytesTotal);
      },
      onSuccess: () => {
        resolve();
      },
    });

    // Buscar uploads anteriores para reanudar si la conexión se cortó
    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      upload.start();
    });
  });
}
