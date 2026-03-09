// ============================================================================
// POST /api/admin/comunicaciones/masivo
// Envío masivo de documentos — un correo por cliente con adjunto
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { sendMail } from '@/lib/services/outlook.service';
import type { MailboxAlias } from '@/lib/services/outlook.service';
import { createAdminClient } from '@/lib/supabase/admin';
import { obtenerPieConfidencialidad } from '@/lib/services/comunicaciones.service';

const db = () => createAdminClient();

interface EnvioItem {
  filename: string;
  contentType: string;
  contentBase64: string;
  clienteId: string | null;
  clienteNombre: string;
  email: string;
  cc: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      items,
      asunto_template,
      cuerpo_template,
      cuenta_envio,
    } = body as {
      items: EnvioItem[];
      asunto_template: string;
      cuerpo_template: string;
      cuenta_envio: string;
    };

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No hay correos para enviar' }, { status: 400 });
    }

    const pie = await obtenerPieConfidencialidad(cuenta_envio);
    const enviados: string[] = [];
    const errores: Array<{ filename: string; email: string; error: string }> = [];

    for (const item of items) {
      if (!item.email) {
        errores.push({ filename: item.filename, email: '', error: 'Sin email' });
        continue;
      }

      try {
        const asunto = asunto_template
          .replace(/\{nombre_cliente\}/g, item.clienteNombre || 'Cliente')
          .replace(/\{nombre_documento\}/g, item.filename.replace(/\.[^.]+$/, ''));

        const cuerpoText = cuerpo_template
          .replace(/\{nombre_cliente\}/g, item.clienteNombre || 'Estimado/a')
          .replace(/\{nombre_documento\}/g, item.filename.replace(/\.[^.]+$/, ''));

        const htmlBody =
          '<div style="font-family:Arial,sans-serif;font-size:14px;color:#333;">' +
          cuerpoText.replace(/\n/g, '<br>') +
          '</div>' +
          (pie ? `<div style="margin-top:24px;font-size:11px;color:#94a3b8;">${pie}</div>` : '');

        const ccList = item.cc
          ? item.cc.split(',').map((e: string) => e.trim()).filter(Boolean)
          : undefined;

        await sendMail({
          from: cuenta_envio as MailboxAlias,
          to: item.email,
          subject: asunto,
          htmlBody,
          ...(ccList && ccList.length > 0 ? { cc: ccList } : {}),
          attachments: [{
            name: item.filename,
            contentType: item.contentType || 'application/octet-stream',
            contentBytes: item.contentBase64,
          }],
        });

        // Register in correos_programados
        await db()
          .from('correos_programados')
          .insert({
            cliente_id: item.clienteId,
            destinatario_email: item.email,
            destinatario_nombre: item.clienteNombre,
            cc_emails: item.cc,
            cuenta_envio,
            asunto,
            cuerpo: cuerpoText,
            estado: 'enviado',
            enviado_at: new Date().toISOString(),
          });

        enviados.push(item.filename);
      } catch (err: any) {
        errores.push({
          filename: item.filename,
          email: item.email,
          error: err.message ?? 'Error desconocido',
        });
      }
    }

    return NextResponse.json({
      ok: true,
      enviados: enviados.length,
      errores,
      total: items.length,
    });
  } catch (err: any) {
    console.error('[Comunicaciones/Masivo] Error:', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
