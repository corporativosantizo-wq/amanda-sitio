#!/usr/bin/env node
// ============================================================================
// scripts/procesar-jurisprudencia.js
// Procesa PDFs de tomos de jurisprudencia: extrae texto, genera embeddings
// con OpenAI, y guarda fragmentos en Supabase (schema legal).
//
// Uso:
//   node scripts/procesar-jurisprudencia.js ./tomos/
//   node scripts/procesar-jurisprudencia.js ./tomo-1.pdf
// ============================================================================

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { createClient } = require('@supabase/supabase-js');

// ── Config ──────────────────────────────────────────────────────────────────

// Load .env.local
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error('ERROR: Falta OPENAI_API_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: 'legal' },
});

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 20;
const TARGET_WORDS = 500;

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Split text into chunks of ~TARGET_WORDS, respecting paragraph boundaries.
 * Won't cut mid-sentence.
 */
function chunkText(text, targetWords = TARGET_WORDS) {
  // Normalize whitespace, split into paragraphs
  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 20); // skip tiny fragments

  const chunks = [];
  let current = [];
  let wordCount = 0;

  for (const para of paragraphs) {
    const paraWords = para.split(/\s+/).length;

    // If adding this paragraph exceeds 1.5x target AND we have content, flush
    if (wordCount > 0 && wordCount + paraWords > targetWords * 1.5) {
      chunks.push(current.join('\n\n'));
      current = [para];
      wordCount = paraWords;
    } else {
      current.push(para);
      wordCount += paraWords;

      // If we reached the target, flush
      if (wordCount >= targetWords) {
        chunks.push(current.join('\n\n'));
        current = [];
        wordCount = 0;
      }
    }
  }

  // Remaining content
  if (current.length > 0) {
    const remaining = current.join('\n\n');
    // If too small and there's a previous chunk, append to it
    if (wordCount < targetWords * 0.3 && chunks.length > 0) {
      chunks[chunks.length - 1] += '\n\n' + remaining;
    } else {
      chunks.push(remaining);
    }
  }

  return chunks;
}

/**
 * Generate embeddings for an array of texts using OpenAI API.
 * Processes in batches of BATCH_SIZE.
 */
