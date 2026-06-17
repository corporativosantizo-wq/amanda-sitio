// ============================================================================
// /api/admin/molly/salientes/[id]
// PATCH  — editar un borrador (subject, body, to, cc)
// DELETE — cancelar (status='cancelado', no borra físicamente)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import {
  editarSaliente,
  cancelarSaliente,
  SalienteError,
} from '@/lib/services/salientes.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const body = await req.json();
    const data = await editarSaliente(id, {
      subject: body.subject,
      body_text: body.body_text,
      body_html: body.body_html,
      to_emails: body.to_emails,
      cc_emails: body.cc_emails,
      // Solo se toca si la clave viene en el body (null = desprogramar).
      programado_para: 'programado_para' in body ? body.programado_para : undefined,
    });
    return NextResponse.json({ data });
  } catch (err) {
    const msg = err instanceof SalienteError ? err.message : 'Error al editar borrador saliente';
    const status = err instanceof SalienteError ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const data = await cancelarSaliente(id);
    return NextResponse.json({ data });
  } catch (err) {
    const msg = err instanceof SalienteError ? err.message : 'Error al cancelar borrador saliente';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
