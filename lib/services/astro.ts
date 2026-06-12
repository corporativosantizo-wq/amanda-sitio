// ============================================================================
// lib/services/astro.ts
// Datos astronómicos REALES (sin red, deterministas) para el reporte astrológico.
//   - Posiciones planetarias geocéntricas (Sol → Plutón): elementos keplerianos
//     aproximados de JPL (válidos 1800–2050) + precesión a la fecha. Precisión:
//     signo siempre correcto, grados dentro de ~1° (más que suficiente).
//   - Retrógrados: por diferencia de longitud entre la fecha y el día siguiente.
//   - Aspectos: se calculan automáticamente entre todos los cuerpos (orbes
//     estándar).
//   - Luna: fase/iluminación con suncalc + signo con el método de Schlyter.
// El objetivo es inyectar efemérides verificables en el prompt para que el
// modelo NO invente posiciones (Claude se equivoca gravemente con los planetas).
// ============================================================================

import SunCalc from 'suncalc';

const TZ = 'America/Guatemala';
const DEG = Math.PI / 180;

const sind = (x: number) => Math.sin(x * DEG);
const cosd = (x: number) => Math.cos(x * DEG);
const atan2d = (y: number, x: number) => Math.atan2(y, x) / DEG;
const rev = (deg: number) => ((deg % 360) + 360) % 360;

// Nombres de signos (sin símbolo) y con símbolo para distintos usos.
const SIGNOS_NOMBRE = [
  'Aries', 'Tauro', 'Géminis', 'Cáncer', 'Leo', 'Virgo',
  'Libra', 'Escorpio', 'Sagitario', 'Capricornio', 'Acuario', 'Piscis',
];
const SIGNOS = [
  '♈ Aries', '♉ Tauro', '♊ Géminis', '♋ Cáncer', '♌ Leo', '♍ Virgo',
  '♎ Libra', '♏ Escorpio', '♐ Sagitario', '♑ Capricornio', '♒ Acuario', '♓ Piscis',
];

// ── Posiciones planetarias (elementos keplerianos JPL 1800–2050) ─────────────
//
// a(AU) e I(°) L(°) ϖ(°) Ω(°) en J2000 + tasas por siglo (sufijo d).
// b,c,s,f: términos extra para la anomalía media de Júpiter…Plutón.

interface ElementosKepler {
  a0: number; ad: number; e0: number; ed: number; I0: number; Id: number;
  L0: number; Ld: number; w0: number; wd: number; O0: number; Od: number;
  b?: number; c?: number; s?: number; f?: number;
}

