// ============================================================================
// lib/services/transcripcion.service.ts
// Transcripción de documentos PDF a DOCX usando Claude IA
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { PDFDocument } from 'pdf-lib';
import {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, PageNumber, PageBreak,
} from 'docx';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  descargarPDF,
  crearDocumento,
  sanitizarNombre,
  DocumentoError,
} from './documentos.service';

const BATCH_SIZE = 3; // Pages transcribed concurrently

const PROMPTS: Record<string, string> = {
  exacta: `Transcribe este documento legal guatemalteco EXACTAMENTE como aparece, palabra por palabra. Es una escritura notarial / fotocopia antigua. Mantén la estructura original: números de escritura, comparecientes, cláusulas, firmas. Si algún texto es ilegible, indica [ilegible]. No corrijas errores ortográficos del original, transcribe exactamente como está. Responde SOLO con el texto transcrito, sin comentarios ni explicaciones.`,
  corregida: `Transcribe este documento legal guatemalteco corrigiendo errores ortográficos y de puntuación, pero manteniendo el contenido y estructura original intactos. Es una escritura notarial / fotocopia antigua. Mantén: números de escritura, comparecientes, cláusulas, firmas. Si algún texto es ilegible, indica [ilegible]. Responde SOLO con el texto transcrito corregido, sin comentarios ni explicaciones.`,
  profesional: `Transcribe y formatea profesionalmente este documento legal guatemalteco. Es una escritura notarial / fotocopia antigua. Corrige ortografía y puntuación. Estructura claramente: número de escritura, comparecientes, cláusulas numeradas, firmas. Si algún texto es ilegible, indica [ilegible]. Responde SOLO con el texto transcrito y formateado, sin comentarios ni explicaciones.`,
};

export interface TranscripcionResult {
  transcripcion: {
    id: string;
    nombre_archivo: string;
    archivo_url: string;
    paginas: number;
    download_url: string;
  };
  original_id: string;
}

