// ============================================================================
// lib/templates/arrendamiento.ts
// Contrato de Arrendamiento — estilo notarial guatemalteco
// ============================================================================

import { Document } from 'docx';
import type { DatosArrendamiento } from './types';
import {
  buildDocument, titleParagraph, bodyParagraph, mixedParagraph, emptyLine,
  signatureBlock, normalRun, boldRun, legalName, legalAmount, personaTexto,
} from './docx-utils';
import { fechaATextoLegal } from '@/lib/utils/fechas-letras';
import { numeroEscrituraTexto } from '@/lib/utils/numeros-letras';

export function generarArrendamiento(datos: DatosArrendamiento): Document {
  const fecha = datos.fecha ?? new Date().toISOString().split('T')[0];
  const lugar = datos.lugar ?? 'la ciudad de Guatemala';

  const children = [
    titleParagraph('CONTRATO DE ARRENDAMIENTO'),
    emptyLine(),
  ];

  // ── Encabezado notarial ────────────────────────────────────────────────
  if (datos.numero_escritura) {
    children.push(mixedParagraph([
      boldRun(`NÚMERO ${numeroEscrituraTexto(datos.numero_escritura)}.- `),
      normalRun(`En ${lugar}, el ${fechaATextoLegal(fecha)}, `),
      normalRun('ANTE MÍ: '),
      boldRun('AMANDA SANTIZO BOLAÑOS'),
      normalRun(', Notaria, comparecen: por una parte, como ARRENDANTE, '),
      ...personaTexto(datos.arrendante),
      normalRun('; y por la otra parte, como ARRENDATARIO, '),
      ...personaTexto(datos.arrendatario),
      normalRun('. Los comparecientes me aseguran hallarse en el libre ejercicio de sus derechos civiles, y por el presente instrumento otorgan CONTRATO DE ARRENDAMIENTO, de conformidad con las siguientes cláusulas:'),
    ]));
  } else {
    children.push(mixedParagraph([
      normalRun(`En ${lugar}, el ${fechaATextoLegal(fecha)}, comparecen: por una parte, como ARRENDANTE, `),
      ...personaTexto(datos.arrendante),
      normalRun('; y por la otra parte, como ARRENDATARIO, '),
      ...personaTexto(datos.arrendatario),
      normalRun('. Los comparecientes acuerdan celebrar el presente CONTRATO DE ARRENDAMIENTO, de conformidad con las siguientes cláusulas:'),
    ]));
  }

  children.push(emptyLine());

  // ── Cláusulas ──────────────────────────────────────────────────────────

  // PRIMERA: Objeto
  children.push(mixedParagraph([
    boldRun('PRIMERA: OBJETO. '),
    normalRun('El ARRENDANTE da en arrendamiento al ARRENDATARIO el inmueble ubicado en '),
    boldRun(datos.inmueble_direccion),
    normalRun(`, descrito como: ${datos.inmueble_descripcion}`),
    ...(datos.finca ? [normalRun(`, inscrito como finca número ${datos.finca}`)] : []),
    ...(datos.folio ? [normalRun(`, folio ${datos.folio}`)] : []),
    ...(datos.libro ? [normalRun(`, del libro ${datos.libro} del Registro General de la Propiedad`)] : []),
    normalRun('.'),
  ]));

  // SEGUNDA: Plazo
  children.push(mixedParagraph([
    boldRun('SEGUNDA: PLAZO. '),
    normalRun(`El plazo del presente contrato es de `),
    boldRun(`${datos.plazo_meses} meses`),
    normalRun(datos.fecha_inicio
      ? `, contados a partir del ${fechaATextoLegal(datos.fecha_inicio)}`
      : ', contados a partir de la fecha del presente contrato'),
    normalRun(', prorrogable por períodos iguales salvo que alguna de las partes notifique por escrito su voluntad de no prorrogarlo con por lo menos treinta días de anticipación.'),
  ]));

  // TERCERA: Renta
  children.push(mixedParagraph([
    boldRun('TERCERA: RENTA. '),
    normalRun('El ARRENDATARIO pagará al ARRENDANTE una renta mensual de '),
    boldRun(legalAmount(datos.renta_mensual)),
    normalRun(', pagadera dentro de los primeros cinco días de cada mes, en moneda de curso legal.'),
  ]));

  // CUARTA: Depósito (si aplica)
  if (datos.deposito && datos.deposito > 0) {
    children.push(mixedParagraph([
      boldRun('CUARTA: DEPÓSITO EN GARANTÍA. '),
      normalRun('El ARRENDATARIO entrega al ARRENDANTE en calidad de depósito la suma de '),
      boldRun(legalAmount(datos.deposito)),
      normalRun(', el cual será devuelto al finalizar el contrato, previa verificación del estado del inmueble.'),
    ]));
  }

  // QUINTA: Obligaciones
  children.push(mixedParagraph([
    boldRun(`${datos.deposito ? 'QUINTA' : 'CUARTA'}: OBLIGACIONES DEL ARRENDATARIO. `),
    normalRun('El ARRENDATARIO se obliga a: a) Usar el inmueble exclusivamente para el fin convenido; b) Mantener el inmueble en buen estado de conservación; c) No subarrendar total ni parcialmente sin consentimiento escrito del ARRENDANTE; d) Pagar puntualmente la renta en la fecha estipulada; e) Devolver el inmueble al término del contrato en las mismas condiciones en que lo recibió, salvo el deterioro natural por el uso normal.'),
  ]));

  // SEXTA: Obligaciones del arrendante
  children.push(mixedParagraph([
    boldRun(`${datos.deposito ? 'SEXTA' : 'QUINTA'}: OBLIGACIONES DEL ARRENDANTE. `),
    normalRun('El ARRENDANTE se obliga a: a) Entregar el inmueble en condiciones de habitabilidad; b) Mantener al ARRENDATARIO en el goce pacífico del inmueble; c) Realizar las reparaciones mayores necesarias que no provengan del uso normal.'),
  ]));

  // SÉPTIMA: Terminación
  children.push(mixedParagraph([
    boldRun(`${datos.deposito ? 'SÉPTIMA' : 'SEXTA'}: TERMINACIÓN ANTICIPADA. `),
    normalRun('El presente contrato podrá darse por terminado anticipadamente por mutuo acuerdo de las partes, o por incumplimiento de cualquiera de las cláusulas aquí estipuladas, en cuyo caso la parte afectada deberá notificar a la otra con treinta días de anticipación.'),
  ]));

  // Condiciones especiales
  if (datos.condiciones_especiales && datos.condiciones_especiales.length > 0) {
    const clausNum = datos.deposito ? 'OCTAVA' : 'SÉPTIMA';
    children.push(mixedParagraph([
      boldRun(`${clausNum}: CONDICIONES ESPECIALES. `),
      normalRun(datos.condiciones_especiales.join(' ')),
    ]));
  }

  // Jurisdicción
  children.push(mixedParagraph([
    boldRun(`${datos.deposito && datos.condiciones_especiales?.length ? 'NOVENA' : datos.deposito || datos.condiciones_especiales?.length ? 'OCTAVA' : 'SÉPTIMA'}: JURISDICCIÓN. `),
    normalRun('Para cualquier controversia derivada del presente contrato, las partes se someten a los tribunales competentes de la ciudad de Guatemala, renunciando a cualquier otro fuero que pudiera corresponderles.'),
  ]));

  children.push(emptyLine());

  // Cierre notarial
  if (datos.numero_escritura) {
    children.push(bodyParagraph(
      'Yo, la Notaria, DOY FE: a) De todo lo expuesto; b) Que tuve a la vista los documentos de identificación personal relacionados; c) Que leo lo escrito a los comparecientes, quienes enterados de su contenido, objeto, validez y efectos legales, lo aceptan, ratifican y firman.'
    ));
  }

  children.push(emptyLine());

  // Firmas
  children.push(...signatureBlock(datos.arrendante.nombre, 'ARRENDANTE'));
  children.push(...signatureBlock(datos.arrendatario.nombre, 'ARRENDATARIO'));

  if (datos.fiador) {
    children.push(...signatureBlock(datos.fiador.nombre, 'FIADOR'));
  }

  if (datos.numero_escritura) {
    children.push(...signatureBlock('AMANDA SANTIZO BOLAÑOS', 'NOTARIA'));
  }

  return buildDocument(children);
}
