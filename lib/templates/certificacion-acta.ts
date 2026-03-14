// ============================================================================
// lib/templates/certificacion-acta.ts
// Certificación Notarial de Punto de Acta de Asamblea
// Formato: notarial (~25 líneas/página), Times New Roman 12pt
// ============================================================================

import { Document, Paragraph, TextRun, UnderlineType } from 'docx';
import {
  buildDocument, titleParagraph, mixedParagraph, emptyLine,
  signatureBlock, normalRun, boldRun, legalName,
  SECTION_PROPS, LINE_SPACING_NOTARIAL, FONT, SIZE_BODY,
} from './docx-utils';
import { fechaATextoLegal } from '@/lib/utils/fechas-letras';
import { dpiTextoLegal } from '@/lib/utils/dpi-letras';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PuntoCertificar {
  numero: number;
  titulo: string;
  contenido_literal: string;
}

export interface DatosCertificacionActa {
  // Entidad
  entidad: string;
  tipo_entidad?: string;

  // Acta
  numero_acta: number | null;
  fecha_acta: string;
  hora_acta?: string;
  lugar_acta?: string;

  // Asamblea
  presidente_asamblea?: string;
  secretario_asamblea?: string;
  convocatoria?: string;

  // Puntos a certificar
  puntos_certificar: PuntoCertificar[];

  // Requirente
  requirente: {
    nombre: string;
    dpi?: string;
    calidad: string; // "Representante Legal", "Presidente", etc.
  };

  // Certificación
  fecha_certificacion?: string; // YYYY-MM-DD, defaults to today
  lugar_certificacion?: string;
  hora_certificacion?: string;
}

// ── Notario data ───────────────────────────────────────────────────────────

const NOTARIO_NOMBRE = 'SOAZIG AMANDA SANTIZO CALDERÓN';
const NOTARIO_DIRECCION = 'doce (12) calle uno guión veinticinco (1-25) zona diez (10), Edificio Géminis Diez, Torre Sur, cuarto (4°) nivel, Oficina cuatrocientos dos (402)';
const NOTARIO_CIUDAD = 'Guatemala';

// ── Helpers ────────────────────────────────────────────────────────────────

function underlineRun(text: string): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: SIZE_BODY,
    underline: { type: UnderlineType.SINGLE },
  });
}

function boldUnderlineRun(text: string): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: SIZE_BODY,
    bold: true,
    underline: { type: UnderlineType.SINGLE },
  });
}

/** Comillas francesas: «texto» */
function comillasFrancesas(text: string): string {
  return `«${text}»`;
}

// ── Generator ──────────────────────────────────────────────────────────────

export function generarCertificacionActa(datos: DatosCertificacionActa): Document {
  const fechaCert = datos.fecha_certificacion ?? new Date().toISOString().split('T')[0];
  const lugarCert = datos.lugar_certificacion ?? `la ciudad de ${NOTARIO_CIUDAD}`;
  const horaCert = datos.hora_certificacion ?? 'las diez horas';

  const children: Paragraph[] = [];

  // ── Título ──
  children.push(titleParagraph('ACTA NOTARIAL DE CERTIFICACIÓN'));
  children.push(emptyLine());

  // ── Encabezado / Comparecencia ──
  const requirenteDpiText = datos.requirente.dpi
    ? [
        normalRun(', quien se identifica con Documento Personal de Identificación —DPI— con Código Único de Identificación —CUI— número: '),
        boldRun(dpiTextoLegal(datos.requirente.dpi)),
      ]
    : [];

  children.push(mixedParagraph([
    normalRun(`En ${lugarCert}, siendo ${horaCert} del día ${fechaATextoLegal(fechaCert)}, yo, `),
    legalName(NOTARIO_NOMBRE),
    normalRun(`, Notaria, con oficina profesional ubicada en ${NOTARIO_DIRECCION}, de esta ciudad, a requerimiento de `),
    legalName(datos.requirente.nombre),
    ...requirenteDpiText,
    normalRun(`, quien actúa en su calidad de `),
    boldRun(datos.requirente.calidad),
    normalRun(` de la entidad denominada `),
    legalName(datos.entidad),
    ...(datos.tipo_entidad ? [normalRun(`, ${datos.tipo_entidad}`)] : []),
    normalRun(', procedo a dar fe de lo siguiente:'),
  ], { notarial: true }));

  children.push(emptyLine());

  // ── PRIMERO: Presentación del libro ──
  const acta_num_text = datos.numero_acta !== null
    ? `número ${datos.numero_acta}`
    : 'correspondiente';

  children.push(mixedParagraph([
    boldUnderlineRun('PRIMERO:'),
    normalRun(' El requirente me presenta el Libro de Actas de '),
    legalName(datos.entidad),
    normalRun(`, y me solicita que certifique el contenido del Acta ${acta_num_text}, de fecha ${fechaATextoLegal(datos.fecha_acta)}`),
    ...(datos.hora_acta ? [normalRun(`, celebrada a ${datos.hora_acta}`)] : []),
    ...(datos.lugar_acta ? [normalRun(`, en ${datos.lugar_acta}`)] : []),
    normalRun('.'),
  ], { notarial: true }));

  children.push(emptyLine());

  // ── SEGUNDO: Transcripción literal ──
  if (datos.puntos_certificar.length === 1) {
    const punto = datos.puntos_certificar[0];
    children.push(mixedParagraph([
      boldUnderlineRun('SEGUNDO:'),
      normalRun(` El punto ${punto.numero} de la referida acta, relativo a `),
      boldRun(punto.titulo),
      normalRun(', literalmente dice: '),
      normalRun(comillasFrancesas(punto.contenido_literal)),
    ], { notarial: true }));
  } else {
    children.push(mixedParagraph([
      boldUnderlineRun('SEGUNDO:'),
      normalRun(' Los puntos solicitados de la referida acta, literalmente dicen:'),
    ], { notarial: true }));

    children.push(emptyLine());

    for (const punto of datos.puntos_certificar) {
      children.push(mixedParagraph([
        boldRun(`PUNTO ${punto.numero}: `),
        boldRun(punto.titulo),
        normalRun('. '),
        normalRun(comillasFrancesas(punto.contenido_literal)),
      ], { notarial: true }));
      children.push(emptyLine());
    }
  }

  children.push(emptyLine());

  // ── TERCERO: DOY FE ──
  children.push(mixedParagraph([
    boldUnderlineRun('TERCERO:'),
    normalRun(' Yo, la Notaria, '),
    boldRun('DOY FE: '),
    normalRun('a) De todo lo expuesto; b) Que tuve a la vista el Libro de Actas de la entidad '),
    legalName(datos.entidad),
    normalRun('; c) Que lo transcrito concuerda fielmente con su original; d) Que tuve a la vista el Documento Personal de Identificación del requirente. Leo lo escrito al requirente, quien enterado de su contenido, objeto, validez y efectos legales, lo acepta, ratifica y firma.'),
  ], { notarial: true }));

  children.push(emptyLine());
  children.push(emptyLine());

  // ── Firmas ──
  children.push(...signatureBlock(datos.requirente.nombre, datos.requirente.calidad.toUpperCase()));
  children.push(emptyLine());
  children.push(...signatureBlock(NOTARIO_NOMBRE, 'NOTARIA'));

  return new Document({
    creator: 'Amanda Santizo — Despacho Jurídico — IURISLEX',
    description: 'Certificación Notarial de Punto de Acta',
    sections: [{
      properties: SECTION_PROPS,
      children,
    }],
  });
}