export async function transcribirDocumento(
  documentoId: string,
  formato: string = 'exacta',
): Promise<TranscripcionResult> {
  if (!PROMPTS[formato]) throw new DocumentoError('Formato inválido. Use: exacta, corregida, profesional.');
  if (!process.env.ANTHROPIC_API_KEY) throw new DocumentoError('Falta ANTHROPIC_API_KEY.');

  const db = createAdminClient();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // 1. Get document from DB
  const { data: doc, error: fetchErr } = await db
    .from('documentos')
    .select('*, cliente:clientes!cliente_id(id, codigo, nombre)')
    .eq('id', documentoId)
    .single();

  if (fetchErr || !doc) throw new DocumentoError('Documento no encontrado.');

  const ext = (doc.nombre_archivo as string).toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
  if (ext !== '.pdf') throw new DocumentoError('Solo se pueden transcribir archivos PDF.');

  console.log(`[Transcribir] Iniciando: ${doc.nombre_archivo} (${formato})`);

  // 2. Download PDF from Storage
  const pdfBuffer = await descargarPDF(doc.archivo_url);
  console.log(`[Transcribir] PDF descargado: ${(pdfBuffer.length / 1024).toFixed(0)} KB`);

  // 3. Split into individual pages
  const srcDoc = await PDFDocument.load(pdfBuffer);
  const totalPages = srcDoc.getPageCount();
  console.log(`[Transcribir] ${totalPages} páginas`);

  // 4. Transcribe each page with Claude (in parallel batches)
  const pageTexts: string[] = new Array(totalPages).fill('');

  for (let batchStart = 0; batchStart < totalPages; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, totalPages);
    const batchIndices = Array.from(
      { length: batchEnd - batchStart },
      (_: unknown, i: number) => batchStart + i,
    );

    const batchResults = await Promise.all(
      batchIndices.map(async (pageIdx: number) => {
        try {
          const singlePageDoc = await PDFDocument.create();
          const [page] = await singlePageDoc.copyPages(srcDoc, [pageIdx]);
          singlePageDoc.addPage(page);
          const singlePageBytes = await singlePageDoc.save();
          const base64 = Buffer.from(singlePageBytes).toString('base64');

          const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'document',
                  source: { type: 'base64', media_type: 'application/pdf', data: base64 },
                },
                {
                  type: 'text',
                  text: `Página ${pageIdx + 1} de ${totalPages}.\n\n${PROMPTS[formato]}`,
                },
              ],
            }],
          });

          const textBlock = response.content.find((b: any) => b.type === 'text') as any;
          return { pageIdx, text: textBlock?.text ?? '' };
        } catch (err: any) {
          console.error(`[Transcribir] Error en página ${pageIdx + 1}:`, err.message);
          return { pageIdx, text: `[Error al transcribir página ${pageIdx + 1}: ${err.message}]` };
        }
      }),
    );

    for (const r of batchResults) {
      pageTexts[r.pageIdx] = r.text;
    }
    console.log(`[Transcribir] Lote completado: páginas ${batchStart + 1}-${batchEnd} de ${totalPages}`);
  }

  // 5. Generate DOCX
  const titulo = (doc.titulo ?? doc.nombre_archivo) as string;
  const fechaHoy = new Date().toLocaleDateString('es-GT', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const allParagraphs: Paragraph[] = [];

  for (let i = 0; i < pageTexts.length; i++) {
    if (i > 0) {
      allParagraphs.push(new Paragraph({ children: [new PageBreak()] }));
    }

    // Page marker
    allParagraphs.push(new Paragraph({
      children: [new TextRun({
        text: `— Página ${i + 1} de ${totalPages} —`,
        font: 'Times New Roman',
        size: 20,
        italics: true,
        color: '888888',
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }));

    // Page content
    const lines = pageTexts[i].split('\n');
    for (const line of lines) {
      allParagraphs.push(new Paragraph({
        children: [new TextRun({
          text: line,
          font: 'Times New Roman',
          size: 24, // 12pt
        })],
        spacing: { after: 120 },
      }));
    }
  }

  const docxDoc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 18720 }, // 8.5" x 13" oficio
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [new TextRun({
              text: `TRANSCRIPCIÓN — ${titulo}`,
              font: 'Times New Roman',
              size: 20,
              bold: true,
            })],
            alignment: AlignmentType.CENTER,
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [
              new TextRun({ text: `Transcrito por IURISLEX — ${fechaHoy}    Página `, font: 'Times New Roman', size: 18 }),
              new TextRun({ children: [PageNumber.CURRENT], font: 'Times New Roman', size: 18 }),
              new TextRun({ text: ' de ', font: 'Times New Roman', size: 18 }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Times New Roman', size: 18 }),
            ],
            alignment: AlignmentType.CENTER,
          })],
        }),
      },
      children: allParagraphs,
    }],
  });

  const docxBuffer = await Packer.toBuffer(docxDoc);
  console.log(`[Transcribir] DOCX generado: ${(docxBuffer.length / 1024).toFixed(0)} KB`);

  // 6. Upload DOCX to Supabase Storage
  const storage = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ).storage.from('documentos');

  const originalName = (doc.nombre_original ?? doc.nombre_archivo) as string;
  const baseName = originalName.replace(/\.[^.]+$/, '');
  const docxFileName = `${sanitizarNombre(baseName)}_transcripcion.docx`;

  const cliente = doc.cliente as any;
  const storagePath = cliente?.codigo
    ? `${cliente.codigo}/${docxFileName}`
    : `transcripciones/${docxFileName}`;

  const { error: uploadErr } = await storage.upload(storagePath, docxBuffer, {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    upsert: true,
  });

  if (uploadErr) throw new DocumentoError('Error al subir DOCX', uploadErr);
  console.log(`[Transcribir] DOCX subido: ${storagePath}`);

  // 7. Create document record linked to original
  const nuevoDoc = await crearDocumento({
    archivo_url: storagePath,
    nombre_archivo: docxFileName,
    archivo_tamano: docxBuffer.length,
    cliente_id: (doc.cliente_id as string) ?? null,
    nombre_original: `${baseName} — Transcripción.docx`,
  });

  // Update with classification info
  await db
    .from('documentos')
    .update({
      tipo: doc.tipo,
      titulo: `Transcripción — ${titulo}`,
      descripcion: `Transcripción ${formato} de "${titulo}" (${totalPages} páginas)`,
      estado: 'aprobado',
      metadata: { formato, paginas_transcritas: totalPages, documento_original_id: documentoId },
      updated_at: new Date().toISOString(),
    })
    .eq('id', nuevoDoc.id);

  // Generate download URL
  const { data: signedData } = await storage.createSignedUrl(storagePath, 600);

  console.log(`[Transcribir] Completado: ${nuevoDoc.id}`);

  return {
    transcripcion: {
      id: nuevoDoc.id,
      nombre_archivo: docxFileName,
      archivo_url: storagePath,
      paginas: totalPages,
      download_url: signedData?.signedUrl ?? '',
    },
    original_id: documentoId,
  };
}
