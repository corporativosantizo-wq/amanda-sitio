// ============================================================================
// GET /api/cron/tareas-programadas
// Cron job: ejecuta tareas programadas del asistente IA (emails, etc.)
// Vercel cron: cada hora
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  obtenerTareasProgramadasPendientes,
  marcarTareaEjecutada,
} from '@/lib/services/tareas.service';
import { sendMail } from '@/lib/services/outlook.service';
import type { MailboxAlias } from '@/lib/services/outlook.service';
import {
  emailSolicitudPago,
  emailDocumentosDisponibles,
  emailAvisoAudiencia,
  emailSolicitudDocumentos,
  emailRecordatorio24h,
  emailWrapper,
} from '@/lib/templates/emails';

export async function GET(req: NextRequest) {
  // Verificar CRON_SECRET
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const resultados: { id: string; titulo: string; ok: boolean; detalle: string }[] = [];

  try {
    const tareas = await obtenerTareasProgramadasPendientes();
    console.log(`[Cron Tareas] Encontradas ${tareas.length} tareas programadas pendientes`);

    for (const tarea of tareas) {
      try {
        const accion = tarea.accion_automatica;
        if (!accion || accion.tipo !== 'enviar_email') {
          console.log(`[Cron Tareas] Tarea ${tarea.id}: tipo de acción no soportado (${accion?.tipo})`);
          resultados.push({ id: tarea.id, titulo: tarea.titulo, ok: false, detalle: `Tipo no soportado: ${accion?.tipo}` });
          continue;
        }

        // Resolve destinatario
        const db = createAdminClient();
        let destinatarioEmail: string | null = null;
        let destinatarioNombre = accion.nombre_destinatario ?? 'Cliente';

        if (accion.email_directo) {
          destinatarioEmail = accion.email_directo;
          destinatarioNombre = accion.nombre_destinatario ?? accion.email_directo;
        } else if (accion.cliente_id) {
          const { data: cliente } = await db
            .from('clientes')
            .select('id, nombre, email')
            .eq('id', accion.cliente_id)
            .single();
          if (cliente?.email) {
            destinatarioEmail = cliente.email;
            destinatarioNombre = cliente.nombre;
          }
        } else if (tarea.cliente?.email) {
          destinatarioEmail = tarea.cliente.email;
          destinatarioNombre = tarea.cliente.nombre;
        }

        // Fallback: buscar email en datos.destinatario
        if (!destinatarioEmail && accion.datos?.destinatario) {
          destinatarioEmail = accion.datos.destinatario;
        }

        // Fallback: si hay cliente_id en la tarea pero no en accion, buscar email
        if (!destinatarioEmail && tarea.cliente_id && !accion.cliente_id) {
          const { data: cliFallback } = await db
            .from('clientes')
            .select('id, nombre, email')
            .eq('id', tarea.cliente_id)
            .single();
          if (cliFallback?.email) {
            destinatarioEmail = cliFallback.email;
            destinatarioNombre = cliFallback.nombre;
          }
        }

        if (!destinatarioEmail) {
          const msg = `No se encontró email del destinatario para tarea "${tarea.titulo}"`;
          console.error(`[Cron Tareas] ${msg}`);
          resultados.push({ id: tarea.id, titulo: tarea.titulo, ok: false, detalle: msg });
          continue;
        }

        // Build email from template
        let from: MailboxAlias;
        let subject: string;
        let html: string;
        const datos = accion.datos ?? {};

        switch (accion.template) {
          case 'solicitud_pago': {
            const t = emailSolicitudPago({
              clienteNombre: destinatarioNombre,
              concepto: datos.concepto ?? 'Servicios legales',
              monto: datos.monto ?? 0,
              fechaLimite: datos.fecha_limite,
            });
            from = t.from; subject = t.subject; html = t.html;
            break;
          }
          case 'documentos_disponibles': {
            const t = emailDocumentosDisponibles({ clienteNombre: destinatarioNombre });
            from = t.from; subject = t.subject; html = t.html;
            break;
          }
          case 'aviso_audiencia': {
            const t = emailAvisoAudiencia({
              clienteNombre: destinatarioNombre,
              fecha: datos.fecha ?? new Date().toISOString().split('T')[0],
              hora: datos.hora ?? '09:00',
              juzgado: datos.juzgado ?? 'Por confirmar',
              direccion: datos.direccion,
              presenciaRequerida: datos.presencia_requerida ?? true,
              instrucciones: datos.instrucciones,
              documentosLlevar: datos.documentos_llevar,
            });
            from = t.from; subject = t.subject; html = t.html;
            break;
          }
          case 'solicitud_documentos': {
            const t = emailSolicitudDocumentos({
              clienteNombre: destinatarioNombre,
              documentos: datos.documentos ?? ['Documentos pendientes'],
              plazo: datos.plazo,
            });
            from = t.from; subject = t.subject; html = t.html;
            break;
          }
          case 'personalizado': {
            from = 'asistente@papeleo.legal';
            subject = datos.asunto ?? tarea.titulo ?? 'Mensaje de Amanda Santizo — Despacho Jurídico';
            // Fallback: contenido_html → contenido, o generar body básico desde titulo/descripcion
            const body = datos.contenido || datos.contenido_html
              || `<p>${tarea.titulo}</p>${tarea.descripcion ? `<p>${tarea.descripcion}</p>` : ''}`;
            html = emailWrapper(body);
            break;
          }
          default: {
            const msg = `Template no soportado: ${accion.template}`;
            console.error(`[Cron Tareas] ${msg}`);
            resultados.push({ id: tarea.id, titulo: tarea.titulo, ok: false, detalle: msg });
            continue;
          }
        }

        // Send email
        await sendMail({ from, to: destinatarioEmail, subject, htmlBody: html });
        const maskedEmail = destinatarioEmail.replace(/(.{2}).+(@.+)/, '$1***$2');
        console.log(`[Cron Tareas] Email enviado: ${accion.template} a ${maskedEmail} desde ${from}`);

        // Mark as executed
        await marcarTareaEjecutada(tarea.id, `Email ${accion.template} enviado a ${maskedEmail}`);
        resultados.push({ id: tarea.id, titulo: tarea.titulo, ok: true, detalle: `Email enviado a ${maskedEmail}` });

      } catch (err: any) {
        console.error(`[Cron Tareas] Error procesando tarea ${tarea.id}:`, err.message);
        resultados.push({ id: tarea.id, titulo: tarea.titulo, ok: false, detalle: err.message });
      }
    }

    const exitosas = resultados.filter((r: any) => r.ok).length;
    const fallidas = resultados.filter((r: any) => !r.ok).length;
    console.log(`[Cron Tareas] Resultado: ${exitosas} exitosas, ${fallidas} fallidas de ${tareas.length} total`);

    return NextResponse.json({
      ok: true,
      total: tareas.length,
      exitosas,
      fallidas,
      resultados,
    });

  } catch (err: any) {
    console.error('[Cron Tareas] Error:', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
