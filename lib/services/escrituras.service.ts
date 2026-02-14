// ============================================================================
// lib/services/escrituras.service.ts
// Lógica de negocio para escrituras públicas
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import type {
  Escritura,
  EscrituraInsert,
  EscrituraUpdate,
  EscrituraConRelaciones,
  EscrituraResumen,
  ProtocoloAnual,
  ReglaTimbres,
} from '@/lib/types';
import { EstadoEscritura, TipoInstrumento } from '@/lib/types';
import { numeroEscrituraTexto, calcularTimbreNotarial } from '@/lib/utils';

const db = () => createAdminClient();

// --- Tipos ---

interface ListParams {
  anio?: number;
  estado?: EstadoEscritura;
  tipo_instrumento?: TipoInstrumento;
  cliente_id?: string;
  page?: number;
  limit?: number;
  busqueda?: string;
}

// --- Protocolo Anual ---

export async function obtenerOCrearProtocolo(anio: number): Promise<ProtocoloAnual> {
  const { data } = await db()
    .from('protocolo_anual')
    .select('*')
    .eq('anio', anio)
    .single();

  if (data) return data as ProtocoloAnual;

  const { data: nuevo, error } = await db()
    .from('protocolo_anual')
    .insert({ anio, fecha_apertura: new Date().toISOString().split('T')[0] })
    .select()
    .single();

  if (error) throw new EscrituraError('Error al crear protocolo anual', error);
  return nuevo as ProtocoloAnual;
}

export async function siguienteNumero(anio?: number) {
  const a = anio ?? new Date().getFullYear();
  const { data, error } = await db().rpc('next_escritura_numero', { p_anio: a });

  if (error) throw new EscrituraError('Error al obtener siguiente número', error);

  const numero = data as number;
  return { numero, numero_texto: numeroEscrituraTexto(numero) };
}

// --- CRUD ---

