// ============================================================================
// lib/services/pdf-cotizacion.ts
// Genera PDF formal de cotización usando pdf-lib
// ============================================================================

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage } from 'pdf-lib';
import type { CotizacionConCliente } from '@/lib/types';
import fs from 'fs';
import path from 'path';

// ── Paleta de colores (tonos suaves) ─────────────────────────────────────────

const C = {
  navy:        rgb(15 / 255, 23 / 255, 42 / 255),      // #0F172A — textos principales
  steel:       rgb(51 / 255, 65 / 255, 85 / 255),       // #334155 — textos secundarios
  muted:       rgb(100 / 255, 116 / 255, 139 / 255),    // #64748B — labels
  slate:       rgb(148 / 255, 163 / 255, 184 / 255),    // #94A3B8 — terciarios
  border:      rgb(203 / 255, 213 / 255, 225 / 255),    // #CBD5E1 — bordes
  bgSubtle:    rgb(248 / 255, 250 / 255, 252 / 255),    // #F8FAFC — fondo sutil
  accent:      rgb(37 / 255, 99 / 255, 235 / 255),      // #2563EB — detalles
  accentLight: rgb(219 / 255, 234 / 255, 254 / 255),    // #DBEAFE — badges
  tableBorder: rgb(241 / 255, 245 / 255, 249 / 255),    // #F1F5F9 — bordes tabla
  white:       rgb(1, 1, 1),
};

