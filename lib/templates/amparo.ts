// ============================================================================
// lib/templates/amparo.ts
// Recurso de Amparo — estructura con secciones I-VII
// ============================================================================

import { Document } from 'docx';
import type { DatosAmparo } from './types';
import {
  buildDocument, titleParagraph, bodyParagraph, mixedParagraph, sectionTitle,
  emptyLine, numberedItem, normalRun, boldRun, legalName, personaTexto,
} from './docx-utils';

export function generarAmparo(datos: DatosAmparo): Document {
  const tribunal = datos.tribunal ?? 'CORTE DE CONSTITUCIONALIDAD';

  const children = [
    titleParagraph('ACCIÓN CONSTITUCIONAL DE AMPARO'),
    emptyLine(),

    // Encabezado
    bodyParagraph(`HONORABLE ${tribunal.toUpperCase()}`, { bold: true }),
    emptyLine(),

    // Datos del amparista
    mixedParagraph([
      ...personaTexto(datos.amparista),
      normalRun(', señalando lugar para recibir notificaciones en '),
      normalRun(datos.amparista.direccion ?? 'la ciudad de Guatemala'),
      normalRun(', ante usted respetuosamente comparezco y '),
      boldRun('EXPONGO:'),
    ]),

    emptyLine(),

    // I. ACTO RECLAMADO Y LEGITIMACIÓN PASIVA
    sectionTitle('I. ACTO RECLAMADO Y LEGITIMACIÓN PASIVA'),
    mixedParagraph([
      normalRun('El acto reclamado lo constituye: '),
      boldRun(datos.acto_reclamado),
      normalRun(', emanado de '),
      legalName(datos.autoridad_impugnada),
      normalRun('.'),
    ]),

    emptyLine(),

    // II. LEGITIMACIÓN ACTIVA
    sectionTitle('II. LEGITIMACIÓN ACTIVA'),
    bodyParagraph(datos.legitimacion_activa),

    emptyLine(),

    // III. TEMPORANEIDAD
    sectionTitle('III. TEMPORANEIDAD Y AGOTAMIENTO DE RECURSOS'),
    bodyParagraph(datos.temporaneidad ?? 'La presente acción se interpone dentro del plazo legal establecido, habiendo agotado los recursos ordinarios disponibles conforme a la ley.'),

    emptyLine(),

    // IV. DERECHO CONSTITUCIONAL AMENAZADO
    sectionTitle('IV. DERECHO CONSTITUCIONAL AMENAZADO'),
    bodyParagraph(datos.derecho_amenazado),

    emptyLine(),

    // V. DISPOSICIONES CONSTITUCIONALES VIOLADAS
    sectionTitle('V. DISPOSICIONES CONSTITUCIONALES VIOLADAS'),
  ];

  datos.disposiciones_violadas.forEach((d: string, i: number) => {
    children.push(numberedItem(i + 1, d));
  });

  children.push(emptyLine());

  // VI. CASOS DE PROCEDENCIA
  children.push(sectionTitle('VI. CASOS DE PROCEDENCIA'));
  datos.casos_procedencia.forEach((c: string, i: number) => {
    children.push(numberedItem(i + 1, c));
  });

  children.push(emptyLine());

  // VII. TERCEROS INTERESADOS
  children.push(sectionTitle('VII. TERCEROS INTERESADOS'));
  if (datos.terceros_interesados && datos.terceros_interesados.length > 0) {
    datos.terceros_interesados.forEach((t: string, i: number) => {
      children.push(numberedItem(i + 1, t));
    });
  } else {
    children.push(bodyParagraph('No existen terceros interesados en la presente acción.'));
  }

  children.push(emptyLine());

  // HECHOS
  children.push(sectionTitle('HECHOS'));
  datos.hechos.forEach((h: string, i: number) => {
    children.push(numberedItem(i + 1, h));
  });

  children.push(emptyLine());

  // PETICIÓN
  children.push(sectionTitle('PETICIÓN'));
  children.push(bodyParagraph('Con fundamento en lo expuesto, a usted RESPETUOSAMENTE PIDO:'));
  datos.peticion.forEach((p: string, i: number) => {
    children.push(numberedItem(i + 1, p));
  });

  children.push(emptyLine());

  // Cierre
  children.push(bodyParagraph('Acompaño los documentos de ley.'));
  children.push(emptyLine());
  children.push(bodyParagraph('Guatemala, fecha de presentación.'));

  children.push(emptyLine());
  children.push(mixedParagraph([
    normalRun('EN MI AUXILIO:\n'),
    boldRun('AMANDA SANTIZO BOLAÑOS'),
    normalRun('\nAbogada y Notaria'),
    normalRun('\nColegiada No. _______'),
  ]));

  return buildDocument(children);
}
