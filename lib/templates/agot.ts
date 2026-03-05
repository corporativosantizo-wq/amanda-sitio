// ============================================================================
// lib/templates/agot.ts
// Acta de Asamblea General Ordinaria Totalitaria (AGOT)
// ============================================================================

import { Document } from 'docx';
import type { DatosAGOT } from './types';
import {
  buildDocument, titleParagraph, subtitleParagraph, bodyParagraph, mixedParagraph,
  emptyLine, signatureBlock, normalRun, boldRun, legalName,
} from './docx-utils';
import { fechaATextoLegal } from '@/lib/utils/fechas-letras';

export function generarAGOT(datos: DatosAGOT): Document {
  const hora = datos.hora ?? 'las diez horas';

  const children = [
    titleParagraph(`ASAMBLEA GENERAL ORDINARIA TOTALITARIA DE ACCIONISTAS DE LA ENTIDAD ${datos.entidad.toUpperCase()}`),
    ...(datos.numero_acta ? [subtitleParagraph(`ACTA NÚMERO ${datos.numero_acta}`)] : []),
    emptyLine(),

    // PRIMERO: Constitución y quórum
    mixedParagraph([
      boldRun('PRIMERO: '),
      normalRun(`En la ciudad de Guatemala, siendo ${hora} del ${fechaATextoLegal(datos.fecha)}, en la sede social ubicada en ${datos.direccion_sede}, se reúnen los accionistas de la entidad `),
      legalName(datos.entidad),
      normalRun(', siendo ellos: '),
      ...datos.socios.flatMap((socio: any, idx: number) => [
        legalName(socio.nombre),
        ...(socio.calidad ? [normalRun(`, en calidad de ${socio.calidad}`)] : []),
        normalRun(idx < datos.socios.length - 1 ? '; ' : '. '),
      ]),
      normalRun(`Estando presentes el cien por ciento de los accionistas y representado el cien por ciento del capital social, se declara legalmente instalada la Asamblea General Ordinaria Totalitaria, de conformidad con el Artículo 156 del Código de Comercio de Guatemala. Preside la Asamblea `),
      legalName(datos.presidente),
      normalRun(' y actúa como Secretario Ad-Hoc '),
      legalName(datos.secretario),
      normalRun('.'),
    ]),

    emptyLine(),

    // SEGUNDO: Puntos de agenda / acuerdos
    mixedParagraph([
      boldRun('SEGUNDO: '),
      normalRun('Se someten a consideración de la Asamblea los siguientes puntos de agenda, los cuales son aprobados por unanimidad de votos:'),
    ]),
  ];

  // Agregar cada punto de agenda
  datos.puntos.forEach((punto: any, idx: number) => {
    const letra = String.fromCharCode(97 + idx); // a, b, c...
    children.push(mixedParagraph([
      boldRun(`${letra}) ${punto.tipo}: `),
      normalRun(punto.detalle),
    ]));
  });

  children.push(emptyLine());

  // TERCERO: Ruegos y preguntas
  children.push(mixedParagraph([
    boldRun('TERCERO: RUEGOS Y PREGUNTAS. '),
    normalRun('No habiendo más asuntos que tratar ni ruegos y preguntas que formular, se procede al cierre de la asamblea.'),
  ]));

  children.push(emptyLine());

  // CUARTO: Cierre
  children.push(mixedParagraph([
    boldRun('CUARTO: CIERRE. '),
    normalRun(`No habiendo más que hacer constar, se da por finalizada la presente Asamblea en el mismo lugar y fecha de su inicio, siendo las ______ horas, firmando para constancia los que en ella intervinieron.`),
  ]));

  children.push(emptyLine());
  children.push(emptyLine());

  // Firmas
  children.push(...signatureBlock(datos.presidente, 'PRESIDENTE'));
  children.push(...signatureBlock(datos.secretario, 'SECRETARIO AD-HOC'));

  return buildDocument(children);
}
