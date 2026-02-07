// ============================================================================
// lib/templates/oposicion-desestimacion.ts
// Oposición a Desestimación (Querella)
// ============================================================================

import { Document } from 'docx';
import type { DatosOposicionDesestimacion } from './types';
import {
  buildDocument, titleParagraph, bodyParagraph, mixedParagraph, sectionTitle,
  emptyLine, numberedItem, normalRun, boldRun, legalName, personaTexto,
} from './docx-utils';

export function generarOposicionDesestimacion(datos: DatosOposicionDesestimacion): Document {
  const children = [
    titleParagraph('OPOSICIÓN A DESESTIMACIÓN'),
    emptyLine(),

    // Encabezado
    bodyParagraph(`SEÑOR JUEZ ${datos.tribunal.toUpperCase()}`, { bold: true }),
    emptyLine(),

    // Referencia del expediente
    mixedParagraph([
      boldRun('EXPEDIENTE: '),
      normalRun(datos.expediente),
    ]),

    emptyLine(),

    // Datos del querellante
    mixedParagraph([
      ...personaTexto(datos.querellante),
      normalRun(', señalando lugar para recibir notificaciones en '),
      normalRun(datos.querellante.direccion ?? 'la ciudad de Guatemala'),
      normalRun(', ante usted respetuosamente comparezco y '),
      boldRun('EXPONGO:'),
    ]),

    emptyLine(),

    // Auxilio profesional
    mixedParagraph([
      boldRun('AUXILIO PROFESIONAL: '),
      normalRun(datos.auxilio_profesional ?? 'Actúo bajo la dirección y procuración de la Abogada '),
      ...(datos.auxilio_profesional ? [] : [legalName('AMANDA SANTIZO BOLAÑOS')]),
      normalRun('.'),
    ]),

    emptyLine(),

    // Motivo de comparecencia
    sectionTitle('MOTIVO DE COMPARECENCIA'),
    bodyParagraph(datos.motivo_comparecencia),

    emptyLine(),

    // Hechos
    sectionTitle('HECHOS'),
  ];

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
  children.push(bodyParagraph('Acompaño los documentos de ley.'));
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
