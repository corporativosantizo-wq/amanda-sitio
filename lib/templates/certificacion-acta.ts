// ============================================================================
// lib/templates/certificacion-acta.ts
// Certificación Notarial de Punto de Acta — JSZip template approach
// Código de Notariado de Guatemala Art. 60-63: texto corrido, sin espacios
// ============================================================================

import JSZip from 'jszip';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { fechaATextoLegal } from '@/lib/utils/fechas-letras';
import { dpiTextoLegal } from '@/lib/utils/dpi-letras';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PuntoCertificar {
  numero: number;
  titulo: string;
  contenido_literal: string;
}

export interface DatosCertificacionActa {
  entidad: string;
  tipo_entidad?: string;
  tipo_asamblea?: string; // "Asamblea General Ordinaria", "Asamblea General Extraordinaria", etc.
  numero_acta: number | null;
  fecha_acta: string;
  hora_acta?: string;
  lugar_acta?: string;
  presidente_asamblea?: string;
  secretario_asamblea?: string;
  convocatoria?: string;
  puntos_certificar: PuntoCertificar[];
  requirente: {
    nombre: string;
    dpi?: string;
    calidad: string;
  };
  fecha_certificacion?: string;
  lugar_certificacion?: string;
  hora_certificacion?: string;
}

// ── Notario data ───────────────────────────────────────────────────────────

const NOTARIO_NOMBRE = 'SOAZIG AMANDA SANTIZO CALDERÓN';
const NOTARIO_DIRECCION = 'doce (12) calle uno guión veinticinco (1-25) zona diez (10), Edificio Géminis Diez, Torre Sur, cuarto (4°) nivel, Oficina cuatrocientos dos (402)';
const NOTARIO_CIUDAD = 'Guatemala';

