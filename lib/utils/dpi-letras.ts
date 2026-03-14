// ============================================================================
// lib/utils/dpi-letras.ts
// Convierte DPI y números de documento a texto legal
// 1583 35198 0101 → "mil quinientos ochenta y tres, treinta y cinco mil
//                     ciento noventa y ocho, cero ciento uno"
// ============================================================================

import { numeroALetras } from './numeros-letras';

/**
 * Convierte cada grupo de un DPI a texto, separados por coma.
 * @example dpiALetras('1583 35198 0101')
 * → "mil quinientos ochenta y tres, treinta y cinco mil ciento noventa y ocho, cero ciento uno"
 */
export function dpiALetras(dpi: string): string {
  const grupos = dpi.replace(/[^0-9\s]/g, '').trim().split(/\s+/);
  return grupos.map((g: string) => grupoALetras(g)).join(', ');
}

/**
 * Convierte un grupo numérico a texto, respetando ceros iniciales.
 * "0101" → "cero ciento uno"
 */
function grupoALetras(grupo: string): string {
  // Handle leading zeros
  if (grupo.startsWith('0')) {
    const sinCeros = grupo.replace(/^0+/, '');
    const numCeros = grupo.length - sinCeros.length;
    const cerosTexto = Array(numCeros).fill('cero').join(' ');
    if (sinCeros.length === 0) return cerosTexto;
    return `${cerosTexto} ${numeroALetras(parseInt(sinCeros, 10))}`;
  }
  return numeroALetras(parseInt(grupo, 10));
}

/**
 * DPI formateado con número y letras para documentos legales.
 * @example dpiTextoLegal('1583 35198 0101')
 * → "mil quinientos ochenta y tres, treinta y cinco mil ciento noventa y ocho, cero ciento uno (1583 35198 0101)"
 */
export function dpiTextoLegal(dpi: string): string {
  return `${dpiALetras(dpi)} (${dpi})`;
}