const EL: Record<string, ElementosKepler> = {
  EARTH:  { a0: 1.00000261, ad: 0.00000562, e0: 0.01671123, ed: -0.00004392, I0: -0.00001531, Id: -0.01294668, L0: 100.46457166, Ld: 35999.37244981, w0: 102.93768193, wd: 0.32327364, O0: 0.0, Od: 0.0 },
  MERC:   { a0: 0.38709927, ad: 0.00000037, e0: 0.20563593, ed: 0.00001906, I0: 7.00497902, Id: -0.00594749, L0: 252.25032350, Ld: 149472.67411175, w0: 77.45779628, wd: 0.16047689, O0: 48.33076593, Od: -0.12534081 },
  VENUS:  { a0: 0.72333566, ad: 0.00000390, e0: 0.00677672, ed: -0.00004107, I0: 3.39467605, Id: -0.00078890, L0: 181.97909950, Ld: 58517.81538729, w0: 131.60246718, wd: 0.00268329, O0: 76.67984255, Od: -0.27769418 },
  MARS:   { a0: 1.52371034, ad: 0.00001847, e0: 0.09339410, ed: 0.00007882, I0: 1.84969142, Id: -0.00813131, L0: -4.55343205, Ld: 19140.30268499, w0: -23.94362959, wd: 0.44441088, O0: 49.55953891, Od: -0.29257343 },
  JUP:    { a0: 5.20288700, ad: -0.00011607, e0: 0.04838624, ed: -0.00013253, I0: 1.30439695, Id: -0.00183714, L0: 34.39644051, Ld: 3034.74612775, w0: 14.72847983, wd: 0.21252668, O0: 100.47390909, Od: 0.20469106, b: -0.00012452, c: 0.06064060, s: -0.35635438, f: 38.35125 },
  SAT:    { a0: 9.53667594, ad: -0.00125060, e0: 0.05386179, ed: -0.00050991, I0: 2.48599187, Id: 0.00193609, L0: 49.95424423, Ld: 1222.49362201, w0: 92.59887831, wd: -0.41897216, O0: 113.66242448, Od: -0.28867794, b: 0.00025899, c: -0.13434469, s: 0.87320147, f: 38.35125 },
  URA:    { a0: 19.18916464, ad: -0.00196176, e0: 0.04725744, ed: -0.00004397, I0: 0.77263783, Id: -0.00242939, L0: 313.23810451, Ld: 428.48202785, w0: 170.95427630, wd: 0.40805281, O0: 74.01692503, Od: 0.04240589, b: 0.00058331, c: -0.97731848, s: 0.17689245, f: 7.67025 },
  NEP:    { a0: 30.06992276, ad: 0.00026291, e0: 0.00859048, ed: 0.00005105, I0: 1.77004347, Id: 0.00035372, L0: -55.12002969, Ld: 218.45945325, w0: 44.96476227, wd: -0.32241464, O0: 131.78422574, Od: -0.00508664, b: -0.00041348, c: 0.68346318, s: -0.10162547, f: 7.67025 },
  PLU:    { a0: 39.48211675, ad: -0.00031596, e0: 0.24882730, ed: 0.00005170, I0: 17.14001206, Id: 0.00004818, L0: 238.92903833, Ld: 145.20780515, w0: 224.06891629, wd: -0.04062942, O0: 110.30393684, Od: -0.01183482, b: -0.01262724 },
};

// Siglos julianos desde J2000.0 (TT ≈ UTC para esta precisión).
function siglosJ2000(fecha: Date): number {
  const JD = fecha.getTime() / 86_400_000 + 2440587.5;
  return (JD - 2451545.0) / 36525;
}

function kepler(M: number, e: number): number {
  const eStar = e * 180 / Math.PI;
  let E = M + eStar * sind(M);
  for (let i = 0; i < 12; i++) {
    const dM = M - (E - eStar * sind(E));
    const dE = dM / (1 - e * cosd(E));
    E += dE;
    if (Math.abs(dE) < 1e-8) break;
  }
  return E;
}

