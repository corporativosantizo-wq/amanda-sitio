// ============================================================================
// lib/utils/fechas-letras.ts
// Convierte fechas a texto legal en español guatemalteco
// 2025-11-17 → "diecisiete de noviembre del año dos mil veinticinco"
// ============================================================================

import { numeroALetras } from './numeros-letras';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const DIAS_SEMANA = [
  'domingo', 'lunes', 'martes', 'miércoles',
  'jueves', 'viernes', 'sábado',
];

/**
 * Convierte una fecha a texto legal notarial.
 * @example fechaATextoLegal('2025-11-17')
 * → "diecisiete de noviembre del año dos mil veinticinco"
 *
 * @example fechaATextoLegal('2023-12-12')
 * → "doce de diciembre de dos mil veintitrés"
 */
export function fechaATextoLegal(fecha: string | Date): string {
  const d = typeof fecha === 'string' ? new Date(fecha + 'T12:00:00') : fecha;
  const dia = d.getDate();
  const mes = MESES[d.getMonth()];
  const anio = d.getFullYear();

  const diaTexto = numeroALetras(dia);
  const anioTexto = anioATexto(anio);

  return `${diaTexto} de ${mes} ${anioTexto}`;
}

/**
 * Convierte año a texto legal.
 * @example anioATexto(2025) → "del año dos mil veinticinco"
 * @example anioATexto(2023) → "de dos mil veintitrés"
 */
function anioATexto(anio: number): string {
  const texto = numeroALetras(anio);
  // Convención: "del año" es más formal, "de" también es aceptable
  return `del año ${texto}`;
}

/**
 * Formato corto de fecha para documentos.
 * @example fechaCorta('2025-11-17') → "17 de noviembre de 2025"
 */
export function fechaCorta(fecha: string | Date): string {
  const d = typeof fecha === 'string' ? new Date(fecha + 'T12:00:00') : fecha;
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/**
 * Fecha con día de la semana para avisos.
 * @example fechaConDia('2024-02-05') → "lunes 5 de febrero del 2024"
 */
export function fechaConDia(fecha: string | Date): string {
  const d = typeof fecha === 'string' ? new Date(fecha + 'T12:00:00') : fecha;
  const diaSemana = DIAS_SEMANA[d.getDay()];
  return `${diaSemana} ${d.getDate()} de ${MESES[d.getMonth()]} del ${d.getFullYear()}`;
}

/**
 * Obtiene las fechas de un trimestre.
 * @example fechasTrimestre(2023, 4)
 * → { inicio: '2023-10-01', fin: '2023-12-31', limite: '2024-01-15' }
 */
export function fechasTrimestre(anio: number, trimestre: 1 | 2 | 3 | 4) {
  const mesInicio = (trimestre - 1) * 3;   // 0, 3, 6, 9
  const inicio = new Date(anio, mesInicio, 1);
  const fin = new Date(anio, mesInicio + 3, 0); // Último día del trimestre

  // Fecha límite: 10 días hábiles después del fin del trimestre (aprox 14 calendario)
  const limite = new Date(fin);
  limite.setDate(limite.getDate() + 14);

  return {
    inicio: formatISO(inicio),
    fin: formatISO(fin),
    limite: formatISO(limite),
    inicioTexto: fechaATextoLegal(inicio),
    finTexto: fechaATextoLegal(fin),
  };
}

/**
 * Nombre del trimestre para avisos.
 * @example nombreTrimestre(4) → "CUARTO TRIMESTRE"
 */
export function nombreTrimestre(trimestre: 1 | 2 | 3 | 4): string {
  const nombres = {
    1: 'PRIMER TRIMESTRE',
    2: 'SEGUNDO TRIMESTRE',
    3: 'TERCER TRIMESTRE',
    4: 'CUARTO TRIMESTRE',
  };
  return nombres[trimestre];
}

// Helper
function formatISO(d: Date): string {
  return d.toISOString().split('T')[0];
}
