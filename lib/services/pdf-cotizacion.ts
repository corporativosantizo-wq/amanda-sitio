// ============================================================================
// lib/services/pdf-cotizacion.ts
// Genera PDF profesional de cotización usando pdf-lib
// ============================================================================

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import type { CotizacionConCliente } from '@/lib/types';

// ── Colores ──────────────────────────────────────────────────────────────────

const C = {
  darkNavy: rgb(15 / 255, 23 / 255, 42 / 255),       // #0F172A
  deepBlue: rgb(30 / 255, 58 / 255, 138 / 255),       // #1E3A8A
  blue: rgb(59 / 255, 130 / 255, 246 / 255),           // #3B82F6
  cyan: rgb(34 / 255, 211 / 255, 238 / 255),           // #22D3EE
  white: rgb(1, 1, 1),
  black: rgb(0, 0, 0),
  gray: rgb(100 / 255, 116 / 255, 139 / 255),          // #64748B
  darkGray: rgb(51 / 255, 65 / 255, 85 / 255),         // #334155
  lightGray: rgb(241 / 255, 245 / 255, 249 / 255),     // #F1F5F9
  lighterGray: rgb(248 / 255, 250 / 255, 252 / 255),   // #F8FAFC
};

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

// Replace special characters not supported in WinAnsi with safe alternatives
function safeText(text: string): string {
  return text
    .replace(/\u2014/g, '-')   // em dash → hyphen
    .replace(/\u2013/g, '-')   // en dash → hyphen
    .replace(/\u2018/g, "'")   // left single quote
    .replace(/\u2019/g, "'")   // right single quote
    .replace(/\u201C/g, '"')   // left double quote
    .replace(/\u201D/g, '"')   // right double quote
    .replace(/\u2026/g, '...') // ellipsis
    .replace(/\u00B7/g, '.');  // middle dot
}

// ── Main function ────────────────────────────────────────────────────────────