// Coordenadas eclípticas heliocéntricas (J2000) rectangulares de un cuerpo.
function helio(el: ElementosKepler, T: number): { x: number; y: number; z: number } {
  const a = el.a0 + el.ad * T;
  const e = el.e0 + el.ed * T;
  const I = el.I0 + el.Id * T;
  const L = el.L0 + el.Ld * T;
  const wbar = el.w0 + el.wd * T;
  const O = el.O0 + el.Od * T;
  const arg = wbar - O; // argumento del perihelio
  let M = L - wbar;
  if (el.b !== undefined) {
    M += el.b * T * T + (el.c ?? 0) * cosd((el.f ?? 0) * T) + (el.s ?? 0) * sind((el.f ?? 0) * T);
  }
  M = rev(M + 180) - 180;
  const E = kepler(M, e);
  const xp = a * (cosd(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * sind(E);
  const cw = cosd(arg), sw = sind(arg), cO = cosd(O), sO = sind(O), cI = cosd(I), sI = sind(I);
  return {
    x: (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    y: (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    z: (sw * sI) * xp + (cw * sI) * yp,
  };
}

// Longitud eclíptica geocéntrica de fecha (grados) de un planeta.
function geoLon(el: ElementosKepler, T: number): number {
  const p = helio(el, T);
  const ea = helio(EL.EARTH, T);
  const lonJ2000 = rev(atan2d(p.y - ea.y, p.x - ea.x));
  return rev(lonJ2000 + 1.39697 * T); // + precesión general a la fecha
}

// Longitud eclíptica geocéntrica del Sol (opuesto a la Tierra heliocéntrica).
function sunLon(T: number): number {
  const ea = helio(EL.EARTH, T);
  return rev(atan2d(-ea.y, -ea.x) + 1.39697 * T);
}

// ── Luna (Schlyter) ──────────────────────────────────────────────────────────

function longitudLunar(fecha: Date): number {
  const d = fecha.getTime() / 86_400_000 - 10_956.0;
  const ws = 282.9404 + 4.70935e-5 * d;
  const Ms = rev(356.0470 + 0.9856002585 * d);
  const Ls = ws + Ms;
  const N = 125.1228 - 0.0529538083 * d;
  const i = 5.1454;
  const w = 318.0634 + 0.1643573223 * d;
  const M = rev(115.3654 + 13.0649929509 * d);
  const e = 0.054900;
  const a = 60.2666;
  let E = M + (180 / Math.PI) * e * sind(M) * (1 + e * cosd(M));
  for (let k = 0; k < 3; k++) {
    E = E - (E - (180 / Math.PI) * e * sind(E) - M) / (1 - e * cosd(E));
  }
  const x = a * (cosd(E) - e);
  const y = a * Math.sqrt(1 - e * e) * sind(E);
  const r = Math.sqrt(x * x + y * y);
  const v = atan2d(y, x);
  const vw = (v + w);
  let lon = atan2d(
    r * (sind(N) * cosd(vw) + cosd(N) * sind(vw) * cosd(i)),
    r * (cosd(N) * cosd(vw) - sind(N) * sind(vw) * cosd(i)),
  );
  const Lm = N + w + M;
  const D = Lm - Ls;
  const F = Lm - N;
  lon +=
    -1.274 * sind(M - 2 * D) + 0.658 * sind(2 * D) - 0.186 * sind(Ms) -
    0.059 * sind(2 * M - 2 * D) - 0.057 * sind(M - 2 * D + Ms) + 0.053 * sind(M + 2 * D) +
    0.046 * sind(2 * D - Ms) + 0.041 * sind(M - Ms) - 0.035 * sind(D) -
    0.031 * sind(M + Ms) - 0.015 * sind(2 * F - 2 * D) + 0.011 * sind(M - 4 * D);
  return rev(lon);
}

function signoLunar(fecha: Date): string {
  return SIGNOS[Math.floor(longitudLunar(fecha) / 30) % 12];
}

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

function etiquetaDia(fecha: Date): string {
  const s = fecha
    .toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'short', timeZone: TZ })
    .replace(',', '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Posiciones planetarias + aspectos ────────────────────────────────────────

interface Cuerpo { nombre: string; simbolo: string; lon: number; retro: boolean; sun?: boolean; }

const PLANETAS: { nombre: string; simbolo: string; el?: ElementosKepler; sun?: boolean }[] = [
  { nombre: 'Sol', simbolo: '☀️', sun: true },
  { nombre: 'Mercurio', simbolo: '☿', el: EL.MERC },
  { nombre: 'Venus', simbolo: '♀', el: EL.VENUS },
  { nombre: 'Marte', simbolo: '♂', el: EL.MARS },
  { nombre: 'Júpiter', simbolo: '♃', el: EL.JUP },
  { nombre: 'Saturno', simbolo: '♄', el: EL.SAT },
  { nombre: 'Urano', simbolo: '♅', el: EL.URA },
  { nombre: 'Neptuno', simbolo: '♆', el: EL.NEP },
  { nombre: 'Plutón', simbolo: '♇', el: EL.PLU },
];

// Calcula longitud + retrógrado de cada planeta para una fecha, más la Luna.
function cuerpos(fecha: Date): Cuerpo[] {
  const T = siglosJ2000(fecha);
  const dT = 1 / 36525; // 1 día en siglos, para detectar retrógrado
  const lista: Cuerpo[] = [];
  for (const p of PLANETAS) {
    let lon: number, retro = false;
    if (p.sun) {
      lon = sunLon(T);
    } else {
      lon = geoLon(p.el!, T);
      let d = geoLon(p.el!, T + dT) - lon;
      if (d > 180) d -= 360; if (d < -180) d += 360;
      retro = d < 0;
    }
    lista.push({ nombre: p.nombre, simbolo: p.simbolo, lon, retro, sun: p.sun });
  }
  // Luna (no se marca retrógrada).
  lista.push({ nombre: 'Luna', simbolo: '☽', lon: longitudLunar(fecha), retro: false });
  return lista;
}

// "20°54' Géminis"
function formatoPosicion(lon: number): string {
  const signo = Math.floor(lon / 30) % 12;
  let within = lon - signo * 30;
  let deg = Math.floor(within);
  let min = Math.round((within - deg) * 60);
  if (min === 60) { min = 0; deg += 1; }
  return `${deg}°${String(min).padStart(2, '0')}' ${SIGNOS_NOMBRE[signo]}`;
}

const ASPECTOS = [
  { nombre: 'conjunción', simbolo: '☌', angulo: 0, orbe: 8 },
  { nombre: 'sextil', simbolo: '⚹', angulo: 60, orbe: 6 },
  { nombre: 'cuadratura', simbolo: '□', angulo: 90, orbe: 8 },
  { nombre: 'trígono', simbolo: '△', angulo: 120, orbe: 8 },
  { nombre: 'oposición', simbolo: '☍', angulo: 180, orbe: 8 },
];

// Aspectos reales entre todos los pares de cuerpos, dentro de orbe estándar.
function calcularAspectos(lista: Cuerpo[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      let diff = Math.abs(lista[i].lon - lista[j].lon);
      if (diff > 180) diff = 360 - diff;
      for (const asp of ASPECTOS) {
        const orbe = Math.abs(diff - asp.angulo);
        if (orbe <= asp.orbe) {
          out.push(
            `${lista[i].simbolo} ${lista[i].nombre} ${asp.simbolo} ${lista[j].simbolo} ${lista[j].nombre} ` +
            `(${asp.nombre}, orbe ${orbe.toFixed(1)}°)`,
          );
          break; // un par solo forma un aspecto a la vez
        }
      }
    }
  }
  return out;
}

// Líneas de la Luna para los 7 días de la semana (fase, iluminación, signo).
function lineasLunares(inicio: Date): string[] {
  const lineas: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dia = new Date(inicio);
    dia.setDate(dia.getDate() + i);
    dia.setHours(12, 0, 0, 0);
    const { fraction, phase } = SunCalc.getMoonIllumination(dia);
    const fase = nombreFase(phase, fraction);
    const pct = Math.round(fraction * 100);
    const ilum = fase === 'Luna Nueva' ? '~0% iluminación' : `${pct}% iluminación`;
    lineas.push(`- ${etiquetaDia(dia)}: ${fase}, ${ilum}, Luna en ${signoLunar(dia)}`);
  }
  return lineas;
}

// Bloque de DATOS ASTRONÓMICOS REALES (posiciones planetarias + luna + aspectos)
// para inyectar en el prompt del usuario. Las posiciones se calculan para el
// inicio de la semana (referencia); la Luna se detalla día a día.
export function bloqueDatosAstronomicos(inicio: Date): string {
  const ref = new Date(inicio);
  ref.setHours(12, 0, 0, 0);
  const lista = cuerpos(ref);
  const planetas = lista.filter((c) => c.nombre !== 'Luna');

  const lineasPlanetas = planetas.map(
    (p) => `${p.simbolo} ${p.nombre}: ${formatoPosicion(p.lon)}${p.retro ? ' (R)' : ''}`,
  );
  const aspectos = calcularAspectos(lista);

  return [
    'DATOS ASTRONÓMICOS REALES (usa EXACTAMENTE estos, NO inventes posiciones):',
    '',
    `POSICIONES PLANETARIAS (referencia: ${etiquetaDia(ref)}):`,
    ...lineasPlanetas,
    '',
    'DATOS LUNARES (día a día):',
    ...lineasLunares(inicio),
    '',
    'ASPECTOS REALES (calculados con orbes estándar):',
    ...(aspectos.length ? aspectos.map((a) => `- ${a}`) : ['- (sin aspectos exactos dentro de orbe esta semana)']),
    '',
    'INSTRUCCIÓN CRÍTICA: Usa EXACTAMENTE los datos proporcionados arriba (posiciones, ' +
    'signos, retrógrados, fases de la Luna y aspectos). NO cambies los signos de los ' +
    'planetas: si Júpiter está en Cáncer, NO digas que está en Géminis. Para la sección ' +
    'de TRÁNSITOS usa los aspectos reales listados; NO inventes aspectos que no estén aquí.',
  ].join('\n');
}
