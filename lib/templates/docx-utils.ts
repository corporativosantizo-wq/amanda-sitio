// ============================================================================
// lib/templates/docx-utils.ts
// Utilidades compartidas para generación de documentos Word legales
// ============================================================================

import {
  Document,
  Paragraph,
  TextRun,
  AlignmentType,
  convertMillimetersToTwip,
  LineRuleType,
  type ISectionOptions,
  type IRunOptions,
} from 'docx';
import { montoALetras } from '@/lib/utils/numeros-letras';

// ── Constantes de formato ─────────────────────────────────────────────────

export const FONT = 'Times New Roman';
export const SIZE_BODY = 24;   // half-points → 12pt
export const SIZE_TITLE = 28;  // half-points → 14pt
export const SIZE_SMALL = 20;  // half-points → 10pt

const MARGIN = convertMillimetersToTwip(25); // 2.5cm

export const LINE_SPACING = { line: 360, rule: LineRuleType.AUTO }; // 1.5x
// Notarial: ~25 líneas por página. Página A4 = 297mm - 50mm margins = 247mm usable
// 247mm / 25 = ~9.88mm per line → ~396 twips
export const LINE_SPACING_NOTARIAL = { line: 396, rule: LineRuleType.AUTO };

export const SECTION_PROPS: ISectionOptions['properties'] = {
  page: {
    margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
  },
};

// ── Run builders ──────────────────────────────────────────────────────────

function runOpts(overrides?: Partial<IRunOptions>): IRunOptions {
  return { font: FONT, size: SIZE_BODY, ...overrides };
}

export function normalRun(text: string): TextRun {
  return new TextRun(runOpts({ text }));
}

export function boldRun(text: string): TextRun {
  return new TextRun(runOpts({ text, bold: true }));
}

/** Nombre legal en MAYÚSCULAS NEGRITAS */
export function legalName(name: string): TextRun {
  return new TextRun(runOpts({ text: name.toUpperCase(), bold: true }));
}

/** Monto en letras + cifra: "CINCO MIL QUETZALES EXACTOS (Q5,000.00)" */
export function legalAmount(amount: number): string {
  const letras = montoALetras(amount);
  const cifra = amount.toLocaleString('es-GT', { minimumFractionDigits: 2 });
  return `${letras} (Q${cifra})`;
}

// ── Paragraph builders ────────────────────────────────────────────────────

/** Título centrado en negritas */
export function titleParagraph(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200, ...LINE_SPACING },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, font: FONT, size: SIZE_TITLE })],
  });
}

/** Subtítulo centrado */
export function subtitleParagraph(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200, ...LINE_SPACING },
    children: [new TextRun({ text, bold: true, font: FONT, size: SIZE_BODY })],
  });
}

/** Párrafo de cuerpo con texto simple */
export function bodyParagraph(text: string, opts?: { bold?: boolean; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; notarial?: boolean }): Paragraph {
  return new Paragraph({
    alignment: opts?.alignment ?? AlignmentType.JUSTIFIED,
    spacing: { after: 120, ...(opts?.notarial ? LINE_SPACING_NOTARIAL : LINE_SPACING) },
    children: [new TextRun(runOpts({ text, bold: opts?.bold }))],
  });
}

/** Párrafo con múltiples TextRuns (para mezclar normal y bold) */
export function mixedParagraph(runs: TextRun[], opts?: { alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; notarial?: boolean }): Paragraph {
  return new Paragraph({
    alignment: opts?.alignment ?? AlignmentType.JUSTIFIED,
    spacing: { after: 120, ...(opts?.notarial ? LINE_SPACING_NOTARIAL : LINE_SPACING) },
    children: runs,
  });
}

/** Sección con título en mayúsculas (para amparos, demandas) */
export function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 300, after: 200, ...LINE_SPACING },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, font: FONT, size: SIZE_BODY })],
  });
}

/** Línea vacía */
export function emptyLine(): Paragraph {
  return new Paragraph({ spacing: { after: 120 }, children: [] });
}

/** Bloque de firma */
export function signatureBlock(name: string, title?: string): Paragraph[] {
  return [
    emptyLine(),
    emptyLine(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '____________________________', font: FONT, size: SIZE_BODY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: name.toUpperCase(), bold: true, font: FONT, size: SIZE_BODY })],
    }),
    ...(title
      ? [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: title, font: FONT, size: SIZE_SMALL })],
        })]
      : []),
  ];
}

/** Punto/hecho numerado */
export function numberedItem(num: number, text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, ...LINE_SPACING },
    indent: { left: convertMillimetersToTwip(10) },
    children: [
      boldRun(`${num}. `),
      normalRun(text),
    ],
  });
}

/** Datos de persona física formateados */
export function personaTexto(p: { nombre: string; edad?: string; estado_civil?: string; nacionalidad?: string; profesion?: string; dpi?: string; direccion?: string }): TextRun[] {
  const runs: TextRun[] = [legalName(p.nombre)];
  const parts: string[] = [];
  if (p.edad) parts.push(`de ${p.edad} años de edad`);
  if (p.estado_civil) parts.push(p.estado_civil.toLowerCase());
  if (p.nacionalidad) parts.push(p.nacionalidad.toLowerCase());
  if (p.profesion) parts.push(p.profesion.toLowerCase());
  if (parts.length > 0) {
    runs.push(normalRun(`, ${parts.join(', ')}`));
  }
  if (p.dpi) {
    runs.push(normalRun(`, con Documento Personal de Identificación con Código Único de Identificación número `));
    runs.push(boldRun(p.dpi));
  }
  if (p.direccion) {
    runs.push(normalRun(`, de esta vecindad, con domicilio en ${p.direccion}`));
  }
  return runs;
}

// ── Document builder ──────────────────────────────────────────────────────

export function buildDocument(children: Paragraph[], opts?: { notarial?: boolean }): Document {
  return new Document({
    creator: 'Amanda Santizo & Asociados — IURISLEX',
    description: 'Documento legal generado por IURISLEX',
    sections: [{
      properties: SECTION_PROPS,
      children,
    }],
  });
}
