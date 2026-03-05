// ============================================================================
// lib/templates/laboral.ts
// Contrato Individual de Trabajo
// ============================================================================

import { Document } from 'docx';
import type { DatosLaboral } from './types';
import {
  buildDocument, titleParagraph, subtitleParagraph, bodyParagraph, mixedParagraph,
  emptyLine, signatureBlock, normalRun, boldRun, legalName, legalAmount, personaTexto,
} from './docx-utils';
import { fechaATextoLegal } from '@/lib/utils/fechas-letras';

export function generarLaboral(datos: DatosLaboral): Document {
  const bonificacion = datos.bonificacion_incentivo ?? 250;

  const children = [
    titleParagraph('CONTRATO INDIVIDUAL DE TRABAJO'),
    emptyLine(),

    // Identificación de partes
    mixedParagraph([
      normalRun('Nosotros, por una parte '),
      ...personaTexto(datos.trabajador),
      normalRun(', quien en adelante se denominará "EL TRABAJADOR"; y por la otra, '),
      legalName(datos.patrono.empresa),
      ...(datos.patrono.representante
        ? [normalRun(', representada legalmente por '), legalName(datos.patrono.representante)]
        : []),
      ...(datos.patrono.datos_inscripcion
        ? [normalRun(`, ${datos.patrono.datos_inscripcion}`)]
        : []),
      normalRun(', quien en adelante se denominará "EL PATRONO", convenimos en celebrar el presente CONTRATO INDIVIDUAL DE TRABAJO, contenido en las siguientes cláusulas:'),
    ]),

    emptyLine(),

    // Cláusula 1: Objeto
    mixedParagraph([
      boldRun('CLÁUSULA PRIMERA: '),
      normalRun(`EL PATRONO contrata los servicios de EL TRABAJADOR para desempeñarse en el puesto de `),
      boldRun(datos.puesto.toUpperCase()),
      normalRun(`, debiendo realizar las funciones inherentes al cargo`),
      ...(datos.funciones && datos.funciones.length > 0
        ? [normalRun(`, las cuales incluyen: ${datos.funciones.join('; ')}`)]
        : []),
      normalRun('.'),
    ]),

    // Cláusula 2: Inicio
    mixedParagraph([
      boldRun('CLÁUSULA SEGUNDA: '),
      normalRun(`La relación laboral inicia el ${fechaATextoLegal(datos.fecha_inicio)}, con un período de prueba de dos meses conforme el Artículo 81 del Código de Trabajo.`),
    ]),

    // Cláusula 3: Jornada
    mixedParagraph([
      boldRun('CLÁUSULA TERCERA: '),
      normalRun(`EL TRABAJADOR prestará sus servicios en jornada ${datos.jornada ?? 'diurna'}, con el siguiente horario: ${datos.horario}. La jornada ordinaria de trabajo efectivo no excederá de ocho horas diarias ni de cuarenta y cuatro horas semanales, conforme lo establecido en el Código de Trabajo.`),
    ]),

    // Cláusula 4: Lugar
    mixedParagraph([
      boldRun('CLÁUSULA CUARTA: '),
      normalRun(`EL TRABAJADOR prestará sus servicios en `),
      boldRun(datos.lugar_trabajo),
      normalRun(', pudiendo ser trasladado a otro lugar dentro del territorio nacional cuando las necesidades del servicio lo requieran.'),
    ]),

    // Cláusula 5: Salario
    mixedParagraph([
      boldRun('CLÁUSULA QUINTA: '),
      normalRun('EL PATRONO pagará a EL TRABAJADOR un salario mensual de '),
      boldRun(legalAmount(datos.salario_mensual)),
      normalRun(', más una bonificación incentivo de '),
      boldRun(legalAmount(bonificacion)),
      normalRun(', pagaderos mensualmente. Sobre el salario se harán las deducciones legales correspondientes (IGSS, ISR si aplica).'),
    ]),

    // Cláusula 6: Prestaciones
    mixedParagraph([
      boldRun('CLÁUSULA SEXTA: '),
      normalRun('EL TRABAJADOR gozará de las prestaciones establecidas por la ley, incluyendo: a) Aguinaldo equivalente al cien por ciento del salario mensual; b) Bonificación anual (Bono 14) equivalente al cien por ciento del salario mensual; c) Vacaciones anuales remuneradas de quince días hábiles; d) Las demás que establezcan las leyes laborales vigentes.'),
    ]),

    // Cláusula 7: Obligaciones del trabajador
    mixedParagraph([
      boldRun('CLÁUSULA SÉPTIMA: '),
      normalRun('Son obligaciones de EL TRABAJADOR: a) Desempeñar el servicio contratado con diligencia y eficiencia; b) Acatar las instrucciones de EL PATRONO o sus representantes; c) Guardar secreto sobre los asuntos administrativos y de la empresa; d) Conservar en buen estado los instrumentos y útiles de trabajo; e) Observar buena conducta durante el trabajo.'),
    ]),

    // Cláusula 8: Obligaciones del patrono
    mixedParagraph([
      boldRun('CLÁUSULA OCTAVA: '),
      normalRun('Son obligaciones de EL PATRONO: a) Pagar al trabajador el salario pactado en la forma y plazo convenidos; b) Proporcionar los materiales y útiles necesarios para el trabajo; c) Guardar la debida consideración al trabajador; d) Cumplir con las disposiciones del Código de Trabajo y reglamentos aplicables.'),
    ]),

    // Cláusula 9: Confidencialidad
    mixedParagraph([
      boldRun('CLÁUSULA NOVENA: '),
      normalRun('EL TRABAJADOR se compromete a mantener estricta confidencialidad sobre toda la información a la que tenga acceso en razón de su cargo, tanto durante la vigencia del contrato como después de su terminación. El incumplimiento de esta obligación será causal de despido justificado y podrá generar responsabilidades civiles y penales.'),
    ]),

    // Cláusula 10: Terminación
    mixedParagraph([
      boldRun('CLÁUSULA DÉCIMA: '),
      normalRun('El presente contrato podrá terminar por las causas establecidas en el Código de Trabajo, incluyendo el despido justificado, la renuncia voluntaria, el mutuo acuerdo, y las demás causas legales aplicables.'),
    ]),

    // Cláusula 11: Disposiciones generales
    mixedParagraph([
      boldRun('CLÁUSULA DÉCIMA PRIMERA: '),
      normalRun('En todo lo no previsto en el presente contrato, se estará a lo dispuesto por el Código de Trabajo, sus reglamentos y demás leyes laborales de la República de Guatemala.'),
    ]),

    // Cláusula 12: Aceptación
    mixedParagraph([
      boldRun('CLÁUSULA DÉCIMA SEGUNDA: '),
      normalRun(`Ambas partes aceptan las condiciones del presente contrato y para constancia lo firman en la ciudad de Guatemala, el ${fechaATextoLegal(datos.fecha_inicio)}, en dos ejemplares de igual tenor, quedando uno en poder de cada parte.`),
    ]),

    emptyLine(),

    // Firmas
    ...signatureBlock(datos.trabajador.nombre, 'EL TRABAJADOR'),
    ...signatureBlock(datos.patrono.representante ?? datos.patrono.empresa, 'EL PATRONO'),
  ];

  return buildDocument(children);
}
