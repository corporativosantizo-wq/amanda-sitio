// ============================================================================
// lib/services/pdf-nota-entrega.ts
// Genera el PDF de la Nota de Entrega de Documentos (NE-NNNN) usando pdf-lib.
// Comprobante NO fiscal que firman ambas partes al entregar/recibir documentos.
// Modelado sobre pdf-recibo-caja.ts (misma paleta y branding).
// ============================================================================

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { EMISOR } from '@/lib/config/emisor';

const C = {
  navy:   rgb(15 / 255, 23 / 255, 42 / 255),
  steel:  rgb(51 / 255, 65 / 255, 85 / 255),
  muted:  rgb(100 / 255, 116 / 255, 139 / 255),
  slate:  rgb(148 / 255, 163 / 255, 184 / 255),
  border: rgb(203 / 255, 213 / 255, 225 / 255),
  bgSubtle: rgb(248 / 255, 250 / 255, 252 / 255),
  cyan:   rgb(34 / 255, 211 / 255, 238 / 255),
  cyanLight: rgb(207 / 255, 250 / 255, 254 / 255),
  white:  rgb(1, 1, 1),
};

const GRAD = [
  rgb(15 / 255, 23 / 255, 42 / 255),
  rgb(20 / 255, 78 / 255, 116 / 255),
  rgb(8 / 255, 145 / 255, 178 / 255),
  rgb(34 / 255, 211 / 255, 238 / 255),
];

function formatFechaLarga(iso: string): string {
  const d = new Date(iso);
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

function safeText(text: string): string {
  return text
    .replace(/—/g, '-').replace(/–/g, '-')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/…/g, '...').replace(/·/g, '.')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '');
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
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

export interface NotaEntregaPDFInput {
  numero: string;          // 'NE-0001'
  fecha: string;           // 'YYYY-MM-DD' o ISO
  cliente: { nombre: string; nit?: string | null };
  documentosEntregados?: string | null;
  documentosRecibidos?: string | null;
  notas?: string | null;
}

// Dibuja una sección con título y o bien el texto provisto, o líneas en blanco
// para llenar a mano. Devuelve la nueva `y`.
function drawSeccionDocumentos(
  page: PDFPage, regular: PDFFont, bold: PDFFont,
  titulo: string, contenido: string | null | undefined,
  x: number, y: number, width: number,
): number {
  page.drawText(safeText(titulo), { x, y, size: 9, font: bold, color: C.navy });
  y -= 16;
  const texto = (contenido ?? '').trim();
  if (texto) {
    for (const line of wrapText(safeText(texto), regular, 10, width)) {
      page.drawText(line, { x, y, size: 10, font: regular, color: C.steel });
      y -= 14;
    }
    y -= 4;
  } else {
    // 3 líneas en blanco para escribir a mano
    for (let i = 0; i < 3; i++) {
      page.drawRectangle({ x, y: y - 2, width, height: 0.5, color: C.border });
      y -= 18;
    }
  }
  return y - 8;
}

