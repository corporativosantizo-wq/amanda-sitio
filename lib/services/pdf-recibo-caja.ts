// ============================================================================
// lib/services/pdf-recibo-caja.ts
// Genera el PDF del Recibo de Caja (RC-NNNN) usando pdf-lib.
// Comprobante NO fiscal de pagos de gastos del trámite.
// ============================================================================

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { EMISOR } from '@/lib/config/emisor';
import { montoALetras } from '@/lib/utils/numeros-letras';

// ── Paleta navy + cyan (alineada con la cotización y la factura) ─────────────

const C = {
  navy:        rgb(15 / 255, 23 / 255, 42 / 255),       // #0F172A — texto principal
  steel:       rgb(51 / 255, 65 / 255, 85 / 255),       // #334155 — secundario
  muted:       rgb(100 / 255, 116 / 255, 139 / 255),    // #64748B — labels
  slate:       rgb(148 / 255, 163 / 255, 184 / 255),    // #94A3B8 — terciarios
  border:      rgb(203 / 255, 213 / 255, 225 / 255),    // #CBD5E1
  bgSubtle:    rgb(248 / 255, 250 / 255, 252 / 255),    // #F8FAFC
  cyan:        rgb(34 / 255, 211 / 255, 238 / 255),     // #22D3EE — accent
  cyanLight:   rgb(207 / 255, 250 / 255, 254 / 255),    // #CFFAFE — badge
  white:       rgb(1, 1, 1),
};

