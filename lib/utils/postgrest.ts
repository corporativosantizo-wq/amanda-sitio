// ============================================================================
// lib/utils/postgrest.ts
// Helpers para construir filtros PostgREST (.or(), .and()) de forma segura.
// ============================================================================

/**
 * Cita un valor para usarlo dentro de un filtro .or()/.and() de PostgREST.
 *
 * PostgREST trata `,` `.` `:` `(` `)` como separadores de sintaxis dentro de
 * `or=(...)`. Si el valor contiene alguno de esos caracteres, hay que envolverlo
 * en comillas dobles. Las comillas dobles internas se escapan con `\`.
 *
 * Why: nombres de cliente como "DISTEC GRAPHICS, SOCIEDAD ANONIMA" rompían el
 * parser y devolvían 400 al panel admin y al asistente Daniel.
 */
export function pgrstQuote(value: string): string {
  if (/[,():"]/.test(value)) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return value;
}
