// ============================================================================
// GET /api/public/agendar-token?token=...
// Valida el enlace personal de agendamiento por cotización.
//
// Respuesta deliberadamente MÍNIMA (el enlace puede reenviarse o filtrarse):
//   válido   → { valido: true, cliente_nombre }
//   inactivo → { valido: false, motivo: 'no_activo' }    (trámite concluido)
//   inválido → { valido: false, motivo: 'no_encontrado' }
// Nunca se devuelve monto, servicios, expediente ni correo del cliente.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { validarTokenAgendamiento } from '@/lib/services/agendamiento-token.service';

export const dynamic = 'force-dynamic';

// Rate limiting en memoria (patrón /api/cotizacion/respuesta).
const rateCounts = new Map<string, { count: number; resetAt: number }>();
function checkRate(ip: string): boolean {
  const now = Date.now();
  const entry = rateCounts.get(ip);
  if (!entry || entry.resetAt < now) {
    rateCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRate(ip)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }

  const token = req.nextUrl.searchParams.get('token') ?? '';
  const resultado = await validarTokenAgendamiento(token);

  if (!resultado.ok) {
    return NextResponse.json(
      { valido: false, motivo: resultado.motivo },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  return NextResponse.json(
    { valido: true, cliente_nombre: resultado.clienteNombre },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
