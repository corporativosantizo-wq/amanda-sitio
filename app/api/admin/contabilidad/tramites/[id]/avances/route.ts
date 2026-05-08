// ============================================================================
// app/api/admin/contabilidad/tramites/[id]/avances/route.ts
// POST → crear avance. Body multipart/form-data:
//        - fecha (string YYYY-MM-DD opcional, default hoy)
//        - descripcion (string requerido)
//        - documento (File opcional, sube a bucket "documentos")
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  crearAvance,
  subirAdjuntoAvance,
  TramiteError,
} from '@/lib/services/tramites.service';
import { handleApiError } from '@/lib/api-error';

type RouteParams = { params: Promise<{ id: string }> };
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id: tramiteId } = await params;

    let fecha: string | undefined;
    let descripcion = '';
    let documentoPath: string | null = null;

    const ct = request.headers.get('content-type') ?? '';
    if (ct.includes('multipart/form-data')) {
      const form = await request.formData();
      const fechaRaw = form.get('fecha');
      fecha = typeof fechaRaw === 'string' && fechaRaw ? fechaRaw : undefined;
      const descRaw = form.get('descripcion');
      descripcion = typeof descRaw === 'string' ? descRaw.trim() : '';
      const file = form.get('documento');
      if (file && file instanceof File && file.size > 0) {
        if (file.size > MAX_FILE_BYTES) {
          return NextResponse.json(
            { error: `El adjunto excede el máximo (${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB)` },
            { status: 400 },
          );
        }
        const buf = Buffer.from(await file.arrayBuffer());
        documentoPath = await subirAdjuntoAvance(tramiteId, file.name, buf, file.type || 'application/octet-stream');
      }
    } else {
      const body = await request.json().catch(() => ({}));
      if (typeof body.fecha === 'string')       fecha = body.fecha;
      if (typeof body.descripcion === 'string') descripcion = body.descripcion.trim();
      if (typeof body.documento_path === 'string') documentoPath = body.documento_path;
    }

    if (!descripcion) {
      return NextResponse.json({ error: 'La descripción del avance es obligatoria' }, { status: 400 });
    }

    const avance = await crearAvance({
      tramite_id: tramiteId,
      fecha,
      descripcion,
      documento_path: documentoPath,
    });
    return NextResponse.json(avance, { status: 201 });
  } catch (error) {
    if (error instanceof TramiteError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, 'tramites/[id]/avances POST');
  }
}