async function generateEmbeddings(texts) {
  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: batch,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    // Sort by index to maintain order
    const sorted = data.data.sort((a, b) => a.index - b.index);
    for (const item of sorted) {
      allEmbeddings.push(item.embedding);
    }

    // Rate limiting: small delay between batches
    if (i + BATCH_SIZE < texts.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return allEmbeddings;
}

/**
 * Estimate page number for a chunk based on its position in the text.
 */
function estimatePages(chunkIndex, totalChunks, totalPages) {
  const startPage = Math.floor((chunkIndex / totalChunks) * totalPages) + 1;
  const endPage = Math.min(
    Math.floor(((chunkIndex + 1) / totalChunks) * totalPages) + 1,
    totalPages
  );
  return { startPage, endPage };
}

// ── Main Processing ─────────────────────────────────────────────────────────

async function processPDF(pdfPath, tomoIndex, totalTomos) {
  const filename = path.basename(pdfPath);
  const prefix = `[Tomo ${tomoIndex}/${totalTomos}]`;

  // Validate path: resolve to absolute and ensure it's a real .pdf file
  const resolvedPdf = path.resolve(pdfPath);
  if (!resolvedPdf.toLowerCase().endsWith('.pdf')) {
    console.error(`${prefix} Ruta no es un archivo PDF: ${resolvedPdf}`);
    return { error: 'not_pdf' };
  }
  if (!fs.existsSync(resolvedPdf)) {
    console.error(`${prefix} Archivo no encontrado: ${resolvedPdf}`);
    return { error: 'not_found' };
  }

  console.log(`\n${prefix} Procesando: ${filename}`);

  // Check if already processed
  const { data: existing } = await supabase
    .from('jurisprudencia_tomos')
    .select('id, procesado')
    .eq('archivo_nombre', filename)
    .maybeSingle();

  if (existing?.procesado) {
    console.log(`${prefix} Ya procesado, saltando.`);
    return { skipped: true };
  }

  // Read and parse PDF
  console.log(`${prefix} Extrayendo texto del PDF...`);
  const pdfBuffer = fs.readFileSync(resolvedPdf);
  const pdf = await pdfParse(pdfBuffer);
  const text = pdf.text;
  const totalPages = pdf.numpages;

  if (!text || text.trim().length < 100) {
    console.log(`${prefix} PDF sin texto suficiente (${text?.length ?? 0} chars). Saltando.`);
    return { skipped: true, reason: 'no_text' };
  }

  console.log(`${prefix} ${totalPages} páginas, ${text.length} caracteres extraídos.`);

  // Create or update tomo record
  let tomoId;
  if (existing) {
    tomoId = existing.id;
    await supabase
      .from('jurisprudencia_tomos')
      .update({ total_paginas: totalPages, procesado: false })
      .eq('id', tomoId);
  } else {
    // Extract tomo name from filename: "Tomo 1.pdf" → "Tomo 1"
    const tomoNombre = filename.replace(/\.pdf$/i, '').trim();

    const { data: tomo, error: tomoErr } = await supabase
      .from('jurisprudencia_tomos')
      .insert({
        nombre: tomoNombre,
        archivo_nombre: filename,
        total_paginas: totalPages,
        procesado: false,
      })
      .select('id')
      .single();

    if (tomoErr) {
      console.error(`${prefix} Error creando tomo:`, tomoErr.message);
      return { error: tomoErr.message };
    }
    tomoId = tomo.id;
  }

  // Delete existing fragments (for re-processing)
  await supabase
    .from('jurisprudencia_fragmentos')
    .delete()
    .eq('tomo_id', tomoId);

  // Chunk the text
  const chunks = chunkText(text);
  console.log(`${prefix} ${chunks.length} fragmentos generados.`);

  // Generate embeddings in batches
  console.log(`${prefix} Generando embeddings (lotes de ${BATCH_SIZE})...`);
  const embeddings = await generateEmbeddings(chunks);

  // Insert fragments
  console.log(`${prefix} Guardando fragmentos en Supabase...`);
  let saved = 0;

  for (let i = 0; i < chunks.length; i++) {
    const { startPage, endPage } = estimatePages(i, chunks.length, totalPages);
    const wordCount = chunks[i].split(/\s+/).length;

    const { error: fragErr } = await supabase
      .from('jurisprudencia_fragmentos')
      .insert({
        tomo_id: tomoId,
        contenido: chunks[i],
        embedding: JSON.stringify(embeddings[i]),
        pagina_inicio: startPage,
        pagina_fin: endPage,
        numero_fragmento: i + 1,
        total_palabras: wordCount,
      });

    if (fragErr) {
      console.error(`${prefix} Error en fragmento ${i + 1}:`, fragErr.message);
    } else {
      saved++;
    }

    // Progress every 50 fragments
    if ((i + 1) % 50 === 0 || i === chunks.length - 1) {
      process.stdout.write(`\r${prefix} [Fragmento ${i + 1}/${chunks.length}] Guardado...`);
    }
  }

  console.log(`\n${prefix} ${saved}/${chunks.length} fragmentos guardados.`);

  // Mark tomo as processed
  await supabase
    .from('jurisprudencia_tomos')
    .update({
      procesado: true,
      total_fragmentos: saved,
    })
    .eq('id', tomoId);

  console.log(`${prefix} Tomo marcado como procesado.`);
  return { saved, total: chunks.length };
}

// ── Entry Point ─────────────────────────────────────────────────────────────

async function main() {
  const inputPath = process.argv[2];

  if (!inputPath) {
    console.log('Uso: node scripts/procesar-jurisprudencia.js <ruta-pdf-o-carpeta>');
    console.log('  node scripts/procesar-jurisprudencia.js ./tomos/');
    console.log('  node scripts/procesar-jurisprudencia.js ./tomo-1.pdf');
    process.exit(1);
  }

  const resolved = path.resolve(inputPath);

  if (!fs.existsSync(resolved)) {
    console.error(`ERROR: No se encontró: ${resolved}`);
    process.exit(1);
  }

  // Collect PDF files
  let pdfFiles = [];
  const stat = fs.statSync(resolved);

  if (stat.isDirectory()) {
    const files = fs.readdirSync(resolved)
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .sort();
    pdfFiles = files.map(f => path.join(resolved, f));
  } else if (resolved.toLowerCase().endsWith('.pdf')) {
    pdfFiles = [resolved];
  } else {
    console.error('ERROR: El archivo debe ser PDF.');
    process.exit(1);
  }

  if (pdfFiles.length === 0) {
    console.error('ERROR: No se encontraron archivos PDF.');
    process.exit(1);
  }

  console.log(`\n=== Procesador de Jurisprudencia ===`);
  console.log(`PDFs encontrados: ${pdfFiles.length}`);
  console.log(`Modelo de embeddings: ${EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS} dims)`);
  console.log(`Tamaño de fragmento: ~${TARGET_WORDS} palabras`);
  console.log(`Lote de embeddings: ${BATCH_SIZE}\n`);

  const results = { processed: 0, skipped: 0, errors: 0, totalFragments: 0 };

  for (let i = 0; i < pdfFiles.length; i++) {
    try {
      const result = await processPDF(pdfFiles[i], i + 1, pdfFiles.length);
      if (result.skipped) {
        results.skipped++;
      } else if (result.error) {
        results.errors++;
      } else {
        results.processed++;
        results.totalFragments += result.saved;
      }
    } catch (err) {
      console.error(`\nERROR procesando ${path.basename(pdfFiles[i])}:`, err.message);
      results.errors++;
    }
  }

  console.log(`\n=== Resumen ===`);
  console.log(`Procesados: ${results.processed}`);
  console.log(`Saltados (ya procesados): ${results.skipped}`);
  console.log(`Errores: ${results.errors}`);
  console.log(`Total fragmentos guardados: ${results.totalFragments}`);
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
