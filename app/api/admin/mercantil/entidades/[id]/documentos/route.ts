// ============================================================================
// GET: Listar documentos de entidad · POST: Crear documento
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { listarDocumentos, crearDocumento, actualizarDocumento, EntidadError } from '@/lib/services/entidades-mercantiles.service';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const documentos = await listarDocumentos(id);
    return NextResponse.json(documentos);
  } catch (err) {
    const msg = err instanceof EntidadError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.titulo?.trim() || !body.tipo) {
      return NextResponse.json({ error: 'Título y tipo son obligatorios' }, { status: 400 });
    }
    const doc = await crearDocumento({ ...body, entidad_id: id });
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    const msg = err instanceof EntidadError ? err.message : 'Error al crear documento';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: 'ID del documento es obligatorio' }, { status: 400 });
    }
    const doc = await actualizarDocumento(body.id, body);
    return NextResponse.json(doc);
  } catch (err) {
    const msg = err instanceof EntidadError ? err.message : 'Error al actualizar documento';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