// ── XML helpers ────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Normal run — Times New Roman 12pt */
function run(text: string): string {
  return `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

/** Bold run */
function bold(text: string): string {
  return `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

/** Bold + underline run */
function boldUnder(text: string): string {
  return `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/><w:u w:val="single"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

/** Underline run */
function under(text: string): string {
  return `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:u w:val="single"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

/** Italic run (for literal quotes) */
function italic(text: string): string {
  return `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:i/><w:iCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

/** Justified paragraph with 480 twip exact line spacing (notarial) */
function para(...runs: string[]): string {
  return `<w:p><w:pPr><w:jc w:val="both"/><w:spacing w:line="480" w:lineRule="exact"/></w:pPr>${runs.join('')}</w:p>`;
}

/** Centered paragraph */
function paraCenter(...runs: string[]): string {
  return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:line="480" w:lineRule="exact"/></w:pPr>${runs.join('')}</w:p>`;
}

/** Empty paragraph (blank line with same spacing) */
function emptyPara(): string {
  return `<w:p><w:pPr><w:spacing w:line="480" w:lineRule="exact"/></w:pPr></w:p>`;
}

// ── Build title ────────────────────────────────────────────────────────────

function buildTitle(datos: DatosCertificacionActa): string {
  const tipoAsamblea = datos.tipo_asamblea ?? 'ASAMBLEA GENERAL';
  const puntosCount = datos.puntos_certificar.length;
  const puntoStr = puntosCount === 1 ? 'PUNTO' : 'PUNTOS';
  const entidadUpper = datos.entidad.toUpperCase();
  const tipoEntidadUpper = datos.tipo_entidad ? `, ${datos.tipo_entidad.toUpperCase()}` : '';

  return `ACTA NOTARIAL QUE CONTIENE CERTIFICACIÓN DE ${puntoStr} DE ACTA DE ${tipoAsamblea.toUpperCase()} DE LA ENTIDAD DENOMINADA ${entidadUpper}${tipoEntidadUpper}`;
}

// ── Document body builder ──────────────────────────────────────────────────

function buildDocumentBody(datos: DatosCertificacionActa): string {
  const fechaCert = datos.fecha_certificacion ?? new Date().toISOString().split('T')[0];
  const lugarCert = datos.lugar_certificacion ?? `la ciudad de ${NOTARIO_CIUDAD}`;
  const horaCert = datos.hora_certificacion ?? 'las diez horas';

  const parts: string[] = [];

  // ── Título (centrado, bold+underline) ──
  parts.push(paraCenter(boldUnder(buildTitle(datos))));

  // ── Cuerpo: UN SOLO párrafo continuo (Código de Notariado Art. 60-63) ──
  const r: string[] = [];

  // Comparecencia
  r.push(run(`En ${lugarCert}, siendo ${horaCert} del día ${fechaATextoLegal(fechaCert)}, yo, `));
  r.push(bold(NOTARIO_NOMBRE));
  r.push(run(`, Notaria, con oficina profesional ubicada en ${NOTARIO_DIRECCION}, de esta ciudad, a requerimiento de `));
  r.push(bold(datos.requirente.nombre.toUpperCase()));

  if (datos.requirente.dpi) {
    r.push(run(', quien se identifica con Documento Personal de Identificación —DPI— con Código Único de Identificación —CUI— número: '));
    r.push(bold(dpiTextoLegal(datos.requirente.dpi)));
  }

  r.push(run(', quien actúa en su calidad de '));
  r.push(bold(datos.requirente.calidad));
  r.push(run(' de la entidad denominada '));
  r.push(boldUnder(datos.entidad.toUpperCase()));
  if (datos.tipo_entidad) r.push(run(`, ${datos.tipo_entidad}`));

  // Presentación del libro + solicitud de certificación (texto corrido)
  const actaNumText = datos.numero_acta !== null
    ? `número ${datos.numero_acta}`
    : 'correspondiente';

  r.push(run(', quien me presenta el Libro de Actas de la entidad, y me requiere que certifique el contenido del Acta '));
  r.push(run(`${actaNumText}, de fecha ${fechaATextoLegal(datos.fecha_acta)}`));
  if (datos.hora_acta) r.push(run(`, celebrada a ${datos.hora_acta}`));
  if (datos.lugar_acta) r.push(run(`, en ${datos.lugar_acta}`));

  // Transcripción literal — TODO de corrido, sin "PUNTO X:"
  if (datos.puntos_certificar.length === 1) {
    const punto = datos.puntos_certificar[0];
    r.push(run(', y que dicho punto literalmente dice: '));
    r.push(italic(`«${punto.contenido_literal}»`));
  } else {
    r.push(run(', y que los puntos solicitados literalmente dicen: '));
    // Concatenar todos los puntos de corrido entre « »
    const textoCompleto = datos.puntos_certificar
      .map((p: PuntoCertificar) => p.contenido_literal)
      .join(' ');
    r.push(italic(`«${textoCompleto}»`));
  }

  // Cierre notarial — texto corrido, sin TERCERO ni DOY FE
  r.push(run('. Yo, la Notaria, doy fe: a) que tuve a la vista el Libro de Actas de la entidad '));
  r.push(boldUnder(datos.entidad.toUpperCase()));
  r.push(run('; b) que lo transcrito es copia fiel de su original; c) que tuve a la vista el Documento Personal de Identificación del requirente. No habiendo más que hacer constar, se finaliza la presente en el mismo lugar y fecha de su inicio, quedando enterados de su contenido, objeto, validez y efectos legales, la aceptan, ratifican y firman.'));

  // Emit the single body paragraph
  parts.push(para(...r));

  // ── Firmas ──
  parts.push(emptyPara());
  parts.push(emptyPara());
  parts.push(emptyPara());

  parts.push(paraCenter(run('f)_______________________________')));
  parts.push(paraCenter(bold(datos.requirente.nombre.toUpperCase())));
  parts.push(paraCenter(run(datos.requirente.calidad.toUpperCase())));

  parts.push(emptyPara());
  parts.push(emptyPara());
  parts.push(emptyPara());

  parts.push(paraCenter(run('ANTE MÍ:')));

  parts.push(emptyPara());
  parts.push(emptyPara());
  parts.push(emptyPara());

  parts.push(paraCenter(run('f)_______________________________')));
  parts.push(paraCenter(bold(NOTARIO_NOMBRE)));
  parts.push(paraCenter(run('NOTARIA')));

  return parts.join('');
}

// ── Main: generate DOCX from template ──────────────────────────────────────

export async function generarCertificacionDocx(datos: DatosCertificacionActa): Promise<Buffer> {
  // 1. Read template
  const templatePath = join(process.cwd(), 'lib', 'templates', 'certificacion-acta-base.docx');
  const templateBuffer = await readFile(templatePath);

  // 2. Unpack with JSZip
  const zip = await JSZip.loadAsync(templateBuffer);

  // 3. Read document.xml
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) throw new Error('Template inválido: no contiene word/document.xml');
  const docXml = await docXmlFile.async('string');

  // 4. Extract <w:sectPr> from the body (must preserve it at end)
  const sectPrMatch = docXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  const sectPr = sectPrMatch ? sectPrMatch[0] : '';

  // 5. Build new body content
  const bodyContent = buildDocumentBody(datos);

  // 6. Replace <w:body>...</w:body> keeping sectPr
  const newBody = `<w:body>${bodyContent}${sectPr}</w:body>`;
  const newDocXml = docXml.replace(/<w:body>[\s\S]*<\/w:body>/, newBody);

  // 7. Update document.xml in zip
  zip.file('word/document.xml', newDocXml);

  // 8. Repack
  const output = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return output;
}

// ── DOCX text extraction (for DOCX upload → AI extraction) ─────────────────

export async function extraerTextoDocx(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) throw new Error('Archivo DOCX inválido: no contiene word/document.xml');

  const xml = await docXmlFile.async('string');

  // Strip XML tags, keeping text content. Replace paragraph breaks with newlines.
  const text = xml
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}
