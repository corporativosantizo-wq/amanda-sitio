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

    console.log(`[Classify] Iniciando clasificación para documento: ${documentoId}`);

    if (!documentoId) {
      return NextResponse.json(
        { error: 'documento_id es requerido.' },
        { status: 400 }
      );
    }

    // Verificar env vars
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[Classify] FALTA variable ANTHROPIC_API_KEY');
      return NextResponse.json(
        { error: 'Configuración incompleta: falta ANTHROPIC_API_KEY en el servidor.' },
        { status: 500 }
      );
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Classify] FALTAN variables de Supabase');
      return NextResponse.json(
        { error: 'Configuración incompleta: faltan variables de entorno de Supabase.' },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    // Paso 1: Verificar que el documento existe y está pendiente
    console.log(`[Classify] Paso 1: Buscando documento en BD...`);
    const db = createAdminClient();
    const { data: doc, error: fetchErr } = await db
      .from('documentos')
      .select('id, archivo_url, nombre_archivo, estado')
      .eq('id', documentoId)
      .single();

    if (fetchErr) {
      console.error(`[Classify] Error al buscar documento:`, fetchErr);
      return NextResponse.json(
        { error: `Error al buscar documento en BD: ${fetchErr.message} (code: ${fetchErr.code})` },
        { status: 500 }
      );
    }

    if (!doc) {
      console.error(`[Classify] Documento no encontrado: ${documentoId}`);
      return NextResponse.json(
        { error: `Documento no encontrado: ${documentoId}` },
        { status: 404 }
      );
    }

    console.log(`[Classify] Documento encontrado: ${doc.nombre_archivo}, estado: ${doc.estado}, path: ${doc.archivo_url}`);

    if (doc.estado !== 'pendiente') {
      return NextResponse.json(
        { error: `Documento ya está en estado "${doc.estado}", se esperaba "pendiente".` },
        { status: 400 }
      );
    }

    // Paso 2: Descargar PDF de Storage
    console.log(`[Classify] Paso 2: Descargando PDF de Storage: ${doc.archivo_url}`);
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await descargarPDF(doc.archivo_url);
      console.log(`[Classify] PDF descargado OK: ${(pdfBuffer.length / 1024).toFixed(0)} KB`);
    } catch (dlErr: any) {
      const detail = dlErr instanceof DocumentoError
        ? `${dlErr.message} — ${JSON.stringify(dlErr.details)}`
        : (dlErr.message ?? 'desconocido');
      console.error(`[Classify] Error al descargar PDF:`, detail, dlErr);
      return NextResponse.json(
        { error: `No se pudo descargar el PDF de Storage: ${detail}` },
        { status: 500 }
      );
    }

    const base64 = pdfBuffer.toString('base64');
    console.log(`[Classify] Base64 generado: ${(base64.length / 1024).toFixed(0)} KB`);

    // Paso 3: Llamar a Claude
    console.log(`[Classify] Paso 3: Enviando a Claude API...`);
    let clasificacion: any;
    let rawResponse = '';
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

      console.log(`[Classify] Claude respondió. stop_reason: ${response.stop_reason}, content blocks: ${response.content.length}`);

      const textBlock = response.content.find((b: any) => b.type === 'text') as any;
      rawResponse = textBlock?.text ?? '';
      console.log(`[Classify] Respuesta raw (primeros 500 chars): ${rawResponse.slice(0, 500)}`);

      // Limpiar markdown si Claude lo envuelve en backticks
      const cleaned = rawResponse
        .replace(/^```json?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();

      clasificacion = JSON.parse(cleaned);
      console.log(`[Classify] JSON parseado OK: tipo=${clasificacion.tipo}, confianza=${clasificacion.confianza}`);
    } catch (parseErr: any) {
      console.error(`[Classify] Error en Claude API o JSON parse:`, parseErr.message);
      console.error(`[Classify] Respuesta raw que falló el parse: ${rawResponse.slice(0, 1000)}`);

      // Si es un error de la API (no un parse error), retornar inmediatamente
      if (parseErr.status || parseErr.error) {
        const apiMsg = parseErr.error?.message ?? parseErr.message ?? 'Error de API';
        return NextResponse.json(
          { error: `Error de Claude API: ${apiMsg} (status: ${parseErr.status ?? 'N/A'})` },
          { status: 500 }
        );
      }

      // Si falla el parsing, guardar como 'otro' con baja confianza
      console.warn(`[Classify] Usando clasificación fallback (tipo=otro, confianza=0)`);
      clasificacion = {
        tipo: 'otro',
        titulo: doc.nombre_archivo,
        descripcion: 'No se pudo analizar automáticamente.',
        confianza: 0,
        partes: [],
        cliente_probable: null,
      };
    }

    // Paso 4: Buscar cliente por nombre fuzzy
    console.log(`[Classify] Paso 4: Fuzzy match — cliente_probable: "${clasificacion.cliente_probable}"`);
    let clienteMatch = null;
    if (clasificacion.cliente_probable) {
      try {
        clienteMatch = await buscarClienteFuzzy(clasificacion.cliente_probable);
        if (clienteMatch) {
          console.log(`[Classify] Match encontrado: ${clienteMatch.nombre} (${clienteMatch.codigo}), confianza: ${clienteMatch.confianza}`);
        } else {
          console.log(`[Classify] No se encontró match para "${clasificacion.cliente_probable}"`);
        }
      } catch (fuzzyErr: any) {
        console.error(`[Classify] Error en fuzzy match (no fatal):`, fuzzyErr.message);
      }
    }

    // Paso 5: Guardar clasificación en BD
    console.log(`[Classify] Paso 5: Guardando clasificación en BD...`);
    try {
      const resultado = await clasificarDocumento(doc.id, {
        tipo: clasificacion.tipo ?? 'otro',
        titulo: clasificacion.titulo ?? doc.nombre_archivo,
        descripcion: clasificacion.descripcion ?? null,
        fecha_documento: clasificacion.fecha_documento ?? null,
        numero_documento: clasificacion.numero_documento ?? null,
        partes: clasificacion.partes ?? [],
        cliente_nombre_detectado: clasificacion.cliente_probable ?? null,
        confianza_ia: clasificacion.confianza ?? 0,
        metadata: clasificacion.datos_adicionales ?? {},
        cliente_id: clienteMatch?.id ?? null,
      });

      console.log(`[Classify] Clasificación guardada OK: id=${resultado.id}, tipo=${resultado.tipo}`);

      return NextResponse.json({
        documento: resultado,
        cliente_match: clienteMatch,
      });
    } catch (saveErr: any) {
      const detail = saveErr instanceof DocumentoError
        ? `${saveErr.message} — ${JSON.stringify(saveErr.details)}`
        : (saveErr.message ?? 'desconocido');
      console.error(`[Classify] Error al guardar clasificación:`, detail, saveErr);
      return NextResponse.json(
        { error: `Error al guardar clasificación en BD: ${detail}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[Classify] Error general no capturado:', error);
    const detail = error instanceof DocumentoError
      ? `${error.message} — ${JSON.stringify(error.details)}`
      : (error.message ?? 'Error desconocido');
    return NextResponse.json(
      { error: `Error al clasificar: ${detail}` },
      { status: 500 }
    );
  }
}
