// ============================================================================
// POST /api/admin/documentos/classify
// Clasificar un documento con Claude IA
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  descargarPDF,
  clasificarDocumento,
  buscarClienteFuzzy,
  DocumentoError,
} from '@/lib/services/documentos.service';
import { createAdminClient } from '@/lib/supabase/admin';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const CLASSIFY_PROMPT = `Eres un asistente de clasificación documental para un bufete de abogados en Guatemala (Amanda Santizo & Asociados). Analiza el documento legal PDF y extrae información estructurada.

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks, sin texto adicional):

{
  "tipo": "contrato_comercial|escritura_publica|testimonio|acta_notarial|poder|contrato_laboral|demanda_memorial|resolucion_judicial|otro",
  "titulo": "título descriptivo del documento",
  "descripcion": "resumen de 1-2 oraciones",
  "fecha_documento": "YYYY-MM-DD o null",
  "numero_documento": "número de escritura/acta/expediente o null",
  "partes": [{"nombre": "nombre completo", "rol": "rol en el documento"}],
  "cliente_probable": "nombre de la persona o empresa que probablemente es cliente del bufete",
  "confianza": 0.85,
  "datos_adicionales": {
    "notario": "nombre del notario si aplica o null",
    "juzgado": "nombre del juzgado si aplica o null",
    "monto": "monto involucrado si aplica o null"
  }
}

Reglas:
- Si el documento está escaneado y es difícil de leer, haz tu mejor esfuerzo y baja la confianza
- "partes" incluye todos los nombres de personas o empresas mencionadas
- "cliente_probable" es quien más probablemente contrató al bufete
- Si no puedes determinar algo, usa null
- La confianza va de 0.0 a 1.0`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const documentoId = body.documento_id;

    if (!documentoId) {
      return NextResponse.json(
        { error: 'documento_id es requerido.' },
        { status: 400 }
      );
    }

    // Verificar que el documento existe y está pendiente
    const db = createAdminClient();
    const { data: doc, error: fetchErr } = await db
      .from('documentos')
      .select('id, storage_path, nombre_archivo, estado')
      .eq('id', documentoId)
      .single();

    if (fetchErr || !doc) {
      return NextResponse.json(
        { error: 'Documento no encontrado.' },
        { status: 404 }
      );
    }

    if (doc.estado !== 'pendiente') {
      return NextResponse.json(
        { error: `Documento ya está en estado: ${doc.estado}` },
        { status: 400 }
      );
    }

    // Descargar PDF de Storage
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await descargarPDF(doc.storage_path);
    } catch {
      return NextResponse.json(
        { error: 'No se pudo descargar el PDF de Storage.' },
        { status: 500 }
      );
    }

    const base64 = pdfBuffer.toString('base64');

    // Llamar a Claude
    let clasificacion: any;
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: base64,
                },
              },
              {
                type: 'text',
                text: CLASSIFY_PROMPT,
              },
            ],
          },
        ],
      });

      const textBlock = response.content.find((b: any) => b.type === 'text') as any;
      const responseText = textBlock?.text ?? '';

      // Limpiar markdown si Claude lo envuelve en backticks
      const cleaned = responseText
        .replace(/^```json?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();

      clasificacion = JSON.parse(cleaned);
    } catch (parseErr: any) {
      // Si falla el parsing, guardar como 'otro' con baja confianza
      clasificacion = {
        tipo: 'otro',
        titulo: doc.nombre_archivo,
        descripcion: 'No se pudo analizar automáticamente.',
        confianza: 0,
        partes: [],
        cliente_probable: null,
      };
    }

    // Buscar cliente por nombre fuzzy
    let clienteMatch = null;
    if (clasificacion.cliente_probable) {
      clienteMatch = await buscarClienteFuzzy(clasificacion.cliente_probable);
    }

    // Guardar clasificación
    const resultado = await clasificarDocumento(doc.id, {
      tipo: clasificacion.tipo ?? 'otro',
      titulo: clasificacion.titulo ?? doc.nombre_archivo,
      descripcion: clasificacion.descripcion ?? null,
      fecha_documento: clasificacion.fecha_documento ?? null,
      numero_documento: clasificacion.numero_documento ?? null,
      partes: clasificacion.partes ?? [],
      nombre_cliente_extraido: clasificacion.cliente_probable ?? null,
      confianza_ia: clasificacion.confianza ?? 0,
      metadata: clasificacion.datos_adicionales ?? {},
      cliente_id: clienteMatch?.id ?? null,
    });

    return NextResponse.json({
      documento: resultado,
      cliente_match: clienteMatch,
    });
  } catch (error: any) {
    console.error('[Documentos Classify] Error:', error);
    const msg = error instanceof DocumentoError ? error.message : 'Error al clasificar documento.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
