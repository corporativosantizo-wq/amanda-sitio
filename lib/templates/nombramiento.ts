// ============================================================================
// lib/templates/nombramiento.ts
// Acta Notarial de Nombramiento — JSZip template approach
// Código de Notariado de Guatemala Art. 60-63: texto corrido, sin espacios
// ============================================================================

import JSZip from 'jszip';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { fechaATextoLegal } from '@/lib/utils/fechas-letras';
import { dpiTextoLegal } from '@/lib/utils/dpi-letras';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ClausulaEscritura {
  numero: string;     // "SEGUNDA", "SEXTA", etc.
  titulo: string;     // "Objeto social", "Órgano de administración"
  contenido: string;  // Full text of the clause
}

export interface DatosNombramiento {
  entidad: string;
  tipo_entidad?: string;
  clausulas_transcritas: ClausulaEscritura[];

  numero_acta: number | null;
  fecha_acta: string;
  tipo_asamblea?: string;
  punto_resolutivo: string;

  requirente: {
    nombre: string;
    edad?: string;
    estado_civil?: string;
    nacionalidad?: string;
    profesion?: string;
    dpi?: string;
    direccion?: string;
    calidad: string;
  };

  cargo_nombrado: string;
  nombre_nombrado: string;

  cancelacion?: {
    nombre_anterior: string;
    cargo_anterior: string;
    registro_rm?: string;
  };

  fecha_certificacion?: string;
  lugar_certificacion?: string;
  hora_certificacion?: string;
}

// ── Notario data ───────────────────────────────────────────────────────────

const NOTARIO_NOMBRE = 'SOAZIG AMANDA SANTIZO CALDERÓN';
const NOTARIO_DIRECCION = 'doce (12) calle uno guión veinticinco (1-25) zona diez (10), Edificio Géminis Diez, Torre Sur, cuarto (4°) nivel, Oficina cuatrocientos dos (402)';
const NOTARIO_CIUDAD = 'Guatemala';

// ── Ordinales ───────────────────────────────────────────────────────────────

const ORDINALES = [
  'PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO',
  'SEXTO', 'SÉPTIMO', 'OCTAVO', 'NOVENO', 'DÉCIMO',
];