export async function generarPDFNotaEntrega(input: NotaEntregaPDFInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 612, H = 792, M = 50, CW = W - 2 * M;
  const logo = await loadLogo(doc);
  const page = doc.addPage([W, H]);
  let y = H - 45;

  // ── Header ──
  if (logo) {
    const dims = logo.scaleToFit(150, 48);
    page.drawImage(logo, { x: M, y: y - dims.height + 8, width: dims.width, height: dims.height });
  } else {
    page.drawText(safeText(EMISOR.profesionalCorto), { x: M, y, size: 14, font: bold, color: C.navy });
    page.drawText(safeText(EMISOR.nombreComercial), { x: M, y: y - 13, size: 9, font: regular, color: C.muted });
  }
  drawTextRight(page, 'NOTA DE ENTREGA', W - M, y, bold, 15, C.navy);
  drawTextRight(page, 'DE DOCUMENTOS', W - M, y - 16, bold, 15, C.navy);
  drawTextRight(page, input.numero, W - M, y - 34, bold, 12, C.cyan);
  drawTextRight(page, safeText(formatFechaLarga(input.fecha)), W - M, y - 48, regular, 8.5, C.muted);
  y -= 68;

  drawGradientLine(page, M, y, CW, 2);
  y -= 22;

  // ── Badge ──
  const badgeText = safeText('COMPROBANTE NO FISCAL');
  const badgeW = bold.widthOfTextAtSize(badgeText, 8) + 24;
  page.drawRectangle({ x: M, y: y - 20, width: badgeW, height: 20, color: C.cyanLight });
  page.drawText(badgeText, { x: M + 12, y: y - 14, size: 8, font: bold, color: C.navy });
  y -= 42;

  // ── Datos del cliente ──
  const cliInnerH = 50;
  page.drawRectangle({ x: M, y: y - cliInnerH, width: CW, height: cliInnerH, color: C.bgSubtle });
  page.drawRectangle({ x: M, y: y - cliInnerH, width: 3, height: cliInnerH, color: C.cyan });
  page.drawText('CLIENTE', { x: M + 14, y: y - 14, size: 8, font: bold, color: C.navy });
  page.drawText(safeText(input.cliente.nombre), { x: M + 14, y: y - 30, size: 10, font: regular, color: C.steel });
  page.drawText(safeText(`NIT: ${input.cliente.nit ?? 'CF'}`), { x: M + 14, y: y - 43, size: 9, font: regular, color: C.muted });
  y -= cliInnerH + 22;

  // ── Documentos entregados / recibidos ──
  y = drawSeccionDocumentos(page, regular, bold, 'DOCUMENTOS ENTREGADOS (del despacho al cliente)', input.documentosEntregados, M, y, CW);
  y -= 6;
  y = drawSeccionDocumentos(page, regular, bold, 'DOCUMENTOS RECIBIDOS (del cliente al despacho)', input.documentosRecibidos, M, y, CW);

  // ── Notas ──
  const notas = (input.notas ?? '').trim();
  if (notas) {
    y -= 4;
    page.drawText('NOTAS', { x: M, y, size: 8, font: bold, color: C.navy });
    y -= 14;
    for (const line of wrapText(safeText(notas), regular, 9, CW)) {
      page.drawText(line, { x: M, y, size: 9, font: regular, color: C.muted });
      y -= 12;
    }
  }

  // ── Firmas ──
  const sigY = Math.max(y - 40, 150);
  const colW = (CW - 40) / 2;
  const drawFirma = (label: string, x: number) => {
    page.drawRectangle({ x, y: sigY, width: colW, height: 0.5, color: C.border });
    page.drawText(safeText(label), { x, y: sigY - 13, size: 8, font: regular, color: C.muted });
  };
  drawFirma('Entregado por: _______________________', M);
  drawFirma('Recibido por: _______________________', M + colW + 40);

  // ── Footer ──
  const footerY = 38;
  page.drawRectangle({ x: M, y: footerY + 6, width: CW, height: 0.5, color: C.border });
  const f1 = safeText(`${EMISOR.nombreComercial} - ${EMISOR.profesional} - NIT ${EMISOR.nit}`);
  page.drawText(f1, { x: (W - regular.widthOfTextAtSize(f1, 7)) / 2, y: footerY - 6, size: 7, font: regular, color: C.slate });
  const f2 = safeText(EMISOR.direccion);
  page.drawText(f2, { x: (W - regular.widthOfTextAtSize(f2, 6.5)) / 2, y: footerY - 16, size: 6.5, font: regular, color: C.slate });
  const f3 = safeText(`Tel: ${EMISOR.telefono}  |  ${EMISOR.email}  |  ${EMISOR.web}`);
  page.drawText(f3, { x: (W - regular.widthOfTextAtSize(f3, 6.5)) / 2, y: footerY - 25, size: 6.5, font: regular, color: C.slate });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
