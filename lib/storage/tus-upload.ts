'use client';

// ============================================================================
// lib/storage/tus-upload.ts
// Subida resumable (TUS) para archivos grandes a Supabase Storage
// Para archivos >50MB. Archivos menores usan upload estándar (signed URL).
// ============================================================================

import * as tus from 'tus-js-client';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// https://xxx.supabase.co → xxx
const PROJECT_REF = SUPABASE_URL.replace('https://', '').split('.')[0];
// Usar hostname directo de storage para mejor rendimiento
const TUS_ENDPOINT = `https://${PROJECT_REF}.storage.supabase.co/storage/v1/upload/resumable`;

export const TUS_THRESHOLD = 50 * 1024 * 1024; // 50MB

// ── Token cache ─────────────────────────────────────────────────────────────

let cachedToken: string | null = null;

async function getStorageToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const res = await fetch('/api/admin/storage/tus-token');
  if (!res.ok) throw new Error('No se pudo obtener token de almacenamiento');
  const data = await res.json();
  cachedToken = data.token;
  return data.token;
}

// ── TUS Upload ──────────────────────────────────────────────────────────────

interface TusUploadParams {
  file: File;
  bucketName: string;
  objectName: string;
  onProgress: (bytesUploaded: number, bytesTotal: number) => void;
}

export function tusUpload(params: TusUploadParams): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const token = await getStorageToken();

      const upload = new tus.Upload(params.file, {
        endpoint: TUS_ENDPOINT,
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
        chunkSize: 6 * 1024 * 1024, // 6MB — requerido por Supabase
        onError: (error) => {
          reject(error);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          params.onProgress(bytesUploaded, bytesTotal);
        },
        onSuccess: () => {
          resolve();
        },
      });

      // Intentar reanudar subida previa (resume)
      const previousUploads = await upload.findPreviousUploads();
      if (previousUploads.length) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      upload.start();
    } catch (err) {
      reject(err);
    }
  });
}
