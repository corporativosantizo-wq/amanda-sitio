// ============================================================================
// POST /api/admin/expedientes/reporte-pdf
// Genera PDF profesional con listado de expedientes filtrados por cliente
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export const maxDuration = 60;

// ── Colors ───────────────────────────────────────────────────────────────────

const C = {
  navy:   rgb(15 / 255, 23 / 255, 42 / 255),
  steel:  rgb(51 / 255, 65 / 255, 85 / 255),
  muted:  rgb(100 / 255, 116 / 255, 139 / 255),
  border: rgb(203 / 255, 213 / 255, 225 / 255),
  bgRow:  rgb(248 / 255, 250 / 255, 252 / 255),
  white:  rgb(1, 1, 1),
  accent: rgb(30 / 255, 64 / 255, 175 / 255),
};

const TIPO_PROCESO_LABEL: Record<string, string> = {
  civil: 'Civil', penal: 'Penal', laboral: 'Laboral',
  contencioso_administrativo: 'Contencioso Administrativo',
  constitucional: 'Constitucional', amparo: 'Amparo', familia: 'Familia',
  mercantil: 'Mercantil', economico_coactivo: 'Economico Coactivo',
  internacional: 'Internacional',
  administrativo_sancionador: 'Administrativo Sancionador',
  administrativo_tributario: 'Administrativo Tributario',
};

const ESTADO_LABEL: Record<string, string> = {
  activo: 'Activo', suspendido: 'Suspendido',
  archivado: 'Archivado', finalizado: 'Finalizado',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeText(text: string): string {
  return text
    .replace(/\u2014/g, '-').replace(/\u2013/g, '-')
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'")
    .replace(/\u201C/g, '"').replace(/\u201D/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '');
}

function truncate(text: string, font: PDFFont, size: number, maxW: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t + '...', size) > maxW) {
    t = t.slice(0, -1);
  }
  return t + '...';
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
  return lines.length > 0 ? lines : [''];
}

