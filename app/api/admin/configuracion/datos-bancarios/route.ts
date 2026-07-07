// ============================================================================
// app/api/admin/configuracion/datos-bancarios/route.ts
// GET/PUT de los datos de transferencia Mercury Bank en legal.configuracion.
//
// Los valores los ingresa Amanda desde /admin/configuracion/datos-bancarios —
// nunca van en código ni en variables de entorno. Se devuelven también los
// datos de Banco Industrial (solo lectura) para mostrar contexto en la página.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/api-auth';
import { invalidarCacheConfiguracion } from '@/lib/services/configuracion.service';

const CAMPOS_MERCURY = [
  'mercury_beneficiario',
  'mercury_numero_cuenta',
  'mercury_routing',
  'mercury_swift',
  'mercury_banco_nombre',
  'mercury_banco_direccion',
] as const;

export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('configuracion')
      .select(`id, banco, numero_cuenta, cuenta_nombre, ${CAMPOS_MERCURY.join(', ')}, updated_at`)
      .limit(1)
      .single();

    if (error || !data) throw error ?? new Error('Sin fila de configuración');
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[Datos bancarios] GET:', err?.message ?? err);
    return NextResponse.json({ error: 'Error al leer la configuración' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await req.json();

    // Solo campos Mercury; strings recortados, vacío → null (oculta el recuadro).
    const cambios: Record<string, string | null> = {};
    for (const campo of CAMPOS_MERCURY) {
      if (!(campo in body)) continue;
      const valor = body[campo];
      if (valor !== null && typeof valor !== 'string') {
        return NextResponse.json({ error: `${campo} debe ser texto` }, { status: 400 });
      }
      cambios[campo] = valor?.trim() || null;
    }

    if (Object.keys(cambios).length === 0) {
      return NextResponse.json({ error: 'Sin campos que actualizar' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: fila, error: errFila } = await supabase
      .from('configuracion')
      .select('id')
      .limit(1)
      .single();
    if (errFila || !fila) throw errFila ?? new Error('Sin fila de configuración');

    const { data, error } = await supabase
      .from('configuracion')
      .update({ ...cambios, updated_at: new Date().toISOString() })
      .eq('id', fila.id)
      .select(`id, ${CAMPOS_MERCURY.join(', ')}, updated_at`)
      .single();

    if (error) throw error;

    // Que el próximo correo lea los datos frescos (cache de 60s por instancia).
    invalidarCacheConfiguracion();

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[Datos bancarios] PUT:', err?.message ?? err);
    return NextResponse.json({ error: 'Error al guardar la configuración' }, { status: 500 });
  }
}