export async function generarPDFCotizacion(
  cotizacion: CotizacionConCliente,
  configuracion: Record<string, any>,
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 612; // US Letter width
  const H = 792; // US Letter height
  const M = 50;  // Margin
  const CW = W - 2 * M; // Content width

  const page = doc.addPage([W, H]);
  let y = H; // cursor starts at top

  // ── HEADER BAR ─────────────────────────────────────────────────────────

  const headerH = 100;
  page.drawRectangle({ x: 0, y: H - headerH, width: W, height: headerH, color: C.darkNavy });

  // "AS" brand
  page.drawText('AS', {
    x: M, y: H - 38, size: 28, font: bold, color: C.cyan,
  });
  page.drawText(safeText('Amanda Santizo - Despacho Juridico'), {
    x: M, y: H - 55, size: 10, font: bold, color: C.white,
  });

  const dir = safeText(String(configuracion.direccion_despacho ?? ''));
  const tel = safeText(String(configuracion.telefono_despacho ?? ''));
  if (dir) {
    page.drawText(dir, { x: M, y: H - 68, size: 7.5, font: regular, color: C.cyan });
  }
  if (tel) {
    page.drawText(`Tel: ${tel}`, { x: M, y: H - 79, size: 7.5, font: regular, color: C.cyan });
  }

  // Right side: COTIZACION info
  const rightX = W - M;
  page.drawText('COTIZACION', {
    x: rightX - bold.widthOfTextAtSize('COTIZACION', 18), y: H - 38, size: 18, font: bold, color: C.cyan,
  });

  const numText = cotizacion.numero;
  page.drawText(numText, {
    x: rightX - bold.widthOfTextAtSize(numText, 10), y: H - 54, size: 10, font: bold, color: C.white,
  });

  const fechaEmText = `Fecha: ${formatFechaGT(cotizacion.fecha_emision)}`;
  page.drawText(safeText(fechaEmText), {
    x: rightX - regular.widthOfTextAtSize(safeText(fechaEmText), 8), y: H - 68, size: 8, font: regular, color: C.lightGray,
  });

  const fechaVenText = `Vigencia: ${formatFechaGT(cotizacion.fecha_vencimiento)}`;
  page.drawText(safeText(fechaVenText), {
    x: rightX - regular.widthOfTextAtSize(safeText(fechaVenText), 8), y: H - 79, size: 8, font: regular, color: C.lightGray,
  });

  y = H - headerH - 20;

  // ── CLIENTE ────────────────────────────────────────────────────────────

  // Section label with blue accent line
  page.drawRectangle({ x: M, y: y - 1, width: CW, height: 2, color: C.blue });
  y -= 18;
  page.drawText('DATOS DEL CLIENTE', { x: M, y, size: 9, font: bold, color: C.deepBlue });
  y -= 16;

  const cliente = cotizacion.cliente;
  const clienteLines = [
    { label: 'Nombre:', value: cliente.nombre },
    { label: 'NIT:', value: cliente.nit ?? 'CF' },
    { label: 'Email:', value: cliente.email ?? 'N/A' },
  ];

  for (const line of clienteLines) {
    page.drawText(line.label, { x: M, y, size: 9, font: bold, color: C.darkGray });
    page.drawText(safeText(line.value), { x: M + 50, y, size: 9, font: regular, color: C.gray });
    y -= 14;
  }

  y -= 10;

  // ── TABLA DE ITEMS ─────────────────────────────────────────────────────

  // Column positions
  const colNum = M;
  const colDesc = M + 30;
  const colCant = M + CW - 210;
  const colPU = M + CW - 150;
  const colTotal = M + CW - 70;
  const tableRight = M + CW;

  // Table header
  const thH = 24;
  page.drawRectangle({ x: M, y: y - thH, width: CW, height: thH, color: C.deepBlue });

  const thY = y - 16;
  page.drawText('#', { x: colNum + 8, y: thY, size: 8, font: bold, color: C.white });
  page.drawText('Servicio', { x: colDesc + 4, y: thY, size: 8, font: bold, color: C.white });

  const cantLabel = 'Cant.';
  page.drawText(cantLabel, {
    x: colCant + 30 - bold.widthOfTextAtSize(cantLabel, 8), y: thY, size: 8, font: bold, color: C.white,
  });
  const puLabel = 'P. Unitario';
  page.drawText(puLabel, {
    x: colPU + 50 - bold.widthOfTextAtSize(puLabel, 8), y: thY, size: 8, font: bold, color: C.white,
  });
  const totLabel = 'Total';
  page.drawText(totLabel, {
    x: tableRight - 8 - bold.widthOfTextAtSize(totLabel, 8), y: thY, size: 8, font: bold, color: C.white,
  });

  y -= thH;

  // Table rows
  const items = cotizacion.items ?? [];
  const descMaxW = colCant - colDesc - 10;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const descLines = wrapText(safeText(item.descripcion), regular, 8.5, descMaxW);
    const rowH = Math.max(20, descLines.length * 12 + 8);

    // Check if we need a new page
    if (y - rowH < 200) {
      // Not enough space — we'd need multi-page support, but for now just continue
      // Most cotizaciones have few items
    }

    // Alternating background
    if (i % 2 === 0) {
      page.drawRectangle({ x: M, y: y - rowH, width: CW, height: rowH, color: C.lighterGray });
    }

    // Bottom border
    page.drawRectangle({ x: M, y: y - rowH, width: CW, height: 0.5, color: C.lightGray });

    const textY = y - 14;

    // Number
    page.drawText(String(i + 1), { x: colNum + 10, y: textY, size: 8.5, font: regular, color: C.darkGray });

    // Description (wrapped)
    for (let l = 0; l < descLines.length; l++) {
      page.drawText(descLines[l], { x: colDesc + 4, y: textY - l * 12, size: 8.5, font: regular, color: C.darkGray });
    }

    // Quantity (right-aligned)
    const cantText = String(item.cantidad);
    page.drawText(cantText, {
      x: colCant + 30 - regular.widthOfTextAtSize(cantText, 8.5), y: textY, size: 8.5, font: regular, color: C.darkGray,
    });

    // Unit price (right-aligned)
    const puText = formatQ(item.precio_unitario);
    page.drawText(safeText(puText), {
      x: colPU + 50 - regular.widthOfTextAtSize(safeText(puText), 8.5), y: textY, size: 8.5, font: regular, color: C.darkGray,
    });

    // Total (right-aligned)
    const totText = formatQ(item.total);
    page.drawText(safeText(totText), {
      x: tableRight - 8 - regular.widthOfTextAtSize(safeText(totText), 8.5), y: textY, size: 8.5, font: regular, color: C.darkGray,
    });

    y -= rowH;
  }

  // Bottom border of table
  page.drawRectangle({ x: M, y, width: CW, height: 1.5, color: C.deepBlue });

  y -= 20;

  // ── TOTALES ────────────────────────────────────────────────────────────

  const totalsX = M + CW - 200;
  const totalsValX = tableRight - 8;

  // Subtotal
  const subLabel = 'Subtotal:';
  const subVal = formatQ(cotizacion.subtotal);
  page.drawText(subLabel, { x: totalsX, y, size: 9, font: regular, color: C.gray });
  page.drawText(safeText(subVal), {
    x: totalsValX - regular.widthOfTextAtSize(safeText(subVal), 9), y, size: 9, font: regular, color: C.gray,
  });
  y -= 15;

  // IVA
  const ivaLabel = 'IVA (12%):';
  const ivaVal = formatQ(cotizacion.iva_monto);
  page.drawText(ivaLabel, { x: totalsX, y, size: 9, font: regular, color: C.gray });
  page.drawText(safeText(ivaVal), {
    x: totalsValX - regular.widthOfTextAtSize(safeText(ivaVal), 9), y, size: 9, font: regular, color: C.gray,
  });
  y -= 5;

  // Separator line
  page.drawRectangle({ x: totalsX, y, width: totalsValX - totalsX + 8, height: 1.5, color: C.deepBlue });
  y -= 16;

  // TOTAL
  const totalLabel = 'TOTAL:';
  const totalVal = formatQ(cotizacion.total);
  page.drawText(totalLabel, { x: totalsX, y, size: 11, font: bold, color: C.darkNavy });
  page.drawText(safeText(totalVal), {
    x: totalsValX - bold.widthOfTextAtSize(safeText(totalVal), 11), y, size: 11, font: bold, color: C.darkNavy,
  });
  y -= 16;

  // Anticipo
  if (cotizacion.requiere_anticipo && cotizacion.anticipo_monto > 0) {
    const antLabel = `Anticipo (${cotizacion.anticipo_porcentaje}%):`;
    const antVal = formatQ(cotizacion.anticipo_monto);
    page.drawText(safeText(antLabel), { x: totalsX, y, size: 9, font: regular, color: C.blue });
    page.drawText(safeText(antVal), {
      x: totalsValX - regular.widthOfTextAtSize(safeText(antVal), 9), y, size: 9, font: bold, color: C.blue,
    });
    y -= 14;
  }

  y -= 10;

  // ── CONDICIONES ────────────────────────────────────────────────────────

  if (cotizacion.condiciones) {
    page.drawRectangle({ x: M, y: y - 1, width: CW, height: 2, color: C.blue });
    y -= 16;
    page.drawText('CONDICIONES', { x: M, y, size: 9, font: bold, color: C.deepBlue });
    y -= 14;

    const condLines = cotizacion.condiciones.split('\n');
    for (const line of condLines) {
      const wrapped = wrapText(safeText(line.trim()), regular, 7.5, CW);
      for (const wl of wrapped) {
        if (y < 100) break; // leave room for footer
        page.drawText(wl, { x: M, y, size: 7.5, font: regular, color: C.gray });
        y -= 11;
      }
    }
  }

  y -= 8;

  // ── DATOS BANCARIOS ────────────────────────────────────────────────────

  if (y > 130) {
    page.drawRectangle({ x: M, y: y - 1, width: CW, height: 2, color: C.blue });
    y -= 16;
    page.drawText('DATOS BANCARIOS', { x: M, y, size: 9, font: bold, color: C.deepBlue });
    y -= 14;

    const banco = String(configuracion.banco ?? 'Banco Industrial');
    const cuenta = String(configuracion.numero_cuenta ?? '455-008846-4');
    const titular = String(configuracion.cuenta_nombre ?? 'Invest & Jure-Advisor, S.A.');
    const emailContador = String(configuracion.email_contador ?? 'contador@papeleo.legal');

    page.drawText(safeText(`${banco} - Cuenta No. ${cuenta}`), { x: M, y, size: 8, font: bold, color: C.darkGray });
    y -= 12;
    page.drawText(safeText(`A nombre de: ${titular}`), { x: M, y, size: 8, font: regular, color: C.gray });
    y -= 12;
    page.drawText(safeText(`Enviar comprobante a: ${emailContador}`), { x: M, y, size: 8, font: regular, color: C.gray });
    y -= 20;
  }

  // ── FIRMA ──────────────────────────────────────────────────────────────

  if (y > 100) {
    page.drawRectangle({ x: M + 20, y: y + 2, width: 150, height: 0.5, color: C.darkGray });
    y -= 10;
    page.drawText('Licda. Amanda Santizo', { x: M + 20, y, size: 8, font: bold, color: C.darkNavy });
    y -= 11;
    page.drawText('Colegiado No. 19565', { x: M + 20, y, size: 7.5, font: regular, color: C.gray });
  }

  // ── FOOTER BAR ─────────────────────────────────────────────────────────

  const footerH = 30;
  page.drawRectangle({ x: 0, y: 0, width: W, height: footerH, color: C.darkNavy });

  const footerText = 'amandasantizo.com';
  const footerW = regular.widthOfTextAtSize(footerText, 8);
  page.drawText(footerText, {
    x: (W - footerW) / 2, y: 11, size: 8, font: regular, color: C.cyan,
  });

  // ── Save ───────────────────────────────────────────────────────────────

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
