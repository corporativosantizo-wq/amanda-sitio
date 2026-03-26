// ============================================================================
// POST /api/admin/documentos/classify
// Clasificar un documento con Claude IA (PDF, DOCX, imágenes)
// RESILIENT: si la clasificación falla, guarda como 'pendiente' con nota.
// LARGE FILES: PDFs >5MB se recortan a primeras 5 páginas antes de enviar.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient } from '@/lib/ai/anthropic-client';
import { PDFDocument } from 'pdf-lib';
import mammoth from 'mammoth';
import {
  descargarPDF,
  clasificarDocumento,
  buscarClienteFuzzy,
  buscarClientePorNombreArchivo,
  DocumentoError,
} from '@/lib/services/documentos.service';
import { createAdminClient } from '@/lib/supabase/admin';

function getFileExtension(filename: string): string {
  return (filename.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '');
}

// Tamaño máximo para descargar el archivo completo para clasificación
const MAX_DOWNLOAD_SIZE = 30 * 1024 * 1024; // 30MB — beyond this, skip AI
const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5MB — use more aggressive trimming
const MAX_PAGES_NORMAL = 5;
const MAX_PAGES_LARGE = 8; // For large files, extract more pages for better classification

const CLASSIFY_PROMPT = `Eres un asistente de clasificación documental para un bufete de abogados en Guatemala (Amanda Santizo — Despacho Jurídico). Analiza el documento legal y extrae información estructurada.

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

const IMAGE_CLASSIFY_PROMPT = `Eres un asistente de clasificación documental para un bufete de abogados en Guatemala (Amanda Santizo — Despacho Jurídico). Analiza esta imagen de un documento legal y extrae información estructurada.

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
- Si la imagen es difícil de leer, haz tu mejor esfuerzo y baja la confianza
- "partes" incluye todos los nombres de personas o empresas mencionadas
- "cliente_probable" es quien más probablemente contrató al bufete
- Si no puedes determinar algo, usa null
- La confianza va de 0.0 a 1.0`;

// Helper: save fallback classification so the document never stays stuck as 'pendiente'
async function guardarClasificacionFallback(
  docId: string,
  nombreArchivo: string,
  clienteId: string | null,
  motivo: string,
) {
  try {
    console.warn(`[Classify] Fallback para doc ${docId}: ${motivo}`);
    await clasificarDocumento(docId, {
      tipo: 'otro',
      titulo: nombreArchivo.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
      descripcion: `Clasificación automática no disponible: ${motivo}`,
      confianza_ia: 0,
      partes: [],
      cliente_nombre_detectado: null,
      cliente_id: clienteId,
    });
  } catch (fbErr: any) {
    console.error(`[Classify] Error en fallback para doc ${docId}:`, fbErr.message);
  }
}

export async function POST(req: NextRequest) {
  let documentoId: string | undefined;
  let docNombre = '';
  let docClienteId: string | null = null;

  try {
    const body = await req.json();
    documentoId = body.documento_id;

    console.log('[Classify] Iniciando clasificación para documento:', documentoId);

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

    const anthropic = getAnthropicClient();

    // Paso 1: Verificar que el documento existe y está pendiente
    console.log(`[Classify] Paso 1: Buscando documento en BD...`);
    const db = createAdminClient();
    const { data: doc, error: fetchErr } = await db
      .from('documentos')
      .select('id, archivo_url, nombre_archivo, estado, archivo_tamano, cliente_id')
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
      console.error('[Classify] Documento no encontrado:', documentoId);
      return NextResponse.json(
        { error: `Documento no encontrado: ${documentoId}` },
        { status: 404 }
      );
    }

    docNombre = doc.nombre_archivo;
    docClienteId = doc.cliente_id;

    console.log('[Classify] Documento encontrado:', doc.nombre_archivo,
      ', estado:', doc.estado,
      ', tamano:', doc.archivo_tamano ? `${(doc.archivo_tamano / 1024 / 1024).toFixed(1)} MB` : 'desconocido',
      ', path:', doc.archivo_url);

    if (doc.estado !== 'pendiente') {
      return NextResponse.json(
        { error: `Documento ya está en estado "${doc.estado}", se esperaba "pendiente".` },
        { status: 400 }
      );
    }

    // Paso 2: Descargar archivo de Storage y preparar contenido para Claude
    const ext = getFileExtension(doc.nombre_archivo);
    const fileSize = doc.archivo_tamano ?? 0;
    console.log('[Classify] Paso 2: Descargando archivo de Storage:', doc.archivo_url, '(ext:', ext, ', size:', fileSize, ')');

    let clasificacion: any;
    let rawResponse = '';
    const isImage = ['.jpg', '.jpeg', '.png'].includes(ext);
    const isDocx = ['.docx'].includes(ext);
    const isPdf = ext === '.pdf';
    const isSkipAI = ['.doc', '.xlsx', '.xls'].includes(ext);

    if (isSkipAI) {
      // DOC, XLSX, XLS: classify by filename only (no AI content analysis)
      console.log(`[Classify] Formato ${ext} — clasificación por nombre de archivo sin IA`);
      clasificacion = {
        tipo: 'otro',
        titulo: doc.nombre_archivo.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
        descripcion: `Archivo ${ext.toUpperCase().slice(1)} subido sin análisis de contenido.`,
        confianza: 0.3,
        partes: [],
        cliente_probable: null,
      };
    } else if (fileSize > MAX_DOWNLOAD_SIZE) {
      // File too large to download for classification — use filename fallback
      console.warn(`[Classify] Archivo demasiado grande (${(fileSize / 1024 / 1024).toFixed(1)} MB > ${MAX_DOWNLOAD_SIZE / 1024 / 1024} MB) — clasificación por nombre`);
      clasificacion = {
        tipo: 'otro',
        titulo: doc.nombre_archivo.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
        descripcion: `Archivo grande (${(fileSize / 1024 / 1024).toFixed(1)} MB) — clasificado por nombre. Reclasifique manualmente si es necesario.`,
        confianza: 0.2,
        partes: [],
        cliente_probable: null,
      };
    } else {
      // PDF, DOCX, Images: download and analyze with Claude
      let fileBuffer: Buffer;
      try {
        fileBuffer = await descargarPDF(doc.archivo_url);
        console.log(`[Classify] Archivo descargado OK: ${(fileBuffer.length / 1024).toFixed(0)} KB`);
      } catch (dlErr: any) {
        const detail = dlErr instanceof DocumentoError
          ? `${dlErr.message} — ${JSON.stringify(dlErr.details)}`
          : (dlErr.message ?? 'desconocido');
        console.error(`[Classify] Error al descargar archivo:`, detail);
        // RESILIENT: save fallback instead of returning 500
        await guardarClasificacionFallback(documentoId, doc.nombre_archivo, docClienteId, `Error de descarga: ${detail}`);
        return NextResponse.json({
          documento: { id: documentoId, tipo: 'otro', estado: 'clasificado' },
          cliente_match: null,
          fallback: true,
          fallback_reason: 'download_error',
        });
      }

      // Paso 3: Build Claude message content based on file type
      console.log(`[Classify] Paso 3: Enviando a Claude API (tipo: ${ext})...`);
      let messageContent: any[];

      if (isPdf) {
        // PDF: extract pages, send as document
        const isLarge = fileBuffer.length > LARGE_FILE_THRESHOLD;
        const maxPages = isLarge ? MAX_PAGES_LARGE : MAX_PAGES_NORMAL;

        try {
          const srcDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
          const totalPages = srcDoc.getPageCount();
          console.log(`[Classify] PDF tiene ${totalPages} página(s), isLarge: ${isLarge}, maxPages: ${maxPages}`);

          let base64: string;
          if (totalPages > maxPages) {
            const trimmedDoc = await PDFDocument.create();
            const pageIndices = Array.from({ length: Math.min(maxPages, totalPages) }, (_, i) => i);
            const pages = await trimmedDoc.copyPages(srcDoc, pageIndices);
            for (const page of pages) trimmedDoc.addPage(page);
            const trimmedBytes = await trimmedDoc.save();
            base64 = Buffer.from(trimmedBytes).toString('base64');
            console.log(`[Classify] PDF recortado a ${pageIndices.length} páginas: ${(trimmedBytes.length / 1024).toFixed(0)} KB`);
          } else {
            // Even for small page count, re-save to strip large embedded resources if file is large
            if (isLarge) {
              const trimmedDoc = await PDFDocument.create();
              const pageIndices = Array.from({ length: totalPages }, (_, i) => i);
              const pages = await trimmedDoc.copyPages(srcDoc, pageIndices);
              for (const page of pages) trimmedDoc.addPage(page);
              const trimmedBytes = await trimmedDoc.save();
              base64 = Buffer.from(trimmedBytes).toString('base64');
              console.log(`[Classify] PDF grande re-saved: ${(trimmedBytes.length / 1024).toFixed(0)} KB`);
            } else {
              base64 = fileBuffer.toString('base64');
            }
          }

          messageContent = [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: CLASSIFY_PROMPT },
          ];
        } catch (pdfErr: any) {
          console.error(`[Classify] Error procesando PDF:`, pdfErr.message);
          // PDF corrupto o protegido — fallback
          await guardarClasificacionFallback(documentoId, doc.nombre_archivo, docClienteId, `Error procesando PDF: ${pdfErr.message}`);
          return NextResponse.json({
            documento: { id: documentoId, tipo: 'otro', estado: 'clasificado' },
            cliente_match: null,
            fallback: true,
            fallback_reason: 'pdf_parse_error',
          });
        }
      } else if (isDocx) {
        // DOCX: extract text with mammoth, send as text
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        const text = result.value.slice(0, 15000); // Limit to ~15k chars
        console.log(`[Classify] DOCX texto extraído: ${text.length} chars`);

        messageContent = [
          { type: 'text', text: `Contenido del documento DOCX "${doc.nombre_archivo}":\n\n${text}\n\n---\n\n${CLASSIFY_PROMPT}` },
        ];
      } else {
        // Image: send as image to Claude vision
        const mediaType = ext === '.png' ? 'image/png' : 'image/jpeg';
        const base64 = fileBuffer.toString('base64');
        console.log(`[Classify] Imagen ${mediaType}: ${(fileBuffer.length / 1024).toFixed(0)} KB`);

        messageContent = [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: IMAGE_CLASSIFY_PROMPT },
        ];
      }

      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          messages: [{ role: 'user', content: messageContent }],
        });

        console.log('[Classify] Claude respondió. stop_reason:', response.stop_reason, ', content blocks:', response.content.length);

        const textBlock = response.content.find((b: any) => b.type === 'text') as any;
        rawResponse = textBlock?.text ?? '';
        console.log('[Classify] Respuesta raw (primeros 500 chars):', rawResponse.slice(0, 500));

        const cleaned = rawResponse
          .replace(/^```json?\s*/i, '')
          .replace(/```\s*$/, '')
          .trim();

        clasificacion = JSON.parse(cleaned);
        console.log('[Classify] JSON parseado OK: tipo=', clasificacion.tipo, ', confianza=', clasificacion.confianza);
      } catch (parseErr: any) {
        console.error(`[Classify] Error en Claude API o JSON parse:`, parseErr.message);
        console.error('[Classify] Respuesta raw que falló el parse:', rawResponse.slice(0, 1000));

        // RESILIENT: instead of returning 500 for API errors, use fallback
        console.warn(`[Classify] Usando clasificación fallback (tipo=otro, confianza=0)`);
        clasificacion = {
          tipo: 'otro',
          titulo: doc.nombre_archivo.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
          descripcion: 'No se pudo analizar automáticamente.',
          confianza: 0,
          partes: [],
          cliente_probable: null,
        };
      }
    }

    // Paso 4: Buscar cliente — intenta múltiples fuentes
    console.log(`[Classify] Paso 4: Detectando cliente...`);
    let clienteMatch: { id: string; nombre: string; codigo: string; confianza: number } | null = null;

    // 4a. Si el documento ya tiene cliente_id asignado (subido con cliente), no buscar
    if (docClienteId) {
      console.log('[Classify] Documento ya tiene cliente_id asignado:', docClienteId);
    } else {
      // 4b. Buscar por cliente_probable (del contenido del PDF)
      if (clasificacion.cliente_probable) {
        try {
          clienteMatch = await buscarClienteFuzzy(clasificacion.cliente_probable);
          if (clienteMatch) {
            console.log('[Classify] Match por contenido:', clienteMatch.nombre, '(' + clienteMatch.codigo + '), score:', clienteMatch.confianza);
          }
        } catch (fuzzyErr: any) {
          console.error(`[Classify] Error en fuzzy match (no fatal):`, fuzzyErr.message);
        }
      }

      // 4c. Si no hubo match por contenido, buscar en las partes del documento
      if (!clienteMatch && clasificacion.partes?.length > 0) {
        for (const parte of clasificacion.partes) {
          if (!parte.nombre) continue;
          try {
            const match = await buscarClienteFuzzy(parte.nombre);
            if (match && match.confianza > (clienteMatch?.confianza ?? 0)) {
              clienteMatch = match;
              console.log('[Classify] Match por parte "' + parte.nombre + '":', match.nombre, '(' + match.codigo + '), score:', match.confianza);
            }
          } catch { /* skip */ }
        }
      }

      // 4d. Si aún no hay match, intentar por nombre del archivo
      if (!clienteMatch) {
        try {
          clienteMatch = await buscarClientePorNombreArchivo(doc.nombre_archivo);
          if (clienteMatch) {
            console.log('[Classify] Match por filename:', clienteMatch.nombre, '(' + clienteMatch.codigo + '), score:', clienteMatch.confianza);
          }
        } catch { /* skip */ }
      }

      if (!clienteMatch) {
        console.log(`[Classify] No se encontró match de cliente por ningún método`);
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
        cliente_id: docClienteId ?? clienteMatch?.id ?? null,
      });

      console.log('[Classify] Clasificación guardada OK: id=', resultado.id, ', tipo=', resultado.tipo);

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
    // RESILIENT: try to save fallback classification even on unexpected errors
    if (documentoId) {
      await guardarClasificacionFallback(documentoId, docNombre || 'documento', docClienteId, `Error inesperado: ${error.message}`);
      return NextResponse.json({
        documento: { id: documentoId, tipo: 'otro', estado: 'clasificado' },
        cliente_match: null,
        fallback: true,
        fallback_reason: 'unexpected_error',
      });
    }
    const detail = error instanceof DocumentoError
      ? `${error.message} — ${JSON.stringify(error.details)}`
      : (error.message ?? 'Error desconocido');
    return NextResponse.json(
      { error: `Error al clasificar: ${detail}` },
      { status: 500 }
    );
  }
}
