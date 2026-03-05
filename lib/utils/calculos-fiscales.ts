// ============================================================================
// lib/utils/calculos-fiscales.ts
// Cálculos tributarios guatemaltecos: IVA, ISR, timbres
// ============================================================================

import type { DesgloseFiscal, CalculoRetencion } from '@/lib/types';

// Defaults (se sobreescriben con valores de legal.configuracion)
const DEFAULTS = {
  IVA_PORCENTAJE: 12,
  ISR_PORCENTAJE_BAJO: 5,
  ISR_PORCENTAJE_ALTO: 7,
  ISR_UMBRAL: 30_000,
  TIMBRE_RAZON: 0.50,
  TIMBRE_NOTARIAL_POR_HOJA: 10,
} as const;

/**
 * Calcula el IVA sobre un subtotal.
 * En Guatemala el IVA (12%) ya está incluido en el precio.
 * Subtotal = Total / 1.12
 * IVA = Total - Subtotal
 */
export function calcularIVA(
  total: number,
  ivaPorcentaje: number = DEFAULTS.IVA_PORCENTAJE
): { subtotal: number; iva: number } {
  const factor = 1 + ivaPorcentaje / 100;
  const subtotal = round(total / factor);
  const iva = round(total - subtotal);
  return { subtotal, iva };
}

/**
 * Calcula IVA "por fuera" (cuando tienes el subtotal sin IVA).
 */
export function calcularIVASobreSubtotal(
  subtotal: number,
  ivaPorcentaje: number = DEFAULTS.IVA_PORCENTAJE
): { iva: number; total: number } {
  const iva = round(subtotal * ivaPorcentaje / 100);
  return { iva, total: round(subtotal + iva) };
}

/**
 * Calcula la retención del ISR que el cliente debe retener.
 * < Q30,000 → 5%
 * ≥ Q30,000 → 7%
 */
export function calcularRetencionISR(
  monto: number,
  config?: {
    porcentaje_bajo?: number;
    porcentaje_alto?: number;
    umbral?: number;
  }
): CalculoRetencion {
  const umbral = config?.umbral ?? DEFAULTS.ISR_UMBRAL;
  const porcentaje = monto < umbral
    ? (config?.porcentaje_bajo ?? DEFAULTS.ISR_PORCENTAJE_BAJO)
    : (config?.porcentaje_alto ?? DEFAULTS.ISR_PORCENTAJE_ALTO);

  return {
    porcentaje,
    monto: round(monto * porcentaje / 100),
  };
}

/**
 * Calcula el desglose fiscal completo de un servicio.
 * Útil para cotizaciones y facturas.
 */
export function calcularDesgloseFiscal(
  subtotal: number,
  opciones?: {
    ivaPorcentaje?: number;
    aplicaRetencion?: boolean;
    isrConfig?: {
      porcentaje_bajo?: number;
      porcentaje_alto?: number;
      umbral?: number;
    };
  }
): DesgloseFiscal {
  const ivaPorcentaje = opciones?.ivaPorcentaje ?? DEFAULTS.IVA_PORCENTAJE;
  const { iva, total } = calcularIVASobreSubtotal(subtotal, ivaPorcentaje);

  let retencion: CalculoRetencion | null = null;
  let montoARecibir = total;

  if (opciones?.aplicaRetencion) {
    retencion = calcularRetencionISR(total, opciones.isrConfig);
    montoARecibir = round(total - retencion.monto);
  }

  return {
    subtotal,
    iva_porcentaje: ivaPorcentaje,
    iva_monto: iva,
    total,
    retencion,
    monto_a_recibir: montoARecibir,
  };
}

/**
 * Calcula el timbre notarial (Q10 por hoja de protocolo).
 */
export function calcularTimbreNotarial(hojas: number): number {
  return round(hojas * DEFAULTS.TIMBRE_NOTARIAL_POR_HOJA);
}

/**
 * Calcula timbres fiscales según tipo de acto y valor.
 * Retorna el monto del timbre y el texto para la razón.
 */
export function calcularTimbresFiscales(opciones: {
  exento: boolean;
  timbreFijo?: number | null;
  timbrePorcentaje?: number | null;
  baseCalculo: 'valor_acto' | 'capital_social' | 'fijo';
  valorActo?: number | null;
}): { monto: number; texto: string } {
  if (opciones.exento) {
    return {
      monto: DEFAULTS.TIMBRE_RAZON, // Solo el Q0.50 de la razón
      texto: 'Se hace constar que no está afecto impuesto de timbre fiscal por lo que únicamente se adhiere un timbre fiscal de cincuenta centavos para la razón de registro',
    };
  }

  if (opciones.baseCalculo === 'fijo' || !opciones.valorActo) {
    return {
      monto: opciones.timbreFijo ?? DEFAULTS.TIMBRE_RAZON,
      texto: 'Se cubrieron los impuestos de ley conforme corresponde',
    };
  }

  if (opciones.timbrePorcentaje && opciones.valorActo) {
    const monto = round(opciones.valorActo * opciones.timbrePorcentaje);
    return {
      monto,
      texto: 'Se hace constar que sobre el presente instrumento público se cubrieron los impuestos de ley',
    };
  }

  return {
    monto: DEFAULTS.TIMBRE_RAZON,
    texto: 'Se cubrieron los impuestos de ley conforme corresponde',
  };
}

/**
 * Calcula el anticipo basado en el total.
 */
export function calcularAnticipo(
  total: number,
  porcentaje: number = 60
): { anticipo: number; saldo: number } {
  const anticipo = round(total * porcentaje / 100);
  return { anticipo, saldo: round(total - anticipo) };
}

// --- Helpers ---

function round(n: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}
