// ============================================================================
// lib/templates/rendicion-cuentas.ts
// Demanda Oral de Rendición de Cuentas
// ============================================================================

import { Document } from 'docx';
import type { DatosRendicionCuentas } from './types';
import {
  buildDocument, titleParagraph, bodyParagraph, mixedParagraph, sectionTitle,
  emptyLine, numberedItem, normalRun, boldRun, legalName, personaTexto,
} from './docx-utils';

export function generarRendicionCuentas(datos: DatosRendicionCuentas): Document {
  const children = [
    titleParagraph('DEMANDA ORAL DE RENDICIÓN DE CUENTAS'),
    emptyLine(),

    // Encabezado
    bodyParagraph(`SEÑOR JUEZ ${datos.juzgado.toUpperCase()}`, { bold: true }),
    emptyLine(),

    // Datos del demandante
    mixedParagraph([
      ...personaTexto(datos.demandante),
      normalRun(', señalando lugar para recibir notificaciones en '),
      normalRun(datos.demandante.direccion ?? 'la ciudad de Guatemala'),
      normalRun(', ante usted respetuosamente comparezco y '),
      boldRun('EXPONGO:'),
    ]),

    emptyLine(),

    // Demandado
    mixedParagraph([
      normalRun('Promuevo '),
      boldRun('DEMANDA ORAL DE RENDICIÓN DE CUENTAS '),
      normalRun('en contra de '),
      ...personaTexto(datos.demandado),
      normalRun(', a quien se le deberá notificar en '),
      normalRun(datos.demandado.direccion ?? 'la dirección que se señale'),
      normalRun(', con base en los siguientes:'),
    ]),

    emptyLine(),

    // Hechos
    sectionTitle('HECHOS'),
  ];

  datos.hechos.forEach((h: string, i: number) => {
    children.push(numberedItem(i + 1, h));
  });

  children.push(emptyLine());

  // Relación jurídica
  children.push(mixedParagraph([
    boldRun('RELACIÓN JURÍDICA: '),
    normalRun(datos.relacion_juridica),
  ]));

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
  children.push(bodyParagraph('Acompaño los documentos de ley y copias respectivas.'));
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
