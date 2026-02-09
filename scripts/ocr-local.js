#!/usr/bin/env node
// ============================================================================
// scripts/ocr-local.js
// Extrae texto de PDFs en Supabase Storage y guarda en legal.documentos.texto_extraido
// Uso: node scripts/ocr-local.js
// ============================================================================

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ── Cargar .env.local ───────────────────────────────────────────────────────

const envPath = path.resolve(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('No se encontró .env.local en la raíz del proyecto.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex === -1) continue;
  const key = trimmed.slice(0, eqIndex).trim();
  const val = trimmed.slice(eqIndex + 1).trim();
  if (!process.env[key]) process.env[key] = val;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

// ── Supabase client (schema: legal) ─────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: 'legal' },
});

const storage = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Constantes ──────────────────────────────────────────────────────────────

const BATCH_SIZE = 5;
const MAX_TEXT_LENGTH = 50000;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const SIN_TEXTO = '[sin texto extraible]';

// ── Funciones ───────────────────────────────────────────────────────────────

async function obtenerPendientes() {
  const all = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('documentos')
      .select('id, nombre_archivo, archivo_url')
      .is('texto_extraido', null)
      .ilike('nombre_archivo', '%.pdf')
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`Error consultando documentos: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

async function descargarPDF(archivoUrl) {
  const { data, error } = await storage.storage
    .from('documentos')
    .download(archivoUrl);

  if (error || !data) {
    throw new Error(`Error descargando: ${error?.message || 'sin datos'}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function extraerTexto(buffer) {
  const { PDFParse } = require('pdf-parse');
  const pdf = new PDFParse({ data: buffer });
  try {
    const result = await pdf.getText();
    return (result.text || '').trim();
  } finally {
    await pdf.destroy();
  }
}

function sanitizarTexto(texto) {
  // Remove null bytes
  let clean = texto.replace(/\0/g, '');
  // Remove control characters (except newline, tab, carriage return)
  clean = clean.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Remove lone surrogates (invalid Unicode)
  clean = clean.replace(/[\uD800-\uDFFF]/g, '');
  // Remove other problematic Unicode (BOM, replacement char, etc.)
  clean = clean.replace(/[\uFFFE\uFFFF]/g, '');
  return clean;
}

async function guardarTexto(id, texto) {
  const { error } = await supabase
    .from('documentos')
    .update({ texto_extraido: texto })
    .eq('id', id);

  if (error) throw new Error(`Error guardando texto: ${error.message}`);
}

async function procesarDocumento(doc, index, total) {
  const prefix = `[${index + 1}/${total}]`;
  try {
    // Descargar
    const buffer = await descargarPDF(doc.archivo_url);

    // Verificar tamaño
    if (buffer.length > MAX_FILE_SIZE) {
      console.log(`${prefix} \u26a0\ufe0f  ${doc.nombre_archivo} (saltado: ${(buffer.length / 1024 / 1024).toFixed(1)} MB > 50 MB)`);
      await guardarTexto(doc.id, '[archivo demasiado grande]');
      return { status: 'skipped' };
    }

    // Extraer texto (con timeout de 60s para PDFs problemáticos)
    const textoRaw = await Promise.race([
      extraerTexto(buffer),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout: PDF tardó más de 60s')), 60000)),
    ]);

    const texto = sanitizarTexto(textoRaw);

    if (texto.length > 10) {
      const textoFinal = texto.slice(0, MAX_TEXT_LENGTH);
      await guardarTexto(doc.id, textoFinal);
      console.log(`${prefix} \u2705 ${doc.nombre_archivo} (${textoFinal.length.toLocaleString()} chars)`);
      return { status: 'ok' };
    } else {
      await guardarTexto(doc.id, SIN_TEXTO);
      console.log(`${prefix} \u26a0\ufe0f  ${doc.nombre_archivo} (sin texto)`);
      return { status: 'empty' };
    }
  } catch (err) {
    console.log(`${prefix} \u274c ${doc.nombre_archivo} — ${err.message}`);
    return { status: 'error' };
  }
}

async function procesarLote(docs, startIndex, total) {
  return Promise.all(
    docs.map((doc, i) => procesarDocumento(doc, startIndex + i, total))
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log(' OCR Local — Extracción de texto de PDFs');
  console.log('='.repeat(60));
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log(`Schema: legal | Tabla: documentos | Bucket: documentos\n`);

  // Obtener documentos pendientes
  console.log('Consultando documentos pendientes...');
  const docs = await obtenerPendientes();
  const total = docs.length;

  if (total === 0) {
    console.log('\n\u2705 No hay documentos pendientes de procesar.');
    return;
  }

  console.log(`\n\ud83d\udcc4 ${total.toLocaleString()} documentos pendientes\n`);

  const stats = { ok: 0, empty: 0, error: 0, skipped: 0 };
  const startTime = Date.now();

  // Procesar en lotes de BATCH_SIZE
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    const results = await procesarLote(batch, i, total);

    for (const r of results) {
      if (r.status === 'ok') stats.ok++;
      else if (r.status === 'empty') stats.empty++;
      else if (r.status === 'skipped') stats.skipped++;
      else stats.error++;
    }
  }

  // Resumen
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log(' RESUMEN');
  console.log('='.repeat(60));
  console.log(`Total procesados:  ${total.toLocaleString()}`);
  console.log(`Con texto:         ${stats.ok.toLocaleString()}`);
  console.log(`Sin texto:         ${stats.empty.toLocaleString()}`);
  console.log(`Saltados (>50MB):  ${stats.skipped.toLocaleString()}`);
  console.log(`Errores:           ${stats.error.toLocaleString()}`);
  console.log(`Tiempo:            ${elapsed}s`);
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('\nError fatal:', err.message);
  process.exit(1);
});