// ── XML helpers ────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function run(text: string): string {
  return `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function bold(text: string): string {
  return `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function boldUnder(text: string): string {
  return `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/><w:u w:val="single"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function italic(text: string): string {
  return `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:i/><w:iCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function para(...runs: string[]): string {
  return `<w:p><w:pPr><w:jc w:val="both"/><w:spacing w:line="480" w:lineRule="exact"/></w:pPr>${runs.join('')}</w:p>`;
}

function paraCenter(...runs: string[]): string {
  return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:line="480" w:lineRule="exact"/></w:pPr>${runs.join('')}</w:p>`;
}

function emptyPara(): string {
  return `<w:p><w:pPr><w:spacing w:line="480" w:lineRule="exact"/></w:pPr></w:p>`;
}

// ── Build title ────────────────────────────────────────────────────────────

function buildTitle(datos: DatosNombramiento): string {
  const cargo = datos.cargo_nombrado.toUpperCase();
  const entidad = datos.entidad.toUpperCase();
  const tipo = datos.tipo_entidad ? `, ${datos.tipo_entidad.toUpperCase()}` : '';
  return `ACTA NOTARIAL DE NOMBRAMIENTO DE ${cargo} DE LA ENTIDAD DENOMINADA ${entidad}${tipo}`;
}

// ── Document body builder ──────────────────────────────────────────────────

function buildDocumentBody(datos: DatosNombramiento): string {
  const fechaCert = datos.fecha_certificacion ?? new Date().toISOString().split('T')[0];
  const lugarCert = datos.lugar_certificacion ?? `la ciudad de ${NOTARIO_CIUDAD}`;
  const horaCert = datos.hora_certificacion ?? 'las diez horas';

  const parts: string[] = [];

  // ── Título ──
  parts.push(paraCenter(boldUnder(buildTitle(datos))));

  // ── Cuerpo: un solo párrafo continuo (notarial) ──
  const r: string[] = [];

  // Comparecencia
  r.push(run(`En ${lugarCert}, siendo ${horaCert} del día ${fechaATextoLegal(fechaCert)}, yo, `));
  r.push(bold(NOTARIO_NOMBRE));
  r.push(run(`, Notaria, con oficina profesional ubicada en ${NOTARIO_DIRECCION}, de esta ciudad, a requerimiento de `));
  r.push(bold(datos.requirente.nombre.toUpperCase()));

  // Datos personales del requirente
  const datosPersonales: string[] = [];
  if (datos.requirente.edad) datosPersonales.push(`de ${datos.requirente.edad} de edad`);
  if (datos.requirente.estado_civil) datosPersonales.push(datos.requirente.estado_civil);
  if (datos.requirente.nacionalidad) datosPersonales.push(datos.requirente.nacionalidad);
  if (datos.requirente.profesion) datosPersonales.push(datos.requirente.profesion);
  if (datosPersonales.length > 0) {
    r.push(run(`, ${datosPersonales.join(', ')}`));
  }

  if (datos.requirente.dpi) {
    r.push(run(', quien se identifica con Documento Personal de Identificación —DPI— con Código Único de Identificación —CUI— número: '));
    r.push(bold(dpiTextoLegal(datos.requirente.dpi)));
  }

  if (datos.requirente.direccion) {
    r.push(run(`, de esta vecindad, con domicilio en ${datos.requirente.direccion}`));
  }

  r.push(run(', quien actúa en su calidad de '));
  r.push(bold(datos.requirente.calidad));
  r.push(run(' de la entidad denominada '));
  r.push(boldUnder(datos.entidad.toUpperCase()));
  if (datos.tipo_entidad) r.push(run(`, ${datos.tipo_entidad}`));

  r.push(run(', quien me requiere que haga constar en acta notarial lo siguiente: '));

  // ── PRIMERO: Cláusulas de la escritura ──
  let ordinalIdx = 0;

  if (datos.clausulas_transcritas.length > 0) {
    r.push(bold(`${ORDINALES[ordinalIdx]}: `));
    ordinalIdx++;
    r.push(run(`Que la entidad `));
    r.push(boldUnder(datos.entidad.toUpperCase()));
    if (datos.tipo_entidad) r.push(run(`, ${datos.tipo_entidad}`));
    r.push(run(', fue constituida mediante escritura pública, la cual en sus cláusulas de interés literalmente dice: '));

    for (let i = 0; i < datos.clausulas_transcritas.length; i++) {
      const c = datos.clausulas_transcritas[i];
      r.push(bold(`Cláusula ${c.numero}: ${c.titulo}: `));
      r.push(italic(`«${c.contenido}»`));
      if (i < datos.clausulas_transcritas.length - 1) {
        r.push(run(' '));
      }
    }
    r.push(run('. '));
  }

  // ── SEGUNDO: Punto resolutivo del acta ──
  r.push(bold(`${ORDINALES[ordinalIdx]}: `));
  ordinalIdx++;

  const tipoAsamblea = datos.tipo_asamblea ?? 'Asamblea General';
  const actaNumText = datos.numero_acta !== null ? `número ${datos.numero_acta}` : 'correspondiente';

  r.push(run(`Que en ${tipoAsamblea} celebrada el día ${fechaATextoLegal(datos.fecha_acta)}, según Acta ${actaNumText}, se resolvió: `));
  r.push(italic(`«${datos.punto_resolutivo}»`));
  r.push(run('. '));

  // ── TERCERO (optional): Cancelación ──
  if (datos.cancelacion) {
    r.push(bold(`${ORDINALES[ordinalIdx]}: `));
    ordinalIdx++;
    r.push(run('Que para los efectos legales correspondientes, se solicita la cancelación de la inscripción del señor '));
    r.push(bold(datos.cancelacion.nombre_anterior.toUpperCase()));
    r.push(run(` como ${datos.cancelacion.cargo_anterior}`));
    if (datos.cancelacion.registro_rm) {
      r.push(run(` inscrito en el Registro Mercantil bajo el ${datos.cancelacion.registro_rm}`));
    }
    r.push(run('. '));
  }

  // ── Siguiente ordinal: Solicitud de inscripción ──
  r.push(bold(`${ORDINALES[ordinalIdx]}: `));
  ordinalIdx++;
  r.push(run('Que se solicita al Registro Mercantil la inscripción del señor '));
  r.push(bold(datos.nombre_nombrado.toUpperCase()));
  r.push(run(` como ${datos.cargo_nombrado} de la entidad `));
  r.push(boldUnder(datos.entidad.toUpperCase()));
  if (datos.tipo_entidad) r.push(run(`, ${datos.tipo_entidad}`));
  r.push(run('. '));

  // ── DOY FE ──
  r.push(run('Yo, la Notaria, '));
  r.push(bold('DOY FE'));
  r.push(run(': a) Que tuve a la vista el testimonio de la escritura constitutiva de la entidad '));
  r.push(boldUnder(datos.entidad.toUpperCase()));
  r.push(run('; b) Que tuve a la vista la certificación del punto de acta transcrito; c) Que tuve a la vista el Documento Personal de Identificación del requirente'));
  r.push(run('. De todo lo expuesto y del contenido íntegro de la presente acta notarial, la cual leo íntegramente al requirente, quien bien enterado de su contenido, objeto, validez y demás efectos legales, la acepta, ratifica y firma.'));

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

export async function generarNombramientoDocx(datos: DatosNombramiento): Promise<Buffer> {
  // 1. Read template (same as certificacion — has notarial margins)
  const templatePath = join(process.cwd(), 'lib', 'templates', 'certificacion-acta-base.docx');
  const templateBuffer = await readFile(templatePath);

  // 2. Unpack with JSZip
  const zip = await JSZip.loadAsync(templateBuffer);

  // 3. Read document.xml
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) throw new Error('Template inválido: no contiene word/document.xml');
  const docXml = await docXmlFile.async('string');

  // 4. Extract <w:sectPr>
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
