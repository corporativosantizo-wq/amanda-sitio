// ============================================================================
// lib/templates/certificacion-acta.ts
// Certificación Notarial de Punto de Acta — JSZip template approach
// Unpack base DOCX → replace <w:body> content → repack
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

// ── Document body builder ──────────────────────────────────────────────────

function buildDocumentBody(datos: DatosCertificacionActa): string {
  const fechaCert = datos.fecha_certificacion ?? new Date().toISOString().split('T')[0];
  const lugarCert = datos.lugar_certificacion ?? `la ciudad de ${NOTARIO_CIUDAD}`;
  const horaCert = datos.hora_certificacion ?? 'las diez horas';

  const parts: string[] = [];

  // ── Título ──
  parts.push(paraCenter(boldUnder('ACTA NOTARIAL DE CERTIFICACIÓN')));
  parts.push(emptyPara());

  // ── Encabezado / Comparecencia ──
  const requirenteDpiText = datos.requirente.dpi
    ? run(', quien se identifica con Documento Personal de Identificación —DPI— con Código Único de Identificación —CUI— número: ')
      + bold(dpiTextoLegal(datos.requirente.dpi))
    : '';

  parts.push(para(
    run(`En ${lugarCert}, siendo ${horaCert} del día ${fechaATextoLegal(fechaCert)}, yo, `),
    bold(NOTARIO_NOMBRE),
    run(`, Notaria, con oficina profesional ubicada en ${NOTARIO_DIRECCION}, de esta ciudad, a requerimiento de `),
    bold(datos.requirente.nombre.toUpperCase()),
    requirenteDpiText,
    run(', quien actúa en su calidad de '),
    bold(datos.requirente.calidad),
    run(' de la entidad denominada '),
    boldUnder(datos.entidad.toUpperCase()),
    datos.tipo_entidad ? run(`, ${datos.tipo_entidad}`) : '',
    run(', procedo a dar fe de lo siguiente: '),
  ));

  // ── PRIMERO: Presentación del libro ──
  const actaNumText = datos.numero_acta !== null
    ? `número ${datos.numero_acta}`
    : 'correspondiente';

  parts.push(para(
    under('PRIMERO:'),
    run(' El requirente me presenta el Libro de Actas de '),
    boldUnder(datos.entidad.toUpperCase()),
    run(`, y me solicita que certifique el contenido del Acta ${actaNumText}, de fecha ${fechaATextoLegal(datos.fecha_acta)}`),
    datos.hora_acta ? run(`, celebrada a ${datos.hora_acta}`) : '',
    datos.lugar_acta ? run(`, en ${datos.lugar_acta}`) : '',
    run('. '),
  ));

  // ── SEGUNDO: Transcripción literal ──
  if (datos.puntos_certificar.length === 1) {
    const punto = datos.puntos_certificar[0];
    parts.push(para(
      under('SEGUNDO:'),
      run(` El punto ${punto.numero} de la referida acta, relativo a `),
      bold(punto.titulo),
      run(', literalmente dice: '),
      italic(`«${punto.contenido_literal}»`),
      run('. '),
    ));
  } else {
    parts.push(para(
      under('SEGUNDO:'),
      run(' Los puntos solicitados de la referida acta, literalmente dicen: '),
    ));

    for (const punto of datos.puntos_certificar) {
      parts.push(para(
        bold(`PUNTO ${punto.numero}: `),
        bold(punto.titulo),
        run('. '),
        italic(`«${punto.contenido_literal}»`),
        run('. '),
      ));
    }
  }

  // ── TERCERO: DOY FE ──
  parts.push(para(
    under('TERCERO:'),
    run(' Yo, la Notaria, '),
    bold('DOY FE: '),
    run('a) De todo lo expuesto; b) Que tuve a la vista el Libro de Actas de la entidad '),
    boldUnder(datos.entidad.toUpperCase()),
    run('; c) Que lo transcrito concuerda fielmente con su original; d) Que tuve a la vista el Documento Personal de Identificación del requirente. Leo lo escrito al requirente, quien enterado de su contenido, objeto, validez y efectos legales, lo acepta, ratifica y firma.'),
  ));

  parts.push(emptyPara());
  parts.push(emptyPara());
  parts.push(emptyPara());

  // ── Firmas ──
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
