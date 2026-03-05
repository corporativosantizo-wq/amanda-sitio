// ============================================================================
// app/api/admin/notariado/indice/route.ts
// GET — Escrituras con datos completos para el índice del protocolo
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const anio = parseInt(request.nextUrl.searchParams.get('anio') ?? String(new Date().getFullYear()));

    const db = createAdminClient();

    // Get protocolo for the year
    const { data: protocolo } = await db
      .from('protocolo_anual')
      .select('id')
      .eq('anio', anio)
      .single();

    if (!protocolo) {
      return NextResponse.json({ data: [], protocolo: null });
    }

    // Get all escrituras with full data
    const { data: escrituras, error } = await db
      .from('escrituras')
      .select('id, numero, numero_texto, fecha_autorizacion, lugar_autorizacion, departamento, tipo_instrumento_texto, estado, comparecientes, hojas_protocolo')
      .eq('protocolo_anual_id', protocolo.id)
      .order('numero', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ data: escrituras ?? [], protocolo: { id: protocolo.id, anio } });
  } catch (err: any) {
    console.error('Error fetching indice:', err);
    return NextResponse.json({ error: 'Error al obtener índice' }, { status: 500 });
  }
}
