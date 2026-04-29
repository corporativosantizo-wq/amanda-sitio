// ============================================================================
// GET /api/admin/comunicaciones/lookup
//   ?table=<source>            (requerido, whitelist)
//   &q=<texto>                 (requerido, ilike sobre search_columns)
//   &limit=<n>                 (opcional, max 50, default 20)
//   &cliente_id=<uuid>         (opcional — filtra por cliente, requiere uuid válido)
//
// Endpoint para autocomplete de campos type:'lookup' en plantillas de correo.
//
// SEGURIDAD: las plantillas guardadas en BD solo pueden referenciar las tablas
// listadas en LOOKUP_CONFIG. Las columnas SQL nunca vienen del JSON — están fijas
// server-side por tabla. Esto evita que un admin malicioso (o un row mal armado)
// pueda leer columnas no intencionadas de cualquier tabla.
//
// Whitelist actual: cotizaciones, expedientes, cobros, facturas (todas con cliente_id).
// Cualquier otra tabla → 400. UUID mal formado → 400.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { pgrstQuote } from '@/lib/utils/postgrest';
import type { LookupSource, LookupResult } from '@/lib/types/plantillas-correo';

interface LookupTableConfig {
  /** Columnas sobre las que se hace ilike con el query del usuario. */
  search_columns: string[];
  /**
   * Alias dentro de `fields` cuyo valor se entrega como `value` en el resultado.
   * Es lo que termina en `camposExtra[campo.key]` cuando el usuario selecciona.
   */
  value_alias: string;
  /** PostgREST select string (incluye embeds para FKs como cliente). */
  select: string;
  /** Construye el string que ve el usuario en cada opción del dropdown. */
  display: (row: any) => string;
  /**
   * Alias semántico → extractor del row. Solo estos alias pueden referenciarse
   * desde `populates` en una plantilla.
   */
  fields: Record<string, (row: any) => any>;
}

