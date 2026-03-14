// ============================================================================
// lib/templates/acta-asamblea.ts
// Genera DOCX para Acta de Libro — acta de asamblea de accionistas
// Documento corporativo (no notarial), usa helpers de docx-utils
// ============================================================================

import { Packer } from 'docx';
import {
  titleParagraph,
  subtitleParagraph,
  bodyParagraph,
  mixedParagraph,
  emptyLine,
  signatureBlock,
  normalRun,
  boldRun,
  buildDocument,
} from './docx-utils';
import { fechaATextoLegal } from '@/lib/utils/fechas-letras';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface Accionista {
  nombre: string;
  representacion?: string;
  acciones?: string;
}

export interface PuntoAgendaActa {
  titulo: string;
  resolucion: string;
}

export interface DatosActaAsamblea {
  entidad: string;
  tipo_asamblea: string;
  numero_acta: number | null;
  fecha: string; // YYYY-MM-DD
  hora: string;
  lugar: string;
  accionistas: Accionista[];
  presidente: string;
  secretario: string;
  puntos: PuntoAgendaActa[];
}

// ── Ordinales ───────────────────────────────────────────────────────────────

const ORDINALES = [
  'PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO',
  'SEXTO', 'SÉPTIMO', 'OCTAVO', 'NOVENO', 'DÉCIMO',
];

// ── Main ────────────────────────────────────────────────────────────────────

export async function generarActaAsambleaDocx(datos: DatosActaAsamblea): Promise<Buffer> {
  const children = [];

  // ── Título ──
  const actaNum = datos.numero_acta !== null ? `ACTA NÚMERO ${datos.numero_acta}` : 'ACTA';
  children.push(titleParagraph(actaNum));
  children.push(subtitleParagraph(`${datos.tipo_asamblea.toUpperCase()} DE LA ENTIDAD ${datos.entidad.toUpperCase()}`));
  children.push(emptyLine());

  // ── Apertura ──
  const fechaTexto = fechaATextoLegal(datos.fecha);
  children.push(mixedParagraph([
    normalRun(`En ${datos.lugar}, siendo ${datos.hora} del día ${fechaTexto}, se celebra la `),
    boldRun(datos.tipo_asamblea),
    normalRun(' de la entidad denominada '),
    boldRun(datos.entidad.toUpperCase()),
    normalRun(', en la que se encuentran presentes los siguientes accionistas:'),
  ]));

  children.push(emptyLine());

  // ── Lista de accionistas ──
  for (const acc of datos.accionistas) {
    const parts = [boldRun(acc.nombre.toUpperCase())];
    if (acc.representacion) parts.push(normalRun(`, ${acc.representacion}`));
    if (acc.acciones) parts.push(normalRun(`, ${acc.acciones} acciones`));
    children.push(mixedParagraph(parts));
  }

  children.push(emptyLine());

  // ── Quórum ──
  children.push(mixedParagraph([
    normalRun('Verificado el quórum de ley, el señor '),
    boldRun(datos.presidente.toUpperCase()),
    normalRun(' en su calidad de Presidente de la Asamblea, declara legalmente instalada la sesión y le concede el uso de la palabra al señor '),
    boldRun(datos.secretario.toUpperCase()),
    normalRun(' en su calidad de Secretario Ad-Hoc, quien somete a consideración de los presentes la siguiente agenda:'),
  ]));

  children.push(emptyLine());

  // ── Agenda ──
  for (let i = 0; i < datos.puntos.length; i++) {
    const ordinal = ORDINALES[i] ?? `PUNTO ${i + 1}`;
    children.push(mixedParagraph([
      boldRun(`${ordinal}: `),
      normalRun(datos.puntos[i].titulo),
    ]));
  }

  children.push(emptyLine());

  // ── Resoluciones ──
  children.push(bodyParagraph('Puesta a discusión la agenda propuesta, la misma es aprobada por unanimidad, y se procede a resolver cada punto de la siguiente manera:'));

  children.push(emptyLine());

  for (let i = 0; i < datos.puntos.length; i++) {
    const ordinal = ORDINALES[i] ?? `PUNTO ${i + 1}`;
    const punto = datos.puntos[i];

    children.push(mixedParagraph([
      boldRun(`${ordinal}: ${punto.titulo}. `),
      normalRun(punto.resolucion),
    ]));

    children.push(emptyLine());
  }

  // ── Cierre ──
  children.push(bodyParagraph('No habiendo más que hacer constar, se da por terminada la presente en el mismo lugar y fecha de su inicio, firmando para constancia los que en ella intervinieron.'));

  // ── Firmas ──
  children.push(emptyLine());
  children.push(...signatureBlock(datos.presidente, 'Presidente de la Asamblea'));
  children.push(...signatureBlock(datos.secretario, 'Secretario Ad-Hoc'));

  const doc = buildDocument(children);
  return Buffer.from(await Packer.toBuffer(doc));
}
