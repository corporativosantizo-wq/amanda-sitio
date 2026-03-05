// ============================================================================
// lib/utils/validators.ts
// Validaciones específicas para Guatemala
// ============================================================================

/**
 * Valida un NIT guatemalteco.
 * El NIT tiene un dígito verificador que se valcula con módulo 11.
 * Acepta formatos: "12345678", "1234567-8", "1234567-K"
 */
export function validarNIT(nit: string): { valido: boolean; mensaje?: string } {
  // Limpiar
  const limpio = nit.replace(/[-\s]/g, '').toUpperCase();

  if (limpio.length < 2) {
    return { valido: false, mensaje: 'NIT demasiado corto' };
  }

  // Separar cuerpo y dígito verificador
  const cuerpo = limpio.slice(0, -1);
  const verificador = limpio.slice(-1);

  // Validar que el cuerpo sea numérico
  if (!/^\d+$/.test(cuerpo)) {
    return { valido: false, mensaje: 'NIT contiene caracteres inválidos' };
  }

  // Calcular dígito verificador (módulo 11)
  let suma = 0;
  for (let i = 0; i < cuerpo.length; i++) {
    suma += parseInt(cuerpo[cuerpo.length - 1 - i]) * (i + 2);
  }
  const modulo = suma % 11;
  const esperado = modulo === 10 ? 'K' : modulo.toString();

  if (verificador !== esperado) {
    return { valido: false, mensaje: `Dígito verificador incorrecto (esperado: ${esperado})` };
  }

  return { valido: true };
}

/**
 * Formatea un NIT para display.
 * @example formatearNIT("12345678") → "1234567-8"
 */
export function formatearNIT(nit: string): string {
  const limpio = nit.replace(/[-\s]/g, '');
  if (limpio.length < 2) return nit;
  return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
}

/**
 * Valida un DPI guatemalteco (13 dígitos).
 * Formato: CUI (Código Único de Identificación)
 */
export function validarDPI(dpi: string): { valido: boolean; mensaje?: string } {
  const limpio = dpi.replace(/[\s-]/g, '');

  if (!/^\d{13}$/.test(limpio)) {
    return { valido: false, mensaje: 'El DPI debe tener exactamente 13 dígitos' };
  }

  // Los últimos 4 dígitos indican municipio (2) y departamento (2)
  const departamento = parseInt(limpio.slice(9, 11));
  const municipio = parseInt(limpio.slice(11, 13));

  // Guatemala tiene 22 departamentos (01-22)
  if (departamento < 1 || departamento > 22) {
    return { valido: false, mensaje: 'Código de departamento inválido en DPI' };
  }

  // Validación básica de municipio (cada depto tiene diferente cantidad)
  if (municipio < 1) {
    return { valido: false, mensaje: 'Código de municipio inválido en DPI' };
  }

  return { valido: true };
}

/**
 * Formatea un DPI para display.
 * @example formatearDPI("1234567890123") → "1234 56789 0123"
 */
export function formatearDPI(dpi: string): string {
  const limpio = dpi.replace(/[\s-]/g, '');
  if (limpio.length !== 13) return dpi;
  return `${limpio.slice(0, 4)} ${limpio.slice(4, 9)} ${limpio.slice(9)}`;
}

/**
 * Valida teléfono guatemalteco.
 * Formatos válidos: "55551234", "5555-1234", "+502 5555-1234"
 */
export function validarTelefono(tel: string): { valido: boolean; mensaje?: string } {
  const limpio = tel.replace(/[\s\-\+\(\)]/g, '');

  // Con código de país
  if (limpio.startsWith('502') && limpio.length === 11) {
    return { valido: true };
  }

  // Sin código de país (8 dígitos)
  if (/^\d{8}$/.test(limpio)) {
    return { valido: true };
  }

  return { valido: false, mensaje: 'Teléfono debe tener 8 dígitos (o 11 con código de país)' };
}

/**
 * Formatea teléfono para display.
 * @example formatearTelefono("55551234") → "+502 5555-1234"
 */
export function formatearTelefono(tel: string): string {
  const limpio = tel.replace(/[\s\-\+\(\)]/g, '');

  if (limpio.length === 8) {
    return `+502 ${limpio.slice(0, 4)}-${limpio.slice(4)}`;
  }

  if (limpio.startsWith('502') && limpio.length === 11) {
    return `+502 ${limpio.slice(3, 7)}-${limpio.slice(7)}`;
  }

  return tel;
}

/**
 * Valida email básico.
 */
export function validarEmail(email: string): { valido: boolean; mensaje?: string } {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email)) {
    return { valido: false, mensaje: 'Formato de email inválido' };
  }
  return { valido: true };
}

/**
 * Formatea moneda guatemalteca.
 * @example formatearQuetzales(1500.50) → "Q 1,500.50"
 * @example formatearQuetzales(1500) → "Q 1,500.00"
 */
export function formatearQuetzales(monto: number): string {
  return `Q ${monto.toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formatea fecha para display.
 * @example formatearFecha('2025-11-17') → "17/11/2025"
 */
export function formatearFecha(fecha: string | Date): string {
  const d = typeof fecha === 'string' ? new Date(fecha + 'T12:00:00') : fecha;
  return d.toLocaleDateString('es-GT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formatea fecha relativa ("hace 3 días", "en 5 días").
 */
export function fechaRelativa(fecha: string | Date): string {
  const d = typeof fecha === 'string' ? new Date(fecha + 'T12:00:00') : fecha;
  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);

  const diff = Math.floor((d.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  if (diff > 1 && diff <= 30) return `En ${diff} días`;
  if (diff < -1 && diff >= -30) return `Hace ${Math.abs(diff)} días`;

  return formatearFecha(fecha);
}
