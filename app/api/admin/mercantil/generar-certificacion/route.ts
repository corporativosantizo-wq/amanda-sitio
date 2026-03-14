// ============================================================================
// POST /api/admin/mercantil/generar-certificacion
// Genera DOCX de certificación de punto de acta (JSZip template approach)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { generarCertificacionDocx } from '@/lib/templates/certificacion-acta';
import type { DatosCertificacionActa } from '@/lib/templates/certificacion-acta';

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const datos: DatosCertificacionActa = await req.json();

    // Validations
    if (!datos.entidad?.trim()) {
      return NextResponse.json({ error: 'Se requiere el nombre de la entidad.' }, { status: 400 });
    }
    if (!datos.puntos_certificar || datos.puntos_certificar.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos un punto a certificar.' }, { status: 400 });
    }
    if (!datos.requirente?.nombre?.trim()) {
      return NextResponse.json({ error: 'Se requieren los datos del requirente.' }, { status: 400 });
    }

    const buffer = await generarCertificacionDocx(datos);

    const filename = `Certificacion-Acta-${datos.numero_acta ?? 'SN'}-${datos.entidad.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('[Generar Certificación] Error:', error);
    return NextResponse.json(
      { error: error.message ?? 'Error al generar la certificación.' },
      { status: 500 },
    );
  }
}
