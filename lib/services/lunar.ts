// ============================================================================
// lib/services/lunar.ts
// Cálculo de datos lunares REALES (sin red, determinista) para el reporte
// astrológico de Telegram.
//   - Fase e iluminación: suncalc (getMoonIllumination).
//   - Signo zodiacal de la Luna: longitud eclíptica geocéntrica calculada con
//     el método de Paul Schlyter (precisión de pocos arcominutos, más que
//     suficiente para resolver el signo en bandas de 30°).
// El objetivo es inyectar datos verificables en el prompt para que el modelo no
// invente fases (Claude no tiene efemérides reales de 2026).
// ============================================================================

import SunCalc from 'suncalc';

const TZ = 'America/Guatemala';
const DEG = Math.PI / 180;

// Signos del zodíaco en orden, empezando en 0° Aries (longitud eclíptica).
const SIGNOS = [
  '♈ Aries', '♉ Tauro', '♊ Géminis', '♋ Cáncer', '♌ Leo', '♍ Virgo',
  '♎ Libra', '♏ Escorpio', '♐ Sagitario', '♑ Capricornio', '♒ Acuario', '♓ Piscis',
];

// Normaliza un ángulo en grados al rango [0, 360).
function rev(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

// Longitud eclíptica geocéntrica de la Luna (grados, 0–360) para una fecha.
// Método de Schlyter con los términos de perturbación principales.
function longitudLunar(fecha: Date): number {
  // d = días desde el 31 dic 1999 00:00 UT (época de los elementos de Schlyter).
  const d = fecha.getTime() / 86_400_000 - 10_956.0;

  // Sol (necesario para las perturbaciones de la Luna).
  const ws = 282.9404 + 4.70935e-5 * d;       // arg. del perihelio solar
  const Ms = rev(356.0470 + 0.9856002585 * d); // anomalía media solar
  const Ls = ws + Ms;                          // longitud media solar

  // Luna.
  const N = 125.1228 - 0.0529538083 * d; // longitud del nodo ascendente
  const i = 5.1454;                      // inclinación
  const w = 318.0634 + 0.1643573223 * d; // arg. del perihelio lunar
  const M = rev(115.3654 + 13.0649929509 * d); // anomalía media lunar
  const e = 0.054900;
  const a = 60.2666;

  // Anomalía excéntrica (Kepler), iterada un par de veces.
  let E = M + (180 / Math.PI) * e * Math.sin(M * DEG) * (1 + e * Math.cos(M * DEG));
  for (let k = 0; k < 3; k++) {
    E = E - (E - (180 / Math.PI) * e * Math.sin(E * DEG) - M) / (1 - e * Math.cos(E * DEG));
  }

  // Posición en el plano orbital → coordenadas eclípticas rectangulares.
  const x = a * (Math.cos(E * DEG) - e);
  const y = a * Math.sqrt(1 - e * e) * Math.sin(E * DEG);
  const r = Math.sqrt(x * x + y * y);
  const v = Math.atan2(y, x) / DEG; // anomalía verdadera (grados)

  const vw = (v + w) * DEG;
  const nRad = N * DEG;
  const iRad = i * DEG;
  const xeclip = r * (Math.cos(nRad) * Math.cos(vw) - Math.sin(nRad) * Math.sin(vw) * Math.cos(iRad));
  const yeclip = r * (Math.sin(nRad) * Math.cos(vw) + Math.cos(nRad) * Math.sin(vw) * Math.cos(iRad));

  let lon = Math.atan2(yeclip, xeclip) / DEG;

  // Perturbaciones principales en longitud (grados).
  const Lm = N + w + M;     // longitud media lunar
  const D = Lm - Ls;        // elongación media
  const F = Lm - N;         // argumento de latitud
  lon +=
    -1.274 * Math.sin((M - 2 * D) * DEG) + // evección
     0.658 * Math.sin((2 * D) * DEG) +     // variación
    -0.186 * Math.sin(Ms * DEG) +          // ecuación anual
    -0.059 * Math.sin((2 * M - 2 * D) * DEG) +
    -0.057 * Math.sin((M - 2 * D + Ms) * DEG) +
     0.053 * Math.sin((M + 2 * D) * DEG) +
     0.046 * Math.sin((2 * D - Ms) * DEG) +
     0.041 * Math.sin((M - Ms) * DEG) +
    -0.035 * Math.sin(D * DEG) +           // ecuación paraláctica
    -0.031 * Math.sin((M + Ms) * DEG) +
    -0.015 * Math.sin((2 * F - 2 * D) * DEG) +
     0.011 * Math.sin((M - 4 * D) * DEG);

  return rev(lon);
}

function signoLunar(fecha: Date): string {
  return SIGNOS[Math.floor(longitudLunar(fecha) / 30) % 12];
}

// Nombre de la fase lunar a partir del valor de fase de suncalc (0=Nueva,
// 0.25=Cuarto Creciente, 0.5=Llena, 0.75=Cuarto Menguante, →1=Nueva) y de la
// fracción iluminada. Se usan ventanas estrechas alrededor de los cuartos para
// nombrarlos exactos, y la iluminación para fijar Nueva/Llena (evita rotular
// "Creciente, 0%").
function nombreFase(phase: number, fraction: number): string {
  if (fraction <= 0.01) return 'Luna Nueva';
  if (fraction >= 0.99) return 'Luna Llena';
  if (phase < 0.23) return 'Luna Creciente';
  if (phase < 0.27) return 'Cuarto Creciente';
  if (phase < 0.48) return 'Gibosa Creciente';
  if (phase < 0.52) return 'Luna Llena';
  if (phase < 0.73) return 'Gibosa Menguante';
  if (phase < 0.77) return 'Cuarto Menguante';
  return 'Luna Menguante';
}

// Etiqueta de día en español (TZ Guatemala): "sábado 14 jun" → "Sábado 14 jun".
function etiquetaDia(fecha: Date): string {
  const s = fecha
    .toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'short', timeZone: TZ })
    .replace(',', '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Construye el bloque de DATOS LUNARES REALES para inyectar en el prompt del
// usuario. Cubre 7 días a partir de `inicio` (el rango del reporte). Calcula
// cada día al mediodía para evitar saltos de fase/signo en los bordes del día.
export function bloqueDatosLunares(inicio: Date): string {
  const lineas: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dia = new Date(inicio);
    dia.setDate(dia.getDate() + i);
    dia.setHours(12, 0, 0, 0);

    const { fraction, phase } = SunCalc.getMoonIllumination(dia);
    const fase = nombreFase(phase, fraction);
    const pct = Math.round(fraction * 100);
    const signo = signoLunar(dia);

    const ilum = fase === 'Luna Nueva' ? '~0% iluminación' : `${pct}% iluminación`;
    lineas.push(`- ${etiquetaDia(dia)}: ${fase}, ${ilum}, Luna en ${signo}`);
  }

  return [
    'DATOS LUNARES REALES (usa estos, NO inventes):',
    ...lineas,
    '',
    'INSTRUCCIÓN CRÍTICA: Usa EXACTAMENTE los datos lunares proporcionados arriba ' +
    '(fase, iluminación y signo de la Luna). NO inventes fases lunares. Si la Luna ' +
    'está en Cuarto Menguante, NO digas que es Luna Llena. El signo de la Luna en la ' +
    'sección 🌙 LUNA debe coincidir con el signo indicado para cada día.',
  ].join('\n');
}