export async function listarEscrituras(params: ListParams = {}) {
  const {
    anio = new Date().getFullYear(),
    estado, tipo_instrumento, cliente_id,
    page = 1, limit = 30, busqueda,
  } = params;
  const offset = (page - 1) * limit;

  const protocolo = await obtenerOCrearProtocolo(anio);

  let query = db()
    .from('escrituras')
    .select(`
      id, numero, numero_texto, fecha_autorizacion,
      tipo_instrumento, tipo_instrumento_texto,
      estado, descripcion, pdf_escritura_url,
      cliente:clientes!cliente_id (id, codigo, nombre)
    `, { count: 'exact' })
    .eq('protocolo_anual_id', protocolo.id)
    .order('numero', { ascending: false })
    .range(offset, offset + limit - 1);

  if (estado) query = query.eq('estado', estado);
  if (tipo_instrumento) query = query.eq('tipo_instrumento', tipo_instrumento);
  if (cliente_id) query = query.eq('cliente_id', cliente_id);
  if (busqueda) {
    query = query.or(
      `numero_texto.ilike.%${busqueda}%,tipo_instrumento_texto.ilike.%${busqueda}%`
    );
  }

  const { data, error, count } = await query;
  if (error) throw new EscrituraError('Error al listar escrituras', error);

  // Contar testimonios pendientes y docs (escritura_pdf/escritura_docx) por escritura
  const escrituraIds = (data ?? []).map((e: any) => e.id);
  let testimoniosPendientesPorEsc: Record<string, number> = {};
  const tieneEscrituraPdf: Set<string> = new Set();
  const tieneEscrituraDocx: Set<string> = new Set();

  if (escrituraIds.length > 0) {
    const [{ data: pendientes }, { data: docFiles }] = await Promise.all([
      db()
        .from('testimonios')
        .select('escritura_id')
        .in('escritura_id', escrituraIds)
        .neq('estado', 'entregado'),
      db()
        .from('escritura_documentos')
        .select('escritura_id, categoria')
        .in('escritura_id', escrituraIds)
        .in('categoria', ['escritura_pdf', 'escritura_docx']),
    ]);

    for (const t of pendientes ?? []) {
      testimoniosPendientesPorEsc[t.escritura_id] =
        (testimoniosPendientesPorEsc[t.escritura_id] ?? 0) + 1;
    }

    for (const d of docFiles ?? []) {
      if (d.categoria === 'escritura_pdf') tieneEscrituraPdf.add(d.escritura_id);
      if (d.categoria === 'escritura_docx') tieneEscrituraDocx.add(d.escritura_id);
    }
  }

  const resultado: EscrituraResumen[] = (data ?? []).map((esc: any) => ({
    id: esc.id,
    numero: esc.numero,
    numero_texto: esc.numero_texto,
    fecha_autorizacion: esc.fecha_autorizacion,
    tipo_instrumento: esc.tipo_instrumento,
    tipo_instrumento_texto: esc.tipo_instrumento_texto,
    estado: esc.estado,
    descripcion: esc.descripcion,
    pdf_escritura_url: esc.pdf_escritura_url,
    cliente_nombre: esc.cliente?.nombre ?? null,
    testimonios_pendientes: testimoniosPendientesPorEsc[esc.id] ?? 0,
    tiene_escritura_pdf: tieneEscrituraPdf.has(esc.id),
    tiene_escritura_docx: tieneEscrituraDocx.has(esc.id),
  }));

  return {
    data: resultado,
    protocolo,
    total: count ?? 0,
    page, limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

export async function obtenerEscritura(id: string): Promise<EscrituraConRelaciones> {
  const { data, error } = await db()
    .from('escrituras')
    .select(`
      *,
      cliente:clientes!cliente_id (id, codigo, nombre, nit, dpi),
      protocolo:protocolo_anual!protocolo_anual_id (id, anio),
      testimonios (*)
    `)
    .eq('id', id)
    .single();

  if (error || !data) throw new EscrituraError('Escritura no encontrada', error);
  return data as unknown as EscrituraConRelaciones;
}

export async function crearEscritura(input: EscrituraInsert): Promise<Escritura> {
  const fecha = new Date(input.fecha_autorizacion + 'T12:00:00');
  const anio = fecha.getFullYear();
  const protocolo = await obtenerOCrearProtocolo(anio);

  // Calcular timbres
  const timbres = await calcularTimbresEscritura(
    input.tipo_instrumento,
    input.valor_acto ?? null,
    input.hojas_protocolo ?? 0
  );

  // numero=0 hace que el trigger auto-asigne
  const { data, error } = await db()
    .from('escrituras')
    .insert({
      protocolo_anual_id: protocolo.id,
      cliente_id: input.cliente_id ?? null,
      expediente_id: input.expediente_id ?? null,
      cotizacion_id: input.cotizacion_id ?? null,

      numero: input.numero ?? 0,
      numero_texto: input.numero_texto ?? '',
      fecha_autorizacion: input.fecha_autorizacion,
      lugar_autorizacion: input.lugar_autorizacion,
      departamento: input.departamento,

      tipo_instrumento: input.tipo_instrumento,
      tipo_instrumento_texto: input.tipo_instrumento_texto,
      descripcion: input.descripcion ?? null,
      estado: input.estado ?? EstadoEscritura.BORRADOR,

      comparecientes: input.comparecientes,
      objeto_acto: input.objeto_acto ?? null,
      valor_acto: input.valor_acto ?? null,

      hojas_protocolo: input.hojas_protocolo ?? null,
      hojas_fotocopia: input.hojas_fotocopia ?? null,

      timbre_notarial: timbres.timbre_notarial,
      timbres_fiscales: timbres.timbres_fiscales,
      timbre_razon: timbres.timbre_razon,
      timbres_auto_calculados: true,
      timbres_notas: timbres.notas,

      notas: input.notas ?? null,
    })
    .select()
    .single();

  if (error) throw new EscrituraError('Error al crear escritura', error);

  // Si el trigger auto-asignó número, generar numero_texto
  const escritura = data as Escritura;
  if (!input.numero_texto && escritura.numero > 0) {
    const texto = numeroEscrituraTexto(escritura.numero);
    await db()
      .from('escrituras')
      .update({ numero_texto: texto })
      .eq('id', escritura.id);
    escritura.numero_texto = texto;
  }

  return escritura;
}

export async function actualizarEscritura(
  id: string,
  input: EscrituraUpdate
): Promise<Escritura> {
  const actual = await obtenerEscritura(id);
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // Campos editables solo en borrador
  if (actual.estado === EstadoEscritura.BORRADOR) {
    const camposBorrador = [
      'descripcion', 'comparecientes', 'objeto_acto', 'valor_acto',
      'hojas_protocolo', 'hojas_fotocopia',
    ] as const;
    for (const campo of camposBorrador) {
      if (input[campo] !== undefined) updates[campo] = input[campo];
    }
  }

  // Campos editables siempre
  if (input.timbre_notarial !== undefined) {
    updates.timbre_notarial = input.timbre_notarial;
    updates.timbres_auto_calculados = false;
  }
  if (input.timbres_fiscales !== undefined) {
    updates.timbres_fiscales = input.timbres_fiscales;
    updates.timbres_auto_calculados = false;
  }
  if (input.timbre_razon !== undefined) {
    updates.timbre_razon = input.timbre_razon;
    updates.timbres_auto_calculados = false;
  }
  if (input.timbres_notas !== undefined) updates.timbres_notas = input.timbres_notas;
  if (input.arancel_registro !== undefined) updates.arancel_registro = input.arancel_registro;
  if (input.impuestos_aplicables !== undefined) updates.impuestos_aplicables = input.impuestos_aplicables;
  if (input.factura_id !== undefined) updates.factura_id = input.factura_id;
  if (input.notas !== undefined) updates.notas = input.notas;

  // Cambio de estado
  if (input.estado && input.estado !== actual.estado) {
    validarTransicion(actual.estado, input.estado);
    updates.estado = input.estado;
  }

  const { data, error } = await db()
    .from('escrituras')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new EscrituraError('Error al actualizar escritura', error);
  return data as Escritura;
}

// --- Acciones ---

export async function autorizarEscritura(id: string): Promise<Escritura> {
  const actual = await obtenerEscritura(id);

  if (actual.estado !== EstadoEscritura.BORRADOR) {
    throw new EscrituraError('Solo se pueden autorizar escrituras en estado borrador');
  }

  if (!actual.comparecientes || actual.comparecientes.length === 0) {
    throw new EscrituraError('Se requiere al menos un compareciente para autorizar');
  }

  const { data, error } = await db()
    .from('escrituras')
    .update({
      estado: EstadoEscritura.AUTORIZADA,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new EscrituraError('Error al autorizar escritura', error);
  return data as Escritura;
}

export async function cancelarEscritura(id: string, motivo?: string): Promise<Escritura> {
  const actual = await obtenerEscritura(id);

  if (actual.estado === EstadoEscritura.CANCELADA) {
    throw new EscrituraError('La escritura ya está cancelada');
  }

  const notas = motivo
    ? `${actual.notas ?? ''}\n[CANCELADA] ${motivo}`.trim()
    : actual.notas;

  const { data, error } = await db()
    .from('escrituras')
    .update({
      estado: EstadoEscritura.CANCELADA,
      notas,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new EscrituraError('Error al cancelar escritura', error);
  return data as Escritura;
}

// --- Upload PDF ---

export async function subirPDFEscritura(
  id: string,
  archivo: { url: string; nombre: string; tamano: number }
): Promise<Escritura> {
  const actual = await obtenerEscritura(id);

  if (actual.estado === EstadoEscritura.BORRADOR) {
    throw new EscrituraError('Primero autoriza la escritura antes de subir el PDF');
  }
  if (actual.estado === EstadoEscritura.CANCELADA) {
    throw new EscrituraError('No se puede subir PDF de una escritura cancelada');
  }

  // El trigger trg_escritura_pdf_subido auto-cambia estado a 'escaneada'
  const { data, error } = await db()
    .from('escrituras')
    .update({
      pdf_escritura_url: archivo.url,
      pdf_nombre_archivo: archivo.nombre,
      pdf_tamano_bytes: archivo.tamano,
      pdf_verificado: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new EscrituraError('Error al registrar PDF', error);
  return data as Escritura;
}

export async function verificarPDFEscritura(
  id: string,
  verificado: boolean,
  notas?: string
): Promise<Escritura> {
  const updates: Record<string, unknown> = {
    pdf_verificado: verificado,
    updated_at: new Date().toISOString(),
  };
  if (notas !== undefined) updates.pdf_notas = notas;

  const { data, error } = await db()
    .from('escrituras')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new EscrituraError('Error al verificar PDF', error);
  return data as Escritura;
}

// --- Dashboard ---

export async function dashboardProtocolo(anio?: number) {
  const a = anio ?? new Date().getFullYear();

  const protocolo = await obtenerOCrearProtocolo(a);

  // IDs de escrituras de este protocolo
  const { data: escrituraIds } = await db()
    .from('escrituras')
    .select('id')
    .eq('protocolo_anual_id', protocolo.id);

  const ids = (escrituraIds ?? []).map((e: any) => e.id);

  let primerPendientes = 0;
  let especialPendientes = 0;
  let sinPDF = 0;

  if (ids.length > 0) {
    const { count: pp } = await db()
      .from('testimonios')
      .select('id', { count: 'exact', head: true })
      .eq('tipo', 'primer_testimonio')
      .neq('estado', 'entregado')
      .in('escritura_id', ids);
    primerPendientes = pp ?? 0;

    const { count: ep } = await db()
      .from('testimonios')
      .select('id', { count: 'exact', head: true })
      .eq('tipo', 'testimonio_especial')
      .neq('estado', 'entregado')
      .in('escritura_id', ids);
    especialPendientes = ep ?? 0;

    const { count: sp } = await db()
      .from('escrituras')
      .select('id', { count: 'exact', head: true })
      .eq('protocolo_anual_id', protocolo.id)
      .eq('estado', 'autorizada')
      .is('pdf_escritura_url', null);
    sinPDF = sp ?? 0;
  }

  // Próximo aviso
  const { data: proximoAviso } = await db()
    .from('avisos_trimestrales')
    .select('trimestre, estado, fecha_limite_envio')
    .eq('anio', a)
    .in('estado', ['borrador', 'generado'])
    .order('trimestre', { ascending: true })
    .limit(1)
    .single();

  return {
    anio: a,
    protocolo,
    testimonios_primer_pendientes: primerPendientes,
    testimonios_especial_pendientes: especialPendientes,
    escrituras_sin_pdf: sinPDF,
    proximo_aviso: proximoAviso ?? null,
  };
}

// --- Helpers internos ---

async function calcularTimbresEscritura(
  tipo: TipoInstrumento,
  valorActo: number | null,
  hojasProtocolo: number
) {
  const { data: regla } = await db()
    .from('reglas_timbres')
    .select('*')
    .eq('tipo_instrumento', tipo)
    .eq('activo', true)
    .limit(1)
    .single();

  const r = regla as ReglaTimbres | null;
  const timbreNotarial = calcularTimbreNotarial(hojasProtocolo);
  let timbresFiscales = 0;
  const timbreRazon = 0.50;
  let notas = '';

  if (r) {
    if (r.exento) {
      notas = 'Exento de timbres fiscales';
    } else if (r.base_calculo === 'fijo') {
      timbresFiscales = r.timbre_fijo ?? 0;
    } else if (r.timbre_porcentaje && valorActo) {
      timbresFiscales = Math.round(valorActo * r.timbre_porcentaje * 100) / 100;
      notas = `${(r.timbre_porcentaje * 100).toFixed(1)}% sobre Q${valorActo}`;
    }
  } else {
    notas = 'Sin regla específica. Verificar manualmente.';
  }

  return {
    timbre_notarial: timbreNotarial,
    timbres_fiscales: timbresFiscales,
    timbre_razon: timbreRazon,
    notas,
  };
}

function validarTransicion(actual: EstadoEscritura, nuevo: EstadoEscritura) {
  const validas: Record<EstadoEscritura, EstadoEscritura[]> = {
    [EstadoEscritura.BORRADOR]: [EstadoEscritura.AUTORIZADA, EstadoEscritura.CANCELADA],
    [EstadoEscritura.AUTORIZADA]: [EstadoEscritura.ESCANEADA, EstadoEscritura.CANCELADA],
    [EstadoEscritura.ESCANEADA]: [EstadoEscritura.CON_TESTIMONIO, EstadoEscritura.CANCELADA],
    [EstadoEscritura.CON_TESTIMONIO]: [EstadoEscritura.CANCELADA],
    [EstadoEscritura.CANCELADA]: [],
  };

  if (!validas[actual]?.includes(nuevo)) {
    throw new EscrituraError(
      `No se puede pasar de "${actual}" a "${nuevo}". ` +
      `Válidas: ${validas[actual]?.join(', ') || 'ninguna'}`
    );
  }
}

// --- Error ---

export class EscrituraError extends Error {
  public details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'EscrituraError';
    this.details = details;
  }
}
