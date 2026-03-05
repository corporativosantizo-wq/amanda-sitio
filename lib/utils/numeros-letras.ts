// ============================================================================
// lib/utils/numeros-letras.ts
// Convierte números a texto legal en español guatemalteco
// 49 → "CUARENTA Y NUEVE (49)"
// 1500.00 → "UN MIL QUINIENTOS QUETZALES"
// ============================================================================

const UNIDADES = [
  '', 'uno', 'dos', 'tres', 'cuatro', 'cinco',
  'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince',
  'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte',
  'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco',
  'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
];

const DECENAS = [
  '', '', '', 'treinta', 'cuarenta', 'cincuenta',
  'sesenta', 'setenta', 'ochenta', 'noventa',
];

const CENTENAS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos',
];

function convertirGrupo(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cien';
  if (n < 30) return UNIDADES[n];

  if (n < 100) {
    const decena = Math.floor(n / 10);
    const unidad = n % 10;
    return unidad === 0
      ? DECENAS[decena]
      : `${DECENAS[decena]} y ${UNIDADES[unidad]}`;
  }

  const centena = Math.floor(n / 100);
  const resto = n % 100;
  return resto === 0
    ? CENTENAS[centena] === 'ciento' ? 'cien' : CENTENAS[centena]
    : `${CENTENAS[centena]} ${convertirGrupo(resto)}`;
}

/**
 * Convierte un entero a texto en español.
 * @example numeroALetras(49) → "cuarenta y nueve"
 * @example numeroALetras(1000) → "un mil"
 * @example numeroALetras(0) → "cero"
 */
export function numeroALetras(n: number): string {
  if (n === 0) return 'cero';
  if (n < 0) return `menos ${numeroALetras(-n)}`;

  const entero = Math.floor(n);
  const partes: string[] = [];

  // Millones
  const millones = Math.floor(entero / 1_000_000);
  if (millones > 0) {
    partes.push(
      millones === 1
        ? 'un millón'
        : `${convertirGrupo(millones)} millones`
    );
  }

  // Miles
  const miles = Math.floor((entero % 1_000_000) / 1_000);
  if (miles > 0) {
    partes.push(miles === 1 ? 'un mil' : `${convertirGrupo(miles)} mil`);
  }

  // Unidades
  const unidades = entero % 1_000;
  if (unidades > 0) {
    partes.push(convertirGrupo(unidades));
  }

  return partes.join(' ');
}

/**
 * Formato legal para número de escritura.
 * @example numeroEscrituraTexto(49) → "CUARENTA Y NUEVE (49)"
 * @example numeroEscrituraTexto(3) → "TRES (3)"
 * @example numeroEscrituraTexto(11) → "ONCE (11)"
 */
export function numeroEscrituraTexto(n: number): string {
  return `${numeroALetras(n).toUpperCase()} (${n})`;
}

/**
 * Convierte monto a texto legal en quetzales.
 * @example montoALetras(1500) → "UN MIL QUINIENTOS QUETZALES EXACTOS"
 * @example montoALetras(1500.50) → "UN MIL QUINIENTOS QUETZALES CON CINCUENTA CENTAVOS"
 */
export function montoALetras(monto: number): string {
  const entero = Math.floor(monto);
  const centavos = Math.round((monto - entero) * 100);

  let texto = `${numeroALetras(entero).toUpperCase()} QUETZALES`;

  if (centavos > 0) {
    texto += ` CON ${numeroALetras(centavos).toUpperCase()} CENTAVOS`;
  } else {
    texto += ' EXACTOS';
  }

  return texto;
}

/**
 * Convierte número de hojas a texto legal.
 * @example hojasTexto(2) → "DOS HOJAS"
 * @example hojasTexto(7) → "SIETE HOJAS"
 * @example hojasTexto(1) → "UNA HOJA"
 */
export function hojasTexto(n: number): string {
  if (n === 1) return 'UNA HOJA';
  return `${numeroALetras(n).toUpperCase()} HOJAS`;
}
