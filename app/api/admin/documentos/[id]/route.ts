// ============================================================================
// GET/PATCH/DELETE /api/admin/documentos/[id]
// Operaciones sobre un documento individual
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerDocumento,
  eliminarDocumento,
  generarSignedUrl,
  DocumentoError,
} from '@/lib/services/documentos.service';
import { createAdminClient } from '@/lib/supabase/admin';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const doc = await obtenerDocumento(id);

    // Generar URL firmada para ver el PDF
    let signedUrl: string | null = null;
    try {
      signedUrl = await generarSignedUrl(doc.archivo_url, 600);
    } catch {
      // Si falla la URL firmada, no bloquear
    }

    return NextResponse.json({ ...doc, signed_url: signedUrl });
  } catch (err: any) {
    const msg = err instanceof DocumentoError ? err.message : 'Error interno';
    const status = msg.includes('no encontrado') ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();
    const db = createAdminClient();

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.tipo !== undefined) updates.tipo = body.tipo;
    if (body.titulo !== undefined) updates.titulo = body.titulo;
    if (body.fecha_documento !== undefined) updates.fecha_documento = body.fecha_documento;
    if (body.cliente_id !== undefined) updates.cliente_id = body.cliente_id;
    if (body.notas !== undefined) updates.notas = body.notas;

    const { data, error } = await db
      .from('documentos')
      .update(updates)
      .eq('id', id)
      .select('*, cliente:clientes!cliente_id(id, codigo, nombre)')
      .single();

    if (error) throw new DocumentoError('Error al actualizar', error);
    return NextResponse.json(data);
  } catch (err: any) {
    const msg = err instanceof DocumentoError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await eliminarDocumento(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const msg = err instanceof DocumentoError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