async function loadLogo(doc: PDFDocument): Promise<PDFImage | null> {
  const names = [
    'Logo_Amanda_Santizo_2021_Full_Color.png',
    'Logo Amanda Santizo 2021_Full Color.png',
  ];
  for (const name of names) {
    try {
      const p = path.join(process.cwd(), 'public', name);
      const bytes = fs.readFileSync(p);
      return await doc.embedPng(bytes);
    } catch { /* try next */ }
  }
  return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await req.json();
    const { cliente_id, tipo_proceso, estado } = body as {
      cliente_id: string;
      tipo_proceso?: string;
      estado?: string;
    };

    if (!cliente_id) {
      return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 });
    }

    const db = createAdminClient();

    // Fetch client
    const { data: cliente } = await db
      .from('clientes')
      .select('id, codigo, nombre')
      .eq('id', cliente_id)
      .single();

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Fetch expedientes
    let query = db
      .from('expedientes')
      .select('id, numero_expediente, numero_mp, numero_administrativo, origen, tipo_proceso, fase_actual, estado, tribunal_nombre, fiscalia, entidad_administrativa, actor, demandado, rol_cliente, fecha_inicio, fecha_ultima_actuacion')
      .eq('cliente_id', cliente_id)
      .order('fecha_ultima_actuacion', { ascending: false, nullsFirst: false });

    if (tipo_proceso) query = query.eq('tipo_proceso', tipo_proceso);
    if (estado) query = query.eq('estado', estado);

    const { data: expedientes, error } = await query;
    if (error) {
      return NextResponse.json({ error: 'Error al obtener expedientes' }, { status: 500 });
    }

    if (!expedientes || expedientes.length === 0) {
      return NextResponse.json({ error: 'No hay expedientes con los filtros seleccionados' }, { status: 404 });
    }

    // Generate PDF
    const pdfBuffer = await generatePDF(expedientes, cliente, tipo_proceso, estado);

    const tipoSlug = tipo_proceso ? `_${TIPO_PROCESO_LABEL[tipo_proceso] ?? tipo_proceso}` : '';
    const filename = `Expedientes${tipoSlug}_${cliente.nombre.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]/g, '').trim().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err: any) {
    console.error('[reporte-pdf] Error:', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}

// ── PDF Generation ──────────────────────────────────────────────────────────

async function generatePDF(
  expedientes: any[],
  cliente: { codigo: string; nombre: string },
  tipoProceso?: string,
  estadoFilter?: string,
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await loadLogo(doc);

  const W = 612; // Letter width
  const H = 792; // Letter height
  const margin = 50;
  const contentW = W - margin * 2;

  let page = doc.addPage([W, H]);
  let y = H - margin;

  // ── Helper: new page ──────────────────────────────────────────────────────
  function newPage(): PDFPage {
    page = doc.addPage([W, H]);
    y = H - margin;
    return page;
  }

  function ensureSpace(needed: number) {
    if (y - needed < 60) newPage();
  }

  // ── Header ────────────────────────────────────────────────────────────────

  // Logo
  if (logo) {
    const logoH = 40;
    const logoW = logoH * (logo.width / logo.height);
    page.drawImage(logo, { x: margin, y: y - logoH, width: logoW, height: logoH });
    y -= logoH + 12;
  }

  // Gradient line
  const gradColors = [
    rgb(30 / 255, 58 / 255, 138 / 255),
    rgb(37 / 255, 99 / 255, 235 / 255),
    rgb(8 / 255, 145 / 255, 178 / 255),
  ];
  const segW = contentW / gradColors.length;
  gradColors.forEach((color, i) => {
    page.drawRectangle({ x: margin + i * segW, y: y - 2, width: segW, height: 2, color });
  });
  y -= 16;

  // Title
  page.drawText('LISTADO DE EXPEDIENTES', {
    x: margin, y, size: 16, font: bold, color: C.navy,
  });
  y -= 18;

  // Subtitle: tipo + client
  const tipoLabel = tipoProceso ? (TIPO_PROCESO_LABEL[tipoProceso] ?? tipoProceso).toUpperCase() : 'TODOS LOS TIPOS';
  const estadoLabel = estadoFilter ? ` - ${(ESTADO_LABEL[estadoFilter] ?? estadoFilter).toUpperCase()}` : '';
  page.drawText(`${tipoLabel}${estadoLabel} - ${safeText(cliente.nombre)}`, {
    x: margin, y, size: 9, font: bold, color: C.steel,
  });
  y -= 14;

  // Metadata line
  const fecha = new Date().toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' });
  page.drawText(`Fecha de generacion: ${fecha}  |  Total de expedientes: ${expedientes.length}`, {
    x: margin, y, size: 8, font: regular, color: C.muted,
  });
  y -= 24;

  // ── Table ──────────────────────────────────────────────────────────────────

  const cols = [
    { label: '#', w: 24 },
    { label: 'No. EXPEDIENTE', w: 130 },
    { label: 'TIPO', w: 90 },
    { label: 'ESTADO', w: 55 },
    { label: 'TRIBUNAL / SEDE', w: 148 },
    { label: 'ROL', w: 65 },
  ];
  const rowH = 18;
  const headerH = 20;
  const fontSize = 7.5;
  const headerFontSize = 7;

  function drawTableHeader() {
    ensureSpace(headerH + rowH);
    // Header background
    page.drawRectangle({ x: margin, y: y - headerH, width: contentW, height: headerH, color: C.navy });
    // Header text
    let cx = margin + 4;
    for (const col of cols) {
      page.drawText(col.label, { x: cx, y: y - 14, size: headerFontSize, font: bold, color: C.white });
      cx += col.w;
    }
    y -= headerH;
  }

  drawTableHeader();

  // Rows
  expedientes.forEach((exp, idx) => {
    if (y - rowH < 80) {
      newPage();
      drawTableHeader();
    }

    const isEven = idx % 2 === 0;
    if (isEven) {
      page.drawRectangle({ x: margin, y: y - rowH, width: contentW, height: rowH, color: C.bgRow });
    }

    // Bottom border
    page.drawRectangle({ x: margin, y: y - rowH, width: contentW, height: 0.5, color: C.border });

    const numero = exp.numero_expediente ?? exp.numero_mp ?? exp.numero_administrativo ?? '-';
    const tipo = TIPO_PROCESO_LABEL[exp.tipo_proceso] ?? exp.tipo_proceso ?? '-';
    const estadoVal = ESTADO_LABEL[exp.estado] ?? exp.estado ?? '-';
    const sede = exp.tribunal_nombre ?? exp.fiscalia ?? exp.entidad_administrativa ?? '-';
    const rol = exp.rol_cliente ?? '-';

    const cellValues = [
      String(idx + 1),
      safeText(numero),
      safeText(tipo),
      safeText(estadoVal),
      truncate(safeText(sede), regular, fontSize, cols[4].w - 8),
      safeText(rol),
    ];

    let cx = margin + 4;
    cellValues.forEach((val, i) => {
      const font_to_use = i === 1 ? bold : regular;
      page.drawText(val, { x: cx, y: y - 13, size: fontSize, font: font_to_use, color: C.steel });
      cx += cols[i].w;
    });

    y -= rowH;
  });

  // ── Actor / Demandado section ─────────────────────────────────────────────

  const partiesData = expedientes.filter(e => e.actor || e.demandado);
  if (partiesData.length > 0) {
    y -= 20;
    ensureSpace(40);
    page.drawText('ACTOR / DEMANDADO', {
      x: margin, y, size: 9, font: bold, color: C.navy,
    });
    y -= 4;
    page.drawRectangle({ x: margin, y, width: contentW, height: 0.5, color: C.border });
    y -= 14;

    for (const exp of partiesData) {
      ensureSpace(28);
      const num = exp.numero_expediente ?? exp.numero_mp ?? exp.numero_administrativo ?? '-';
      const parts: string[] = [];
      if (exp.actor) parts.push(`Actor: ${exp.actor}`);
      if (exp.demandado) parts.push(`Demandado: ${exp.demandado}`);

      page.drawText(safeText(`Exp. ${num}`), {
        x: margin, y, size: 7.5, font: bold, color: C.steel,
      });
      page.drawText(safeText(` - ${parts.join(' | ')}`), {
        x: margin + bold.widthOfTextAtSize(safeText(`Exp. ${num}`), 7.5), y, size: 7.5, font: regular, color: C.muted,
      });
      y -= 13;
    }
  }

  // ── IP Notice ─────────────────────────────────────────────────────────────

  y -= 16;
  ensureSpace(120);

  // Separator
  page.drawRectangle({ x: margin, y, width: contentW, height: 0.5, color: C.border });
  y -= 14;

  page.drawText('AVISO DE PROPIEDAD INTELECTUAL Y CONFIDENCIALIDAD', {
    x: margin, y, size: 7.5, font: bold, color: C.navy,
  });
  y -= 12;

  const notice = 'El presente documento y la informacion contenida en el constituyen propiedad intelectual del Despacho Juridico de la Licenciada Soazig Amanda Santizo Calderon. Queda estrictamente prohibida su reproduccion, distribucion, o uso parcial o total sin autorizacion expresa y por escrito de su titular. La informacion aqui contenida es de caracter confidencial y esta destinada exclusivamente al uso del destinatario autorizado. Cualquier uso no autorizado sera sancionado conforme a la legislacion guatemalteca vigente en materia de propiedad intelectual.';

  const noticeLines = wrapText(notice, regular, 6.5, contentW);
  for (const line of noticeLines) {
    if (y < 40) newPage();
    page.drawText(line, { x: margin, y, size: 6.5, font: regular, color: C.muted });
    y -= 9;
  }

  y -= 6;
  const footer = [
    'Lic. Amanda Santizo',
    'Despacho Juridico',
    'Tel. 2335-3613 | amandasantizo.com',
  ];
  for (const line of footer) {
    if (y < 30) newPage();
    page.drawText(line, { x: margin, y, size: 7, font: bold, color: C.steel });
    y -= 10;
  }

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
