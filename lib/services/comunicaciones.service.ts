// ============================================================================
// lib/services/comunicaciones.service.ts
// Centro de Comunicaciones — plantillas, correos programados, envío
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { sendMail } from '@/lib/services/outlook.service';
import type { MailboxAlias } from '@/lib/services/outlook.service';
import type { CampoExtra, PlantillaCorreo } from '@/lib/types/plantillas-correo';

const db = () => createAdminClient();

// Re-export para no romper imports existentes del service.
export type { CampoExtra, PlantillaCorreo };

export interface CorreoProgramado {
  id: string;
  plantilla_id: string | null;
  cliente_id: string | null;
  destinatario_email: string;
  destinatario_nombre: string | null;
  cc_emails: string | null;
  cuenta_envio: string;
  asunto: string;
  cuerpo: string;
  adjuntos: any[];
  estado: 'borrador' | 'programado' | 'enviado' | 'fallido' | 'cancelado';
  programado_para: string | null;
  enviado_at: string | null;
  error_mensaje: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  plantilla?: Pick<PlantillaCorreo, 'nombre' | 'icono'> | null;
  cliente?: { nombre: string } | null;
}

export interface PieConfidencialidad {
  id: string;
  cuenta_email: string;
  texto: string;
  activo: boolean;
}

// ── Plantillas ───────────────────────────────────────────────────────────

export async function listarPlantillas(): Promise<PlantillaCorreo[]> {
  const { data, error } = await db()
    .from('plantillas_correo')
    .select('id, nombre, slug, icono, categoria, asunto_template, cuerpo_template, cuenta_default, campos_extra, activo, orden')
    .eq('activo', true)
    .order('orden');

  if (error) throw new Error('Error al cargar plantillas: ' + error.message);
  return (data ?? []).map((p: any) => ({
    ...p,
    campos_extra: Array.isArray(p.campos_extra) ? p.campos_extra : JSON.parse(p.campos_extra || '[]'),
  }));
}

export async function obtenerPlantilla(id: string): Promise<PlantillaCorreo | null> {
  const { data, error } = await db()
    .from('plantillas_correo')
    .select('id, nombre, slug, icono, categoria, asunto_template, cuerpo_template, cuenta_default, campos_extra, activo, orden')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return {
    ...data,
    campos_extra: Array.isArray(data.campos_extra) ? data.campos_extra : JSON.parse(data.campos_extra || '[]'),
  } as PlantillaCorreo;
}

// ── Pie de confidencialidad ──────────────────────────────────────────────

export async function obtenerPieConfidencialidad(cuenta: string): Promise<string> {
  const { data } = await db()
    .from('pie_confidencialidad')
    .select('texto')
    .eq('cuenta_email', cuenta)
    .eq('activo', true)
    .single();

  return data?.texto ?? '';
}

export async function listarPiesConfidencialidad(): Promise<PieConfidencialidad[]> {
  const { data } = await db()
    .from('pie_confidencialidad')
    .select('id, cuenta_email, texto, activo')
    .eq('activo', true);
  return (data ?? []) as PieConfidencialidad[];
}

// ── Correos programados CRUD ─────────────────────────────────────────────

export interface CrearCorreoInput {
  plantilla_id?: string | null;
  cliente_id?: string | null;
  destinatario_email: string;
  destinatario_nombre?: string | null;
  cc_emails?: string | null;
  cuenta_envio: string;
  asunto: string;
  cuerpo: string;
  adjuntos?: any[];
  estado: 'borrador' | 'programado';
  programado_para?: string | null;
}

export async function crearCorreo(input: CrearCorreoInput): Promise<CorreoProgramado> {
  const { data, error } = await db()
    .from('correos_programados')
    .insert({
      plantilla_id: input.plantilla_id ?? null,
      cliente_id: input.cliente_id ?? null,
      destinatario_email: input.destinatario_email,
      destinatario_nombre: input.destinatario_nombre ?? null,
      cc_emails: input.cc_emails ?? null,
      cuenta_envio: input.cuenta_envio,
      asunto: input.asunto,
      cuerpo: input.cuerpo,
      adjuntos: input.adjuntos ?? [],
      estado: input.estado,
      programado_para: input.programado_para ?? null,
    })
    .select()
    .single();

  if (error) throw new Error('Error al crear correo: ' + error.message);
  return data as CorreoProgramado;
}

