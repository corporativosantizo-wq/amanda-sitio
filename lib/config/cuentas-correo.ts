// ============================================================================
// lib/config/cuentas-correo.ts
// Fuente única de las cuentas de correo del despacho: valores, labels de UI y
// firma por cuenta. La importan tanto client components (selectores) como
// servicios de servidor (validación, prompts de Molly).
// IMPORTANTE: no importar aquí nada de outlook.service.ts ni otros módulos de
// servidor — este archivo entra al bundle del cliente.
// ============================================================================

export const CUENTAS_VALIDAS = [
  'asistente@papeleo.legal',
  'contador@papeleo.legal',
  'amanda@papeleo.legal',
] as const;

export type CuentaCorreo = (typeof CUENTAS_VALIDAS)[number];

// `value` se tipa string a propósito: los selectores de la UI trabajan con
// e.target.value (string). Para validar, usar esCuentaValida().
export const CUENTAS_CORREO: Array<{ value: string; label: string; firma: string }> = [
  {
    value: 'asistente@papeleo.legal',
    label: '📧 Asistente',
    firma: 'Seguimiento de Procesos | papeleo.legal',
  },
  {
    value: 'contador@papeleo.legal',
    label: '💰 Contador',
    firma: 'Departamento Contable | papeleo.legal',
  },
  {
    value: 'amanda@papeleo.legal',
    label: '⭐ Amanda',
    firma: 'Licenciada Amanda Santizo | Abogada y Notaria',
  },
];

export function esCuentaValida(v: string): v is CuentaCorreo {
  return (CUENTAS_VALIDAS as readonly string[]).includes(v);
}

export function firmaDeCuenta(cuenta: string): string {
  return (
    CUENTAS_CORREO.find((c) => c.value === cuenta)?.firma ??
    CUENTAS_CORREO[0].firma
  );
}

// Firmas anteriores al cambio de julio 2026 que todavía pueden estar horneadas
// en borradores pendientes generados antes — swapFirma también las reconoce.
const FIRMAS_LEGACY = ['Lic. Amanda Santizo | Despacho Jurídico'];

// Reemplaza en `texto` la firma de `cuentaVieja` (o una legacy) por la de
// `cuentaNueva`. Devuelve null si no encuentra ninguna firma conocida — el
// caller decide el fallback (p. ej. mostrar un aviso).
export function swapFirma(
  texto: string,
  cuentaVieja: string,
  cuentaNueva: string,
): string | null {
  const nueva = firmaDeCuenta(cuentaNueva);
  const candidatas = [
    firmaDeCuenta(cuentaVieja),
    ...CUENTAS_CORREO.map((c) => c.firma),
    ...FIRMAS_LEGACY,
  ];
  for (const firma of candidatas) {
    if (firma !== nueva && texto.includes(firma)) {
      return texto.replace(firma, nueva);
    }
  }
  // La firma nueva ya está en el texto (p. ej. volver a la cuenta original
  // tras un swap previo): no hay nada que cambiar, pero no es un fallo.
  if (texto.includes(nueva)) return texto;
  return null;
}
