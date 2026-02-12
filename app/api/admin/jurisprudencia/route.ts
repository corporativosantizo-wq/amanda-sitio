// ============================================================================
// GET/POST /api/admin/jurisprudencia
// Listar tomos con filtros, carpetas jerárquicas, o registrar nuevo tomo
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listarTomos,
  listarCarpetas,
  crearTomo,
  JurisprudenciaError,
} from '@/lib/services/jurisprudencia.service';

export async function GET(req: NextRequest) {
  try {
    const s = req.nextUrl.searchParams;

    // Folder view: hierarchical carpetas
    if (s.get('carpetas') === 'true') {
      const carpetas = await listarCarpetas();
      return NextResponse.json({ carpetas });
    }

    const result = await listarTomos({
      carpeta_id: s.get('carpeta_id') ?? undefined,
      procesado: s.has('procesado') ? s.get('procesado') === 'true' : undefined,
      q: s.get('q') ?? undefined,
      page: parseInt(s.get('page') ?? '1'),
      limit: parseInt(s.get('limit') ?? '20'),
    });
    return NextResponse.json(result);
  } catch (err: any) {
    const msg = err instanceof JurisprudenciaError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { titulo, nombre_archivo, archivo_url, carpeta_id } = body;

    if (!titulo || !nombre_archivo || !archivo_url) {
      return NextResponse.json(
        { error: 'Se requiere titulo, nombre_archivo y archivo_url.' },
        { status: 400 }
      );
    }

    const tomo = await crearTomo({ titulo, nombre_archivo, archivo_url, carpeta_id });
    return NextResponse.json(tomo, { status: 201 });
  } catch (err: any) {
    const msg = err instanceof JurisprudenciaError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
