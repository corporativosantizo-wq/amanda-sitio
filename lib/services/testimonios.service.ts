// ============================================================================
// lib/services/testimonios.service.ts
// Lógica de negocio para testimonios
// (Los borradores se crean automáticamente por trigger en DB)
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import type {
  Testimonio,
  TestimonioUpdate,
  TestimonioConEscritura,
  PlantillaRazon,
  PlantillaVariables,
} from '@/lib/types';
import {
  EstadoTestimonio,
  TipoTestimonio,
  TipoInstrumento,
} from '@/lib/types';
import {
  fechaATextoLegal,
  hojasTexto,
} from '@/lib/utils';

const db = () => createAdminClient();

// --- Tipos ---

interface ListParams {
  escritura_id?: string;
  tipo?: TipoTestimonio;
  estado?: EstadoTestimonio;
  pendientes_solo?: boolean;
  page?: number;
  limit?: number;
}

// --- CRUD ---

/**
 * Lista testimonios con filtros.
 * Incluye datos de escritura y cliente para contexto.
 */
export async function listarTestimonios(params: ListParams = {}) {
  const {
    escritura_id, tipo, estado, pendientes_solo,
    page = 1, limit = 30,
  } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('testimonios')
    .select(`
      *,
      escritura:escrituras!escritura_id (
        id, numero, numero_texto, fecha_autorizacion,
        lugar_autorizacion, departamento,
        tipo_instrumento, tipo_instrumento_texto,
        estado, pdf_escritura_url,
        cliente:clientes!cliente_id (nombre)
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (escritura_id) query = query.eq('escritura_id', escritura_id);
  if (tipo) query = query.eq('tipo', tipo);
  if (estado) query = query.eq('estado', estado);
  if (pendientes_solo) query = query.neq('estado', 'entregado');

  const { data, error, count } = await query;
  if (error) throw new TestimonioError('Error al listar testimonios', error);

  // Aplanar cliente_nombre
  const resultado = (data ?? []).map((t: any) => ({
    ...t,
    cliente_nombre: t.escritura?.cliente?.nombre ?? null,
    escritura: {
      ...t.escritura,
      cliente: undefined,  // Quitar el anidado
    },
  })) as TestimonioConEscritura[];

  return {
    data: resultado,
    total: count ?? 0,
    page, limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

/**
 * Obtiene un testimonio por ID con datos de escritura.
 */
export async function obtenerTestimonio(id: string): Promise<TestimonioConEscritura> {
  const { data, error } = await db()
    .from('testimonios')
    .select(`
      *,
      escritura:escrituras!escritura_id (
        id, numero, numero_texto, fecha_autorizacion,
        lugar_autorizacion, departamento,
        tipo_instrumento, tipo_instrumento_texto,
        estado, pdf_escritura_url,
        cliente:clientes!cliente_id (nombre)
      )
    `)
    .eq('id', id)
    .single();

  if (error || !data) throw new TestimonioError('Testimonio no encontrado', error);

  return {
    ...data,
    cliente_nombre: (data as any).escritura?.cliente?.nombre ?? null,
  } as unknown as TestimonioConEscritura;
}

/**
 * Actualiza un testimonio (texto, hojas, timbres, estado, etc.).
 */
export async function actualizarTestimonio(
  id: string,
  input: TestimonioUpdate
): Promise<Testimonio> {
  const actual = await obtenerTestimonio(id);

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // Texto de la razón
  if (input.texto_razon !== undefined) {
    updates.texto_razon = input.texto_razon;
    updates.texto_editado = true;
  }

  // Datos del testimonio
  if (input.destinatario !== undefined) updates.destinatario = input.destinatario;
  if (input.hojas_fotocopia !== undefined) updates.hojas_fotocopia = input.hojas_fotocopia;
  if (input.hojas_detalle !== undefined) updates.hojas_detalle = input.hojas_detalle;
  if (input.timbre_razon !== undefined) updates.timbre_razon = input.timbre_razon;
  if (input.timbres_adicionales !== undefined) updates.timbres_adicionales = input.timbres_adicionales;
  if (input.timbre_notas !== undefined) updates.timbre_notas = input.timbre_notas;
  if (input.fecha_emision !== undefined) updates.fecha_emision = input.fecha_emision;
  if (input.fecha_entrega !== undefined) updates.fecha_entrega = input.fecha_entrega;
  if (input.notas !== undefined) updates.notas = input.notas;

  // Cambio de estado
  if (input.estado && input.estado !== actual.estado) {
    validarTransicion(actual.estado, input.estado, actual);
    updates.estado = input.estado;

    // Auto-setear fechas al cambiar estado
    if (input.estado === EstadoTestimonio.GENERADO) {
      updates.fecha_emision = updates.fecha_emision ?? new Date().toISOString().split('T')[0];
    }
    if (input.estado === EstadoTestimonio.ENTREGADO) {
      updates.fecha_entrega = updates.fecha_entrega ?? new Date().toISOString().split('T')[0];
    }
  }

  const { data, error } = await db()
    .from('testimonios')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new TestimonioError('Error al actualizar testimonio', error);
  return data as Testimonio;
}

// --- Acciones de Estado ---

/**
 * Marca testimonio como generado (PDF listo para imprimir).
 * Requiere que la escritura tenga PDF escaneado subido.
 */
export async function generarTestimonio(id: string): Promise<Testimonio> {
  // El trigger trg_testimonio_requiere_pdf valida que exista el PDF
  return actualizarTestimonio(id, {
    estado: EstadoTestimonio.GENERADO,
  });
}

/**
 * Marca testimonio como firmado (ya lo firmaste físicamente).
 */
export async function firmarTestimonio(id: string): Promise<Testimonio> {
  return actualizarTestimonio(id, {
    estado: EstadoTestimonio.FIRMADO,
  });
}

/**
 * Marca testimonio como entregado.
 * El trigger trg_testimonio_entregado avanza la escritura a 'con_testimonio'.
 */
export async function entregarTestimonio(
  id: string,
  fechaEntrega?: string
): Promise<Testimonio> {
  return actualizarTestimonio(id, {
    estado: EstadoTestimonio.ENTREGADO,
    fecha_entrega: fechaEntrega,
  });
}

// --- Regenerar texto de razón ---

/**
 * Re-genera el texto de razón desde la plantilla (sobrescribe ediciones manuales).
 */
export async function regenerarTextoRazon(id: string): Promise<Testimonio> {
  const testimonio = await obtenerTestimonio(id);
  const escritura = testimonio.escritura;

  // Obtener configuración
  const { data: config } = await db()
    .from('configuracion')
    .select('*')
    .limit(1)
    .single();

  if (!config) throw new TestimonioError('Configuración no encontrada');

  // Buscar plantilla
  const plantilla = await buscarPlantilla(
    escritura.tipo_instrumento,
    testimonio.tipo
  );

  if (!plantilla) {
    throw new TestimonioError(
      `No se encontró plantilla para ${escritura.tipo_instrumento} / ${testimonio.tipo}`
    );
  }

  // Construir variables
  const variables: PlantillaVariables = {
    tipo_testimonio_texto: testimonio.tipo === TipoTestimonio.PRIMER_TESTIMONIO
      ? 'ES TESTIMONIO'
      : testimonio.tipo === TipoTestimonio.TESTIMONIO_ESPECIAL
      ? 'ES TESTIMONIO ESPECIAL'
      : 'ES TESTIMONIO',
    numero_texto: escritura.numero_texto,
    lugar_autorizacion: escritura.lugar_autorizacion,
    departamento: escritura.departamento,
    fecha_autorizacion_texto: fechaATextoLegal(escritura.fecha_autorizacion),
    destinatario: testimonio.destinatario,
    articulo_codigo: testimonio.articulo_codigo ?? '77',
    literal_codigo: testimonio.literal_codigo ?? 'b',
    hojas_texto: testimonio.hojas_fotocopia
      ? hojasTexto(testimonio.hojas_fotocopia)
      : 'las hojas',
    hojas_protocolo_texto: '', // Se llena manualmente
    hojas_detalle: testimonio.hojas_detalle ?? '',
    tipo_acto_texto: escritura.tipo_instrumento_texto,
    objeto_acto: '', // Desde escritura.objeto_acto
    timbre_texto: '', // Desde reglas de timbres
    fecha_emision_texto: fechaATextoLegal(
      testimonio.fecha_emision ?? new Date().toISOString().split('T')[0]
    ),
    lugar_emision: escritura.lugar_autorizacion,
    notario_nombre: config.abogada_principal ?? '',
  };

  // Renderizar plantilla (reemplazo de Handlebars)
  const textoGenerado = renderizarPlantilla(plantilla.plantilla, variables);

  const { data, error } = await db()
    .from('testimonios')
    .update({
      texto_razon: textoGenerado,
      texto_editado: false,
      plantilla_id: plantilla.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new TestimonioError('Error al regenerar texto', error);
  return data as Testimonio;
}

// --- Resumen para dashboard ---

export async function resumenTestimonios() {
  const [primerPend, especialPend, generados, entregadosMes] = await Promise.all([
    db()
      .from('testimonios')
      .select('id', { count: 'exact', head: true })
      .eq('tipo', 'primer_testimonio')
      .neq('estado', 'entregado'),
    db()
      .from('testimonios')
      .select('id', { count: 'exact', head: true })
      .eq('tipo', 'testimonio_especial')
      .neq('estado', 'entregado'),
    db()
      .from('testimonios')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'generado'),
    db()
      .from('testimonios')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'entregado')
      .gte('fecha_entrega', new Date().toISOString().slice(0, 7) + '-01'),
  ]);

  return {
    primer_pendientes: primerPend.count ?? 0,
    especial_pendientes: especialPend.count ?? 0,
    generados_por_firmar: generados.count ?? 0,
    entregados_este_mes: entregadosMes.count ?? 0,
  };
}

// --- Helpers internos ---

async function buscarPlantilla(
  tipoInstrumento: TipoInstrumento,
  tipoTestimonio: TipoTestimonio
): Promise<PlantillaRazon | null> {
  // Buscar plantilla específica
  const { data: especifica } = await db()
    .from('plantillas_razon')
    .select('*')
    .eq('tipo_instrumento', tipoInstrumento)
    .eq('tipo_testimonio', tipoTestimonio)
    .eq('activo', true)
    .limit(1)
    .single();

  if (especifica) return especifica as PlantillaRazon;

  // Buscar plantilla default para este tipo de testimonio
  const { data: defaultPlantilla } = await db()
    .from('plantillas_razon')
    .select('*')
    .eq('tipo_testimonio', tipoTestimonio)
    .eq('es_default', true)
    .eq('activo', true)
    .limit(1)
    .single();

  return (defaultPlantilla as PlantillaRazon) ?? null;
}

function renderizarPlantilla(
  plantilla: string,
  variables: PlantillaVariables
): string {
  let texto = plantilla;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    texto = texto.replace(regex, value ?? '');
  }

  // Limpiar variables no reemplazadas
  texto = texto.replace(/\{\{[^}]+\}\}/g, '');

  return texto;
}

function validarTransicion(
  actual: EstadoTestimonio,
  nuevo: EstadoTestimonio,
  testimonio: TestimonioConEscritura
) {
  const validas: Record<EstadoTestimonio, EstadoTestimonio[]> = {
    [EstadoTestimonio.BORRADOR]: [EstadoTestimonio.GENERADO],
    [EstadoTestimonio.GENERADO]: [EstadoTestimonio.FIRMADO, EstadoTestimonio.BORRADOR],
    [EstadoTestimonio.FIRMADO]: [EstadoTestimonio.ENTREGADO, EstadoTestimonio.GENERADO],
    [EstadoTestimonio.ENTREGADO]: [],
  };

  if (!validas[actual]?.includes(nuevo)) {
    throw new TestimonioError(
      `No se puede pasar de "${actual}" a "${nuevo}". ` +
      `Válidas: ${validas[actual]?.join(', ') || 'ninguna (ya entregado)'}`
    );
  }

  // Si avanzan a 'generado', la escritura necesita PDF (el trigger DB también valida)
  if (nuevo === EstadoTestimonio.GENERADO && !testimonio.escritura.pdf_escritura_url) {
    throw new TestimonioError(
      'No se puede generar el testimonio sin haber subido el PDF de la escritura firmada. ' +
      'Primero sube el escaneo.'
    );
  }
}

// --- Error ---

export class TestimonioError extends Error {
  public details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'TestimonioError';
    this.details = details;
  }
}