const fmtQ = (n: number | null | undefined): string =>
  typeof n === 'number'
    ? `Q${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
    : '';

const LOOKUP_CONFIG: Record<LookupSource, LookupTableConfig> = {
  cotizaciones: {
    // legal.cotizaciones NO tiene columna `asunto` — el "asunto" semántico vive
    // en el primer item de cotizacion_items (la descripción del servicio principal).
    // search_columns queda solo con `numero` porque buscar dentro de embedded
    // resources via PostgREST es engorroso; el caso real es buscar por COT-XXX.
    search_columns: ['numero'],
    value_alias: 'numero',
    select:
      'id, numero, total, fecha_emision, ' +
      'items:cotizacion_items!cotizacion_id(descripcion, orden), ' +
      'cliente:clientes!cliente_id(id, nombre, email, nit)',
    display: (r) => {
      const items = (r.items ?? []) as Array<{ descripcion: string | null; orden: number | null }>;
      const sorted = [...items].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
      const primer = sorted[0]?.descripcion?.trim() || null;
      return `${r.numero} — ${primer ?? '(sin items)'}` +
        (typeof r.total === 'number' ? ` · ${fmtQ(r.total)}` : '');
    },
    fields: {
      numero: (r) => r.numero,
      asunto: (r) => {
        const items = (r.items ?? []) as Array<{ descripcion: string | null; orden: number | null }>;
        if (!items.length) return null;
        const sorted = [...items].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
        return sorted[0]?.descripcion?.trim() ?? null;
      },
      total: (r) => r.total,
      fecha_emision: (r) => r.fecha_emision,
      cliente_id: (r) => r.cliente?.id ?? null,
      cliente_nombre: (r) => r.cliente?.nombre ?? null,
      cliente_email: (r) => r.cliente?.email ?? null,
      cliente_nit: (r) => r.cliente?.nit ?? null,
    },
  },

  expedientes: {
    search_columns: [
      'numero_expediente',
      'numero_mp',
      'numero_administrativo',
      'descripcion',
      'actor',
      'demandado',
    ],
    value_alias: 'numero',
    select:
      'id, numero_expediente, numero_mp, numero_administrativo, ' +
      'tipo_proceso, fase_actual, descripcion, tribunal_nombre, fiscalia, ' +
      'entidad_administrativa, ' +
      'cliente:clientes!expedientes_cliente_id_fkey(id, nombre, email, nit)',
    display: (r) => {
      const num = r.numero_expediente ?? r.numero_mp ?? r.numero_administrativo ?? 'S/N';
      const tail = r.descripcion ?? r.tipo_proceso ?? '';
      return tail ? `${num} — ${tail}` : num;
    },
    fields: {
      numero: (r) =>
        r.numero_expediente ?? r.numero_mp ?? r.numero_administrativo ?? null,
      numero_expediente: (r) => r.numero_expediente,
      numero_mp: (r) => r.numero_mp,
      numero_administrativo: (r) => r.numero_administrativo,
      tipo_proceso: (r) => r.tipo_proceso,
      fase_actual: (r) => r.fase_actual,
      descripcion: (r) => r.descripcion,
      tribunal: (r) => r.tribunal_nombre,
      fiscalia: (r) => r.fiscalia,
      entidad_administrativa: (r) => r.entidad_administrativa,
      cliente_id: (r) => r.cliente?.id ?? null,
      cliente_nombre: (r) => r.cliente?.nombre ?? null,
      cliente_email: (r) => r.cliente?.email ?? null,
      cliente_nit: (r) => r.cliente?.nit ?? null,
    },
  },

  cobros: {
    search_columns: ['concepto', 'descripcion'],
    value_alias: 'numero_cobro',
    select:
      'id, numero_cobro, concepto, descripcion, monto, saldo_pendiente, ' +
      'fecha_emision, fecha_vencimiento, ' +
      'cliente:clientes!cliente_id(id, nombre, email, nit)',
    display: (r) => {
      const num = r.numero_cobro != null
        ? `COB-${String(r.numero_cobro).padStart(3, '0')}`
        : 'COB-???';
      const monto = typeof r.monto === 'number' ? ` · ${fmtQ(r.monto)}` : '';
      return `${num} — ${r.concepto ?? ''}${monto}`;
    },
    fields: {
      numero_cobro: (r) =>
        r.numero_cobro != null ? `COB-${String(r.numero_cobro).padStart(3, '0')}` : null,
      concepto: (r) => r.concepto,
      descripcion: (r) => r.descripcion,
      monto: (r) => r.monto,
      saldo_pendiente: (r) => r.saldo_pendiente,
      fecha_emision: (r) => r.fecha_emision,
      fecha_vencimiento: (r) => r.fecha_vencimiento,
      cliente_id: (r) => r.cliente?.id ?? null,
      cliente_nombre: (r) => r.cliente?.nombre ?? null,
      cliente_email: (r) => r.cliente?.email ?? null,
      cliente_nit: (r) => r.cliente?.nit ?? null,
    },
  },

  facturas: {
    search_columns: ['numero', 'razon_social'],
    value_alias: 'numero',
    select:
      'id, numero, razon_social, nit, total, monto_a_recibir, ' +
      'fecha_emision, fecha_vencimiento, ' +
      'cliente:clientes!cliente_id(id, nombre, email)',
    display: (r) => {
      const total = typeof r.total === 'number' ? ` · ${fmtQ(r.total)}` : '';
      return `${r.numero ?? ''} — ${r.razon_social ?? ''}${total}`.trim();
    },
    fields: {
      numero: (r) => r.numero,
      razon_social: (r) => r.razon_social,
      nit: (r) => r.nit,
      total: (r) => r.total,
      monto_a_recibir: (r) => r.monto_a_recibir,
      fecha_emision: (r) => r.fecha_emision,
      fecha_vencimiento: (r) => r.fecha_vencimiento,
      cliente_id: (r) => r.cliente?.id ?? null,
      cliente_nombre: (r) => r.cliente?.nombre ?? null,
      cliente_email: (r) => r.cliente?.email ?? null,
      // OJO: en facturas el NIT puede diferir del NIT del cliente registrado
      // (la factura puede ir a nombre de un tercero). Por eso este alias se
      // llama nit_facturacion y no cliente_nit — para evitar que una plantilla
      // que mapea {nit} desde facturas asuma que es el del cliente.
      // Las otras 3 tablas (cotizaciones, expedientes, cobros) sí exponen
      // cliente_nit porque vienen literal de legal.clientes.nit.
      nit_facturacion: (r) => r.nit,
    },
  },
};

// ── Handler ────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const sp = req.nextUrl.searchParams;
  const table = sp.get('table') ?? '';
  const q = (sp.get('q') ?? '').trim();
  const limitRaw = parseInt(sp.get('limit') ?? '20', 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 20;
  const clienteIdRaw = sp.get('cliente_id')?.trim() || null;

  if (!(table in LOOKUP_CONFIG)) {
    return NextResponse.json(
      {
        error: 'Tabla no permitida',
        whitelist: Object.keys(LOOKUP_CONFIG),
      },
      { status: 400 },
    );
  }

  // Validar uuid si vino. Defensa explícita antes de tocar PostgREST — mejor
  // mensaje de error nuestro, y evita pasar valor mal formado al filtro.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (clienteIdRaw && !UUID_RE.test(clienteIdRaw)) {
    return NextResponse.json(
      { error: 'cliente_id no es un UUID válido' },
      { status: 400 },
    );
  }
  const clienteId = clienteIdRaw;

  const config = LOOKUP_CONFIG[table as LookupSource];

  if (!q) {
    return NextResponse.json({ data: [] satisfies LookupResult[] });
  }

  const db = createAdminClient();
  const v = pgrstQuote(`%${q}%`);
  const orFilter = config.search_columns.map((c) => `${c}.ilike.${v}`).join(',');

  let query = db.from(table).select(config.select).or(orFilter);
  if (clienteId) {
    // Las 4 tablas de la whitelist tienen columna cliente_id (verificado vía
    // information_schema). Si en el futuro se agrega una tabla sin cliente_id,
    // habría que mover este filtro a config.scope_by_cliente: boolean.
    query = query.eq('cliente_id', clienteId);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    console.error('[comunicaciones/lookup]', table, error.message ?? error);
    return NextResponse.json({ error: 'Error al buscar' }, { status: 500 });
  }

  const results: LookupResult[] = (data ?? []).map((row: any) => {
    const populated_data: Record<string, any> = {};
    for (const [alias, extract] of Object.entries(config.fields)) {
      populated_data[alias] = extract(row);
    }
    const value = populated_data[config.value_alias];
    return {
      value: value == null ? '' : String(value),
      display: config.display(row),
      populated_data,
    };
  });

  return NextResponse.json({ data: results });
}