export async function listarCorreos(params: {
  estado?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: CorreoProgramado[]; total: number }> {
  const { estado, limit = 30, offset = 0 } = params;

  let query = db()
    .from('correos_programados')
    .select(`
      id, plantilla_id, cliente_id,
      destinatario_email, destinatario_nombre, cc_emails,
      cuenta_envio, asunto, cuerpo,
      estado, programado_para, enviado_at, error_mensaje,
      created_at, updated_at,
      plantilla:plantillas_correo!plantilla_id (nombre, icono),
      cliente:clientes!cliente_id (nombre)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (estado) {
    query = query.eq('estado', estado);
  }

  const { data, error, count } = await query;
  if (error) throw new Error('Error al listar correos: ' + error.message);
  return { data: (data ?? []) as CorreoProgramado[], total: count ?? 0 };
}

export async function actualizarCorreo(
  id: string,
  input: Partial<Pick<CrearCorreoInput, 'destinatario_email' | 'destinatario_nombre' | 'cc_emails' | 'cuenta_envio' | 'asunto' | 'cuerpo' | 'adjuntos' | 'programado_para'>>,
): Promise<CorreoProgramado> {
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (input.destinatario_email !== undefined) updates.destinatario_email = input.destinatario_email;
  if (input.destinatario_nombre !== undefined) updates.destinatario_nombre = input.destinatario_nombre;
  if (input.cc_emails !== undefined) updates.cc_emails = input.cc_emails;
  if (input.cuenta_envio !== undefined) updates.cuenta_envio = input.cuenta_envio;
  if (input.asunto !== undefined) updates.asunto = input.asunto;
  if (input.cuerpo !== undefined) updates.cuerpo = input.cuerpo;
  if (input.adjuntos !== undefined) updates.adjuntos = input.adjuntos;
  if (input.programado_para !== undefined) updates.programado_para = input.programado_para;

  const { data, error } = await db()
    .from('correos_programados')
    .update(updates)
    .eq('id', id)
    .in('estado', ['borrador', 'programado'])
    .select()
    .single();

  if (error) throw new Error('Error al actualizar correo: ' + error.message);
  return data as CorreoProgramado;
}

export async function cancelarCorreo(id: string): Promise<void> {
  const { error } = await db()
    .from('correos_programados')
    .update({ estado: 'cancelado', updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('estado', ['borrador', 'programado']);

  if (error) throw new Error('Error al cancelar correo: ' + error.message);
}

// ── Envío ────────────────────────────────────────────────────────────────

export async function enviarCorreoAhora(id: string): Promise<void> {
  const { data: correo, error } = await db()
    .from('correos_programados')
    .select('id, destinatario_email, destinatario_nombre, cc_emails, cuenta_envio, asunto, cuerpo, adjuntos, estado')
    .eq('id', id)
    .single();

  if (error || !correo) throw new Error('Correo no encontrado');
  if (correo.estado === 'enviado') throw new Error('Este correo ya fue enviado');

  // Get pie de confidencialidad
  const pie = await obtenerPieConfidencialidad(correo.cuenta_envio);

  const htmlBody = correo.cuerpo
    .replace(/\n/g, '<br>')
    .replace(/^/, '<div style="font-family:Arial,sans-serif;font-size:14px;color:#333;">')
    .replace(/$/, '</div>')
    + (pie ? `<div style="margin-top:24px;font-size:11px;color:#94a3b8;">${pie}</div>` : '');

  const ccList = correo.cc_emails
    ? correo.cc_emails.split(',').map((e: string) => e.trim()).filter(Boolean)
    : undefined;

  // Download attachments from Storage if any
  const adjuntosArr = Array.isArray(correo.adjuntos) ? correo.adjuntos : [];
  const attachments: Array<{ name: string; contentType: string; contentBytes: string }> = [];

  for (const adj of adjuntosArr) {
    if (!adj.path) continue;
    const { data: fileData, error: dlError } = await db().storage
      .from('adjuntos-correo')
      .download(adj.path);
    if (dlError || !fileData) {
      console.error(`[Correo] Error descargando adjunto ${adj.path}:`, dlError?.message);
      continue;
    }
    const buffer = Buffer.from(await fileData.arrayBuffer());
    attachments.push({
      name: adj.name,
      contentType: adj.contentType || 'application/octet-stream',
      contentBytes: buffer.toString('base64'),
    });
  }

  try {
    await sendMail({
      from: correo.cuenta_envio as MailboxAlias,
      to: correo.destinatario_email,
      subject: correo.asunto,
      htmlBody,
      ...(ccList && ccList.length > 0 ? { cc: ccList } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
    });

    await db()
      .from('correos_programados')
      .update({
        estado: 'enviado',
        enviado_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  } catch (err: any) {
    await db()
      .from('correos_programados')
      .update({
        estado: 'fallido',
        error_mensaje: err.message ?? 'Error desconocido',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    throw err;
  }
}

// ── Cron: enviar correos programados ─────────────────────────────────────

export async function enviarCorreosProgramados(): Promise<{ enviados: number; errores: number }> {
  const { data: pendientes, error } = await db()
    .from('correos_programados')
    .select('id')
    .eq('estado', 'programado')
    .lte('programado_para', new Date().toISOString());

  if (error) throw new Error('Error consultando correos programados: ' + error.message);
  if (!pendientes || pendientes.length === 0) return { enviados: 0, errores: 0 };

  let enviados = 0;
  let errores = 0;

  for (const correo of pendientes) {
    try {
      await enviarCorreoAhora(correo.id);
      enviados++;
    } catch (err: any) {
      console.error('[CronCorreos] Error enviando correo', correo.id + ':', err.message);
      errores++;
    }
  }

  return { enviados, errores };
}
