// ============================================================================
// POST /api/admin/mercantil/generar-acta-asamblea
// Genera DOCX de acta de asamblea (acta de libro)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { generarActaAsambleaDocx } from '@/lib/templates/acta-asamblea';
import type { DatosActaAsamblea } from '@/lib/templates/acta-asamblea';

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const datos: DatosActaAsamblea = await req.json();

    if (!datos.entidad?.trim()) {
      return NextResponse.json({ error: 'Se requiere el nombre de la entidad.' }, { status: 400 });
    }
    if (!datos.puntos || datos.puntos.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos un punto de agenda.' }, { status: 400 });
    }

    const buffer = await generarActaAsambleaDocx(datos);

    const filename = `Acta-${datos.numero_acta ?? 'SN'}-${datos.entidad.substring(0, 30).replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '-')}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('[Generar Acta Asamblea] Error:', error);
    return NextResponse.json(
      { error: error.message ?? 'Error al generar el acta.' },
      { status: 500 },
    );
  }
}