// Colores para segmentos del gradiente simulado
const GRAD = [
  rgb(30 / 255, 58 / 255, 138 / 255),   // #1E3A8A
  rgb(33 / 255, 78 / 255, 186 / 255),   // interpolado
  rgb(37 / 255, 99 / 255, 235 / 255),   // #2563EB
  rgb(33 / 255, 78 / 255, 186 / 255),   // interpolado
  rgb(30 / 255, 58 / 255, 138 / 255),   // #1E3A8A
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatQ(n: number): string {
  return `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatFechaGT(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00');
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(test, fontSize);
    if (width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

function safeText(text: string): string {
  return text
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u00B7/g, '.')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '');
}

function drawGradientLine(page: PDFPage, x: number, y: number, width: number, height: number) {
  const segW = width / GRAD.length;
  GRAD.forEach((color, i) => {
    page.drawRectangle({ x: x + i * segW, y, width: segW, height, color });
  });
}

function drawTextRight(page: PDFPage, text: string, rightX: number, y: number, font: PDFFont, size: number, color: ReturnType<typeof rgb>) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightX - w, y, size, font, color });
}

async function loadLogo(doc: PDFDocument): Promise<PDFImage | null> {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'Logo_Amanda_Santizo_2021_Full_Color.png');
    const logoBytes = fs.readFileSync(logoPath);
    return await doc.embedPng(logoBytes);
  } catch {
    try {
      const logoPath = path.join(process.cwd(), 'public', 'Logo_Amanda_Santizo_2021_Full_Color.jpg');
      const logoBytes = fs.readFileSync(logoPath);
      return await doc.embedJpg(logoBytes);
    } catch {
      return null;
    }
  }
}

// ── Main function ────────────────────────────────────────────────────────────

export async function generarPDFCotizacion(
  cotizacion: CotizacionConCliente,
  configuracion: Record<string, any>,
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 612;
  const H = 792;
  const M = 50;
  const CW = W - 2 * M;

  const logo = await loadLogo(doc);

  let page = doc.addPage([W, H]);
  let y = H - 45;

  // Helper: new page if not enough space
  function ensureSpace(needed: number) {
    if (y - needed < 70) {
      page = doc.addPage([W, H]);
      y = H - 45;
    }
  }

  // ── 1. HEADER — Logo izq, cotización info der ────────────────────────

  if (logo) {
    const dims = logo.scaleToFit(150, 48);
    page.drawImage(logo, { x: M, y: y - dims.height + 8, width: dims.width, height: dims.height });
  } else {
    page.drawText('Amanda Santizo', { x: M, y, size: 16, font: bold, color: C.navy });
    page.drawText('Despacho Juridico', { x: M, y: y - 14, size: 9, font: regular, color: C.muted });
  }

  // Right: cotización number and date
  const cotLabel = 'COTIZACION';
  drawTextRight(page, cotLabel, W - M, y, bold, 16, C.navy);

  const numText = cotizacion.numero;
  drawTextRight(page, numText, W - M, y - 20, bold, 10, C.accent);

  const fechaText = safeText(formatFechaGT(cotizacion.fecha_emision));
  drawTextRight(page, fechaText, W - M, y - 34, regular, 8.5, C.muted);

  y -= 55;

  // ── 2. LINEA GRADIENTE ───────────────────────────────────────────────

  drawGradientLine(page, M, y, CW, 2);
  y -= 22;

  // ── 3. DOS COLUMNAS — Cliente (izq) / Abogada (der) ─────────────────

  const colLeftX = M;
  const colRightX = M + CW / 2 + 15;
  const colWidth = CW / 2 - 15;
  let yLeft = y;
  let yRight = y;

  // Left: Cliente
  page.drawText('DATOS DEL CLIENTE', { x: colLeftX, y: yLeft, size: 8, font: bold, color: C.accent });
  yLeft -= 16;

  const cliente = cotizacion.cliente;
  const clienteData = [
    { label: 'Nombre', value: cliente.nombre },
    { label: 'NIT', value: cliente.nit ?? 'CF' },
    { label: 'Email', value: cliente.email ?? 'N/A' },
  ];

  for (const item of clienteData) {
    page.drawText(item.label, { x: colLeftX, y: yLeft, size: 7.5, font: regular, color: C.muted });
    const valLines = wrapText(safeText(item.value), regular, 8.5, colWidth - 50);
    for (let l = 0; l < valLines.length; l++) {
      page.drawText(valLines[l], { x: colLeftX + 48, y: yLeft - l * 11, size: 8.5, font: regular, color: C.steel });
    }
    yLeft -= Math.max(14, valLines.length * 11 + 3);
  }

  // Right: Abogada
  page.drawText('ABOGADA', { x: colRightX, y: yRight, size: 8, font: bold, color: C.accent });
  yRight -= 16;

  page.drawText('Licda. Amanda Santizo', { x: colRightX, y: yRight, size: 8.5, font: bold, color: C.navy });
  yRight -= 13;
  page.drawText('Colegiado No. 19565', { x: colRightX, y: yRight, size: 8, font: regular, color: C.steel });
  yRight -= 13;

  const dir = safeText(String(configuracion.direccion_despacho ?? 'Ciudad de Guatemala'));
  const dirLines = wrapText(dir, regular, 8, colWidth);
  for (const dl of dirLines) {
    page.drawText(dl, { x: colRightX, y: yRight, size: 8, font: regular, color: C.muted });
    yRight -= 11;
  }

  const tel = String(configuracion.telefono_despacho ?? '');
  if (tel) {
    page.drawText(safeText(`Tel: ${tel}`), { x: colRightX, y: yRight, size: 8, font: regular, color: C.muted });
    yRight -= 11;
  }

  y = Math.min(yLeft, yRight) - 10;

  // ── 4. BADGE "Válida por 30 días" ────────────────────────────────────

  const badgeText = safeText('Valida por 30 dias');
  const badgeW = bold.widthOfTextAtSize(badgeText, 8) + 24;
  const badgeH = 20;

  page.drawRectangle({ x: M, y: y - badgeH, width: badgeW, height: badgeH, color: C.accentLight });
  page.drawText(badgeText, { x: M + 12, y: y - badgeH + 6, size: 8, font: bold, color: C.accent });
  y -= badgeH + 16;

  // ── 5. TABLA DE SERVICIOS — 4 columnas ──────────────────────────────

  const colNo    = M;
  const colServ  = M + 32;
  const colCant  = M + CW - 110;
  const colTot   = M + CW - 55;
  const tblRight = M + CW;

  // Table header
  const thH = 26;
  page.drawRectangle({ x: M, y: y - thH, width: CW, height: thH, color: C.bgSubtle });
  page.drawRectangle({ x: M, y: y - thH, width: CW, height: 0.5, color: C.tableBorder });
  page.drawRectangle({ x: M, y: y, width: CW, height: 0.5, color: C.tableBorder });

  const thY = y - 17;
  page.drawText('No.', { x: colNo + 6, y: thY, size: 7.5, font: bold, color: C.muted });
  page.drawText('Servicio', { x: colServ, y: thY, size: 7.5, font: bold, color: C.muted });
  drawTextRight(page, 'Cant.', colCant + 40, thY, bold, 7.5, C.muted);
  drawTextRight(page, 'Total (Q)', tblRight - 4, thY, bold, 7.5, C.muted);

  y -= thH;

  // Table rows
  const items = cotizacion.items ?? [];
  const descMaxW = colCant - colServ - 12;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const descLines = wrapText(safeText(item.descripcion), regular, 8.5, descMaxW);
    const rowH = Math.max(22, descLines.length * 12 + 10);

    ensureSpace(rowH + 10);

    // Alternating row bg
    if (i % 2 === 0) {
      page.drawRectangle({ x: M, y: y - rowH, width: CW, height: rowH, color: C.bgSubtle });
    }

    // Bottom border
    page.drawRectangle({ x: M, y: y - rowH, width: CW, height: 0.5, color: C.tableBorder });

    const textY = y - 15;

    // No.
    page.drawText(String(i + 1), { x: colNo + 10, y: textY, size: 8.5, font: regular, color: C.muted });

    // Descripción
    for (let l = 0; l < descLines.length; l++) {
      page.drawText(descLines[l], { x: colServ, y: textY - l * 12, size: 8.5, font: regular, color: C.steel });
    }

    // Cantidad
    const cantText = String(item.cantidad);
    drawTextRight(page, cantText, colCant + 40, textY, regular, 8.5, C.steel);

    // Total
    const totText = safeText(formatQ(item.total));
    drawTextRight(page, totText, tblRight - 4, textY, regular, 8.5, C.navy);

    y -= rowH;
  }

  y -= 18;

  // ── 6. TOTALES — alineados a la derecha ──────────────────────────────

  ensureSpace(80);

  const totLabelX = M + CW - 200;
  const totValX = tblRight - 4;

  // Subtotal
  page.drawText('Subtotal', { x: totLabelX, y, size: 9, font: regular, color: C.muted });
  drawTextRight(page, safeText(formatQ(cotizacion.subtotal)), totValX, y, regular, 9, C.steel);
  y -= 16;

  // IVA 12%
  page.drawText('IVA (12%)', { x: totLabelX, y, size: 9, font: regular, color: C.muted });
  drawTextRight(page, safeText(formatQ(cotizacion.iva_monto)), totValX, y, regular, 9, C.steel);
  y -= 8;

  // Separator
  page.drawRectangle({ x: totLabelX, y, width: totValX - totLabelX + 4, height: 1, color: C.border });
  y -= 16;

  // TOTAL
  page.drawText('TOTAL', { x: totLabelX, y, size: 13, font: bold, color: C.navy });
  drawTextRight(page, safeText(formatQ(cotizacion.total)), totValX, y, bold, 13, C.navy);
  y -= 18;

  // Anticipo (opcional)
  if (cotizacion.requiere_anticipo && cotizacion.anticipo_monto > 0) {
    const antLabel = safeText(`Anticipo (${cotizacion.anticipo_porcentaje}%)`);
    page.drawText(antLabel, { x: totLabelX, y, size: 9, font: regular, color: C.accent });
    drawTextRight(page, safeText(formatQ(cotizacion.anticipo_monto)), totValX, y, bold, 9, C.accent);
    y -= 16;
  }

  y -= 10;

  // ── 7. CONDICIONES DE PAGO — caja con borde izq azul ────────────────

  if (cotizacion.condiciones) {
    const condLines = cotizacion.condiciones.split('\n');
    const allWrapped: string[][] = [];
    let condHeight = 26; // title + padding

    for (const line of condLines) {
      const wrapped = wrapText(safeText(line.trim()), regular, 8, CW - 22);
      allWrapped.push(wrapped);
      condHeight += wrapped.length * 11 + 2;
    }

    ensureSpace(condHeight + 10);

    // Background box
    page.drawRectangle({ x: M, y: y - condHeight, width: CW, height: condHeight, color: C.bgSubtle });
    // Left blue border
    page.drawRectangle({ x: M, y: y - condHeight, width: 3, height: condHeight, color: C.accent });

    // Title
    page.drawText('CONDICIONES DE PAGO', { x: M + 14, y: y - 14, size: 8, font: bold, color: C.accent });
    let condY = y - 28;

    for (const wrapped of allWrapped) {
      for (const wl of wrapped) {
        page.drawText(wl, { x: M + 14, y: condY, size: 8, font: regular, color: C.steel });
        condY -= 11;
      }
      condY -= 2;
    }

    y -= condHeight + 14;
  }

  // ── 8. DATOS BANCARIOS — caja con borde ─────────────────────────────

  ensureSpace(70);

  const banco = String(configuracion.banco ?? 'Banco Industrial');
  const cuenta = String(configuracion.numero_cuenta ?? '455-008846-4');
  const titular = String(configuracion.cuenta_nombre ?? 'Invest & Jure-Advisor, S.A.');
  const emailContador = String(configuracion.email_contador ?? 'contador@papeleo.legal');

  const bankH = 60;
  // Border box
  page.drawRectangle({ x: M, y: y - bankH, width: CW, height: bankH, color: C.white, borderColor: C.border, borderWidth: 1 });

  // Decorative accent square + title
  page.drawRectangle({ x: M + 12, y: y - 16, width: 6, height: 6, color: C.accent });
  page.drawText('DATOS BANCARIOS', { x: M + 24, y: y - 16, size: 8, font: bold, color: C.navy });

  page.drawText(safeText(`${banco} - Cuenta No. ${cuenta}`), { x: M + 14, y: y - 30, size: 8, font: bold, color: C.steel });
  page.drawText(safeText(`A nombre de: ${titular}`), { x: M + 14, y: y - 42, size: 8, font: regular, color: C.muted });
  page.drawText(safeText(`Enviar comprobante a: ${emailContador}`), { x: M + 14, y: y - 54, size: 8, font: regular, color: C.muted });

  y -= bankH + 20;

  // ── 9. DOS FIRMAS — Cliente (izq) y Abogada (der) ───────────────────

  ensureSpace(50);

  const sigLeftX = M + 30;
  const sigRightX = M + CW - 180;
  const sigLineW = 160;

  // Client signature
  page.drawRectangle({ x: sigLeftX, y: y + 2, width: sigLineW, height: 0.5, color: C.border });
  page.drawText('Cliente', { x: sigLeftX + (sigLineW - regular.widthOfTextAtSize('Cliente', 8)) / 2, y: y - 10, size: 8, font: regular, color: C.muted });

  // Abogada signature
  page.drawRectangle({ x: sigRightX, y: y + 2, width: sigLineW, height: 0.5, color: C.border });
  const sigName = 'Licda. Amanda Santizo';
  page.drawText(sigName, { x: sigRightX + (sigLineW - bold.widthOfTextAtSize(sigName, 8)) / 2, y: y - 10, size: 8, font: bold, color: C.navy });
  const sigCol = 'Colegiado No. 19565';
  page.drawText(sigCol, { x: sigRightX + (sigLineW - regular.widthOfTextAtSize(sigCol, 7.5)) / 2, y: y - 21, size: 7.5, font: regular, color: C.muted });

  // ── 10. FOOTER — línea + texto centrado ──────────────────────────────

  const footerY = 38;
  page.drawRectangle({ x: M, y: footerY, width: CW, height: 0.5, color: C.border });

  const footerLine1 = safeText('Amanda Santizo - Despacho Juridico - Ciudad de Guatemala');
  const f1w = regular.widthOfTextAtSize(footerLine1, 7.5);
  page.drawText(footerLine1, { x: (W - f1w) / 2, y: footerY - 14, size: 7.5, font: regular, color: C.slate });

  const footerParts: string[] = [];
  if (tel) footerParts.push(safeText(`Tel: ${tel}`));
  footerParts.push('contador@papeleo.legal');
  const footerLine2 = footerParts.join('  |  ');
  const f2w = regular.widthOfTextAtSize(footerLine2, 7);
  page.drawText(footerLine2, { x: (W - f2w) / 2, y: footerY - 25, size: 7, font: regular, color: C.slate });

  // ── Save ─────────────────────────────────────────────────────────────

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