// Gradiente navy → cyan para la línea separadora
const GRAD = [
  rgb(15 / 255, 23 / 255, 42 / 255),    // #0F172A navy
  rgb(20 / 255, 78 / 255, 116 / 255),   // navy/cyan mix
  rgb(8 / 255, 145 / 255, 178 / 255),   // #0891B2 cyan-700
  rgb(34 / 255, 211 / 255, 238 / 255),  // #22D3EE cyan
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatQ(n: number): string {
  return `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatFechaLarga(iso: string): string {
  const d = new Date(iso);
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

function safeText(text: string): string {
  return text
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/‘/g, "'")
    .replace(/’/g, "'")
    .replace(/“/g, '"')
    .replace(/”/g, '"')
    .replace(/…/g, '...')
    .replace(/·/g, '.')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '');
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, fontSize) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function drawTextRight(page: PDFPage, text: string, rightX: number, y: number, font: PDFFont, size: number, color: ReturnType<typeof rgb>) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightX - w, y, size, font, color });
}

function drawGradientLine(page: PDFPage, x: number, y: number, width: number, height: number) {
  const segW = width / GRAD.length;
  GRAD.forEach((color, i) => {
    page.drawRectangle({ x: x + i * segW, y, width: segW, height, color });
  });
}

async function loadLogo(doc: PDFDocument): Promise<PDFImage | null> {
  const candidates = [
    'Logo Amanda Santizo 2021_Full Color.png',
    'Logo_Amanda_Santizo_2021_Full_Color.png',
    'Logo_Amanda_Santizo_2021_Full_Color.jpg',
  ];
  for (const file of candidates) {
    try {
      const bytes = fs.readFileSync(path.join(process.cwd(), 'public', file));
      return file.endsWith('.png') ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    } catch { /* try next */ }
  }
  return null;
}

// ── Input shape ──────────────────────────────────────────────────────────────

export interface ReciboCajaPDFInput {
  numero: string;          // 'RC-0001'
  fechaEmision: string;    // ISO timestamptz
  monto: number;
  concepto: string;
  cliente: {
    nombre: string;
    nit?: string | null;
    dpi?: string | null;
    direccion?: string | null;
  };
  cotizacionNumero?: string | null;
  expedienteNumero?: string | null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function generarPDFReciboCaja(input: ReciboCajaPDFInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 612;
  const H = 792;
  const M = 50;
  const CW = W - 2 * M;

  const logo = await loadLogo(doc);

  const page = doc.addPage([W, H]);
  let y = H - 45;

  // ── 1. Header: logo / brand izquierda + RECIBO DE CAJA + número derecha ─

  if (logo) {
    const dims = logo.scaleToFit(150, 48);
    page.drawImage(logo, { x: M, y: y - dims.height + 8, width: dims.width, height: dims.height });
  } else {
    page.drawText(safeText(EMISOR.profesionalCorto), { x: M, y, size: 14, font: bold, color: C.navy });
    page.drawText(safeText(EMISOR.nombreComercial), { x: M, y: y - 13, size: 9, font: regular, color: C.muted });
  }

  drawTextRight(page, 'RECIBO DE CAJA', W - M, y, bold, 16, C.navy);
  drawTextRight(page, input.numero, W - M, y - 20, bold, 12, C.cyan);
  drawTextRight(page, safeText(formatFechaLarga(input.fechaEmision)), W - M, y - 34, regular, 8.5, C.muted);

  y -= 55;

  // ── 2. Línea gradiente navy → cyan ─────────────────────────────────────

  drawGradientLine(page, M, y, CW, 2);
  y -= 22;

  // ── 3. Badge: comprobante no fiscal ─────────────────────────────────────

  const badgeText = safeText('COMPROBANTE NO FISCAL');
  const badgeW = bold.widthOfTextAtSize(badgeText, 8) + 24;
  const badgeH = 20;
  page.drawRectangle({ x: M, y: y - badgeH, width: badgeW, height: badgeH, color: C.cyanLight });
  page.drawText(badgeText, { x: M + 12, y: y - badgeH + 6, size: 8, font: bold, color: C.navy });
  y -= badgeH + 22;

  // ── 4. Datos del cliente (caja con borde cyan a la izquierda) ──────────

  const cliRows: Array<{ label: string; value: string }> = [
    { label: 'Nombre',    value: input.cliente.nombre },
    { label: 'NIT',       value: input.cliente.nit ?? 'CF' },
  ];
  if (input.cliente.dpi)       cliRows.push({ label: 'DPI',       value: input.cliente.dpi });
  if (input.cliente.direccion) cliRows.push({ label: 'Dirección', value: input.cliente.direccion });

  // Calcular alto previo (cada fila ~14px + título 22px + padding 14)
  const cliBoxPadX = 14;
  const cliMaxValW = CW - cliBoxPadX * 2 - 70;
  let cliInnerH = 22; // título
  const cliWrapped: string[][] = [];
  for (const r of cliRows) {
    const lines = wrapText(safeText(r.value), regular, 9, cliMaxValW);
    cliWrapped.push(lines);
    cliInnerH += Math.max(14, lines.length * 11 + 3);
  }
  cliInnerH += 8;

  page.drawRectangle({ x: M, y: y - cliInnerH, width: CW, height: cliInnerH, color: C.bgSubtle });
  page.drawRectangle({ x: M, y: y - cliInnerH, width: 3, height: cliInnerH, color: C.cyan });
  page.drawText('DATOS DEL CLIENTE', { x: M + cliBoxPadX, y: y - 14, size: 8, font: bold, color: C.navy });

  let yCli = y - 30;
  for (let i = 0; i < cliRows.length; i++) {
    page.drawText(cliRows[i].label, { x: M + cliBoxPadX, y: yCli, size: 7.5, font: regular, color: C.muted });
    const lines = cliWrapped[i];
    for (let l = 0; l < lines.length; l++) {
      page.drawText(lines[l], { x: M + cliBoxPadX + 68, y: yCli - l * 11, size: 9, font: regular, color: C.steel });
    }
    yCli -= Math.max(14, lines.length * 11 + 3);
  }

  y -= cliInnerH + 18;

  // ── 5. Concepto + referencias ──────────────────────────────────────────

  page.drawText('CONCEPTO', { x: M, y, size: 8, font: bold, color: C.navy });
  y -= 14;

  const conceptoLines = wrapText(safeText(input.concepto), regular, 10, CW);
  for (const line of conceptoLines) {
    page.drawText(line, { x: M, y, size: 10, font: regular, color: C.steel });
    y -= 13;
  }
  y -= 4;

  if (input.cotizacionNumero) {
    page.drawText(safeText(`Cotización: ${input.cotizacionNumero}`), { x: M, y, size: 8.5, font: regular, color: C.muted });
    y -= 12;
  }
  if (input.expedienteNumero) {
    page.drawText(safeText(`Expediente: ${input.expedienteNumero}`), { x: M, y, size: 8.5, font: regular, color: C.muted });
    y -= 12;
  }

  y -= 14;

  // ── 6. Monto destacado ─────────────────────────────────────────────────

  const montoBoxH = 64;
  page.drawRectangle({ x: M, y: y - montoBoxH, width: CW, height: montoBoxH, color: C.white, borderColor: C.cyan, borderWidth: 1 });
  page.drawRectangle({ x: M, y: y - montoBoxH, width: 6, height: montoBoxH, color: C.cyan });

  page.drawText('MONTO RECIBIDO', { x: M + 18, y: y - 18, size: 8, font: bold, color: C.muted });
  drawTextRight(page, safeText(formatQ(input.monto)), M + CW - 18, y - 28, bold, 22, C.navy);

  // Monto en letras (segunda línea, wrapped si es muy largo)
  const letras = safeText(montoALetras(input.monto));
  const letrasLines = wrapText(letras, regular, 9, CW - 36);
  let yLetras = y - 42;
  for (const line of letrasLines) {
    page.drawText(line, { x: M + 18, y: yLetras, size: 9, font: regular, color: C.steel });
    yLetras -= 11;
  }

  y -= montoBoxH + 22;

  // ── 7. Aclaratoria fiscal ──────────────────────────────────────────────

  const aclar = safeText(
    'Este Recibo de Caja respalda el pago de gastos del trámite (timbres, tasas, viáticos, etc.) ' +
    'y NO sustituye a la factura fiscal. Los honorarios profesionales se respaldan en factura aparte.'
  );
  const aclarLines = wrapText(aclar, regular, 7.5, CW);
  for (const line of aclarLines) {
    page.drawText(line, { x: M, y, size: 7.5, font: regular, color: C.muted });
    y -= 10;
  }
  y -= 18;

  // ── 8. Firma ───────────────────────────────────────────────────────────

  const sigW = 200;
  const sigX = M + CW - sigW;
  page.drawRectangle({ x: sigX, y: y, width: sigW, height: 0.5, color: C.border });
  const sigName = safeText(EMISOR.profesionalCorto);
  page.drawText(sigName, { x: sigX + (sigW - bold.widthOfTextAtSize(sigName, 9)) / 2, y: y - 12, size: 9, font: bold, color: C.navy });
  const sigSub = safeText(`Colegiado No. ${EMISOR.colegiado}`);
  page.drawText(sigSub, { x: sigX + (sigW - regular.widthOfTextAtSize(sigSub, 7.5)) / 2, y: y - 23, size: 7.5, font: regular, color: C.muted });

  // ── 9. Footer con datos del emisor ─────────────────────────────────────

  const footerY = 38;
  page.drawRectangle({ x: M, y: footerY + 6, width: CW, height: 0.5, color: C.border });

  const f1 = safeText(`${EMISOR.nombreComercial} - ${EMISOR.profesional} - NIT ${EMISOR.nit}`);
  const f1w = regular.widthOfTextAtSize(f1, 7);
  page.drawText(f1, { x: (W - f1w) / 2, y: footerY - 6, size: 7, font: regular, color: C.slate });

  const f2 = safeText(`${EMISOR.direccion}`);
  const f2w = regular.widthOfTextAtSize(f2, 6.5);
  page.drawText(f2, { x: (W - f2w) / 2, y: footerY - 16, size: 6.5, font: regular, color: C.slate });

  const f3 = safeText(`Tel: ${EMISOR.telefono}  |  ${EMISOR.email}  |  ${EMISOR.web}`);
  const f3w = regular.widthOfTextAtSize(f3, 6.5);
  page.drawText(f3, { x: (W - f3w) / 2, y: footerY - 25, size: 6.5, font: regular, color: C.slate });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
