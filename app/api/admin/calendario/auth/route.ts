// ============================================================================
// GET /api/admin/calendario/auth
// Devuelve URL de autorización OAuth de Microsoft para Outlook
// ============================================================================

import { NextResponse } from 'next/server';
import { getOutlookAuthUrl, OutlookError } from '@/lib/services/outlook.service';

export async function GET() {
  try {
    const url = getOutlookAuthUrl();
    return NextResponse.json({ url });
  } catch (err) {
    const msg = err instanceof OutlookError ? err.message : 'Error al generar URL de autorización';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
