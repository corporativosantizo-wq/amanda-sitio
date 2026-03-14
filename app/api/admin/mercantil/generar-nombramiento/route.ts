// ============================================================================
// POST /api/admin/mercantil/generar-nombramiento
// Genera DOCX de acta notarial de nombramiento (JSZip template approach)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { generarNombramientoDocx } from '@/lib/templates/nombramiento';
import type { DatosNombramiento } from '@/lib/templates/nombramiento';

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const datos: DatosNombramiento = await req.json();

    if (!datos.entidad?.trim()) {
      return NextResponse.json({ error: 'Se requiere el nombre de la entidad.' }, { status: 400 });
    }
    if (!datos.requirente?.nombre?.trim()) {
      return NextResponse.json({ error: 'Se requieren los datos del requirente.' }, { status: 400 });
    }
    if (!datos.cargo_nombrado?.trim() || !datos.nombre_nombrado?.trim()) {
      return NextResponse.json({ error: 'Se requieren los datos del nombramiento.' }, { status: 400 });
    }

    const buffer = await generarNombramientoDocx(datos);

    const filename = `Nombramiento-${datos.cargo_nombrado.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '-')}-${datos.entidad.substring(0, 25).replace(/[^a-zA-Z0-9]/g, '-')}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('[Generar Nombramiento] Error:', error);
    return NextResponse.json(
      { error: error.message ?? 'Error al generar el nombramiento.' },
      { status: 500 },
    );
  }
}
