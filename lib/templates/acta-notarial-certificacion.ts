// ============================================================================
// lib/templates/acta-notarial-certificacion.ts
// Acta Notarial de Certificación de Punto de Acta
// Interlineado especial: máx 25 líneas por página
// ============================================================================

import { Document } from 'docx';
import type { DatosActaNotarialCertificacion } from './types';
import {
  buildDocument, titleParagraph, bodyParagraph, mixedParagraph, emptyLine,
  signatureBlock, normalRun, boldRun, legalName, personaTexto,
  LINE_SPACING_NOTARIAL, SECTION_PROPS,
} from './docx-utils';
import { fechaATextoLegal } from '@/lib/utils/fechas-letras';

export function generarActaNotarialCertificacion(datos: DatosActaNotarialCertificacion): Document {
  const notario = datos.notario ?? 'AMANDA SANTIZO BOLAÑOS';
  const hora = datos.hora ?? 'las diez horas';

  const children = [
    titleParagraph('ACTA NOTARIAL DE CERTIFICACIÓN'),
    emptyLine(),

    // Cuerpo del acta en párrafo continuo (estilo notarial)
    mixedParagraph([
      normalRun(`En ${datos.lugar}, siendo ${hora} del ${fechaATextoLegal(datos.fecha)}, yo, `),
      legalName(notario),
      normalRun(', Notaria, a requerimiento de '),
      ...personaTexto(datos.requirente),
      ...(datos.calidad_requirente
        ? [normalRun(`, quien actúa en su calidad de ${datos.calidad_requirente} de la entidad `), legalName(datos.entidad)]
        : [normalRun(`, quien actúa en representación de la entidad `), legalName(datos.entidad)]),
      normalRun(`, procedo a dar fe de lo siguiente:`),
    ], { notarial: true }),

    emptyLine(),

    // Certificación
    mixedParagraph([
      boldRun('PRIMERO: '),
      normalRun(`El requirente me presenta el Libro de Actas de `),
      legalName(datos.entidad),
      normalRun(`, del cual certifico el contenido del Acta número ${datos.numero_acta}, de fecha ${fechaATextoLegal(datos.fecha_acta)}, `),
      normalRun(`específicamente el punto relativo a: ${datos.punto_certificado}.`),
    ], { notarial: true }),

    emptyLine(),

    // Contenido literal
    mixedParagraph([
      boldRun('SEGUNDO: '),
      normalRun('El punto certificado, literalmente dice: '),
      normalRun(`«${datos.contenido_literal}»`),
    ], { notarial: true }),

    emptyLine(),
  ];

  // Registros si aplica
  if (datos.registro_cancelar || datos.registro_otorgar) {
    const runs = [boldRun('TERCERO: '), normalRun('En relación con lo anterior, ')];
    if (datos.registro_cancelar) {
      runs.push(normalRun(`se procede a la cancelación del registro número ${datos.registro_cancelar}`));
      if (datos.registro_otorgar) runs.push(normalRun(' y '));
    }
    if (datos.registro_otorgar) {
      runs.push(normalRun(`se otorga nuevo registro número ${datos.registro_otorgar}`));
    }
    runs.push(normalRun('.'));
    children.push(mixedParagraph(runs, { notarial: true }));
    children.push(emptyLine());
  }

  // Cierre notarial
  children.push(mixedParagraph([
    normalRun('Yo, la Notaria, '),
    boldRun('DOY FE: '),
    normalRun('a) De todo lo expuesto; b) Que tuve a la vista el Libro de Actas de la entidad mencionada; c) Que el punto transcrito concuerda fielmente con su original; d) Que tuve a la vista el Documento Personal de Identificación del requirente. Leo lo escrito al requirente, quien enterado de su contenido, objeto, validez y efectos legales, lo acepta, ratifica y firma.'),
  ], { notarial: true }));

  children.push(emptyLine());

  // Firmas
  children.push(...signatureBlock(datos.requirente.nombre, 'REQUIRENTE'));
  children.push(...signatureBlock(notario, 'NOTARIA'));

  // Usar sección con spacing notarial para toda el acta
  return new Document({
    creator: 'Amanda Santizo — Despacho Jurídico — IURISLEX',
    description: 'Acta Notarial de Certificación',
    sections: [{
      properties: SECTION_PROPS,
      children,
    }],
  });
}
