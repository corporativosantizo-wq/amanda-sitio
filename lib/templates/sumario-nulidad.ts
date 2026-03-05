// ============================================================================
// lib/templates/sumario-nulidad.ts
// Juicio Sumario de Nulidad
// ============================================================================

import { Document } from 'docx';
import type { DatosSumarioNulidad } from './types';
import {
  buildDocument, titleParagraph, bodyParagraph, mixedParagraph, sectionTitle,
  emptyLine, numberedItem, normalRun, boldRun, legalName, personaTexto,
} from './docx-utils';

export function generarSumarioNulidad(datos: DatosSumarioNulidad): Document {
  const children = [
    titleParagraph('JUICIO SUMARIO DE NULIDAD'),
    emptyLine(),

    // Encabezado
    bodyParagraph(`SEÑOR JUEZ ${datos.juzgado.toUpperCase()}`, { bold: true }),
    emptyLine(),

    // Datos del actor
    mixedParagraph([
      ...personaTexto(datos.actor),
      normalRun(', señalando lugar para recibir notificaciones en '),
      normalRun(datos.actor.direccion ?? 'la ciudad de Guatemala'),
      normalRun(', ante usted respetuosamente comparezco y '),
      boldRun('EXPONGO:'),
    ]),

    emptyLine(),

    // Legitimación activa
    sectionTitle('LEGITIMACIÓN ACTIVA'),
    bodyParagraph('Comparezco en mi propio nombre y derecho, con plena capacidad para el ejercicio de mis derechos civiles.'),

    emptyLine(),

    // Auxilio profesional
    mixedParagraph([
      boldRun('AUXILIO PROFESIONAL: '),
      normalRun('Actúo bajo la dirección y procuración de la Abogada '),
      legalName('AMANDA SANTIZO BOLAÑOS'),
      normalRun('.'),
    ]),

    emptyLine(),

    // Razón de la gestión
    mixedParagraph([
      boldRun('RAZÓN DE LA GESTIÓN: '),
      normalRun('Promuevo '),
      boldRun('JUICIO SUMARIO DE NULIDAD '),
      normalRun('en contra de '),
      ...personaTexto(datos.demandado),
      normalRun(', por la nulidad del acto jurídico consistente en: '),
      boldRun(datos.acto_impugnado),
      normalRun('.'),
    ]),

    emptyLine(),
  ];

  // Terceros interesados
  if (datos.terceros_interesados && datos.terceros_interesados.length > 0) {
    children.push(sectionTitle('TERCEROS INTERESADOS'));
    datos.terceros_interesados.forEach((t: string, i: number) => {
      children.push(numberedItem(i + 1, t));
    });
    children.push(emptyLine());
  }

  // Hechos
  children.push(sectionTitle('HECHOS'));
  datos.hechos.forEach((h: string, i: number) => {
    children.push(numberedItem(i + 1, h));
  });

  children.push(emptyLine());

  // Fundamento de derecho
  children.push(sectionTitle('FUNDAMENTO DE DERECHO'));
  datos.fundamento_derecho.forEach((f: string, i: number) => {
    children.push(numberedItem(i + 1, f));
  });

  children.push(emptyLine());

  // Petición
  children.push(sectionTitle('PETICIÓN'));
  children.push(bodyParagraph('Con fundamento en lo expuesto, a usted RESPETUOSAMENTE PIDO:'));
  datos.peticion.forEach((p: string, i: number) => {
    children.push(numberedItem(i + 1, p));
  });

  children.push(emptyLine());

  // Cierre
  children.push(bodyParagraph('Acompaño los documentos justificativos y copias de ley.'));
  children.push(emptyLine());
  children.push(bodyParagraph('Guatemala, fecha de presentación.'));

  children.push(emptyLine());
  children.push(mixedParagraph([
    normalRun('EN MI AUXILIO:\n'),
    boldRun('AMANDA SANTIZO BOLAÑOS'),
    normalRun('\nAbogada y Notaria'),
  ]));

  return buildDocument(children);
}
