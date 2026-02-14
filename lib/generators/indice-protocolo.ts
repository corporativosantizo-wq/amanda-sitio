// ============================================================================
// lib/generators/indice-protocolo.ts
// Genera DOCX del índice del protocolo notarial (landscape)
// ============================================================================

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, PageOrientation, WidthType, BorderStyle,
  convertMillimetersToTwip, ShadingType,
} from 'docx';
import { numeroALetras, fechaATextoLegal } from '@/lib/utils';

interface EscrituraIndice {
  numero: number;
  fecha_autorizacion: string;
  lugar_autorizacion: string;
  departamento: string;
  comparecientes: Array<{ nombre: string; calidad?: string }>;
  tipo_instrumento_texto: string;
  estado: string;
  hojas_protocolo: number | null;
}

interface IndiceParams {
  anio: number;
  escrituras: EscrituraIndice[];
  incluirRazon: boolean;
  fechaCierre?: string;
}

const NOTARIA = {
  nombre: 'SOAZIG AMANDA SANTIZO CALDERÓN',
  colegiado: '19565',
  clave: 'S-1254',
};

const FONT = 'Arial';
const SIZE = 20; // 10pt

function txt(text: string, opts: Partial<{ bold: boolean; size: number; color: string }> = {}): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: opts.size ?? SIZE,
    bold: opts.bold ?? false,
    color: opts.color,
  });
}

function cell(
  content: string,
  opts: Partial<{ bold: boolean; alignment: typeof AlignmentType[keyof typeof AlignmentType]; color: string; header: boolean }> = {}
): TableCell {
  return new TableCell({
    children: [new Paragraph({
      alignment: opts.alignment ?? AlignmentType.LEFT,
      children: [txt(content, { bold: opts.bold, color: opts.color })],
    })],
    shading: opts.header ? { type: ShadingType.SOLID, color: 'D9E2F3' } : undefined,
  });
}

export async function generarIndiceProtocolo(params: IndiceParams): Promise<Blob> {
  const { anio, escrituras, incluirRazon, fechaCierre } = params;

  const children: Paragraph[] = [];

  // Title
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [txt('ÍNDICE DEL PROTOCOLO DE LA NOTARIA', { bold: true, size: 24 })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [txt(NOTARIA.nombre, { bold: true, size: 24 })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
    children: [txt(`AÑO ${anio}`, { bold: true, size: 24 })],
  }));

  // Table
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell('No.', { bold: true, header: true, alignment: AlignmentType.CENTER }),
      cell('Lugar y Fecha', { bold: true, header: true }),
      cell('Otorgantes', { bold: true, header: true }),
      cell('Objeto', { bold: true, header: true }),
      cell('Folio', { bold: true, header: true, alignment: AlignmentType.CENTER }),
    ],
  });

  const dataRows = escrituras.map((esc: EscrituraIndice) => {
    const fecha = new Date(esc.fecha_autorizacion + 'T12:00:00');
    const lugarFecha = `${esc.lugar_autorizacion}, ${fecha.getDate()}/${fecha.getMonth() + 1}/${fecha.getFullYear()}`;
    const otorgantes = esc.comparecientes.map((c: any) => c.nombre).join('; ');
    const objeto = esc.estado === 'cancelada' ? 'Cancelada' : esc.tipo_instrumento_texto;
    const objetoColor = esc.estado === 'cancelada' ? 'CC0000' : undefined;
    const folio = esc.hojas_protocolo != null ? String(esc.hojas_protocolo) : '-';

    return new TableRow({
      children: [
        cell(String(esc.numero), { alignment: AlignmentType.CENTER }),
        cell(lugarFecha),
        cell(otorgantes),
        cell(objeto, { color: objetoColor }),
        cell(folio, { alignment: AlignmentType.CENTER }),
      ],
    });
  });

  const borders = {
    top: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
    left: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
    right: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
  };

  const table = new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders,
    columnWidths: [800, 2400, 3200, 2800, 800],
  });

  children.push(new Paragraph({ children: [] }));

  // Razón de cierre (optional)
  const razonParagraphs: Paragraph[] = [];
  if (incluirRazon && escrituras.length > 0) {
    const noCancel = escrituras.filter((e: EscrituraIndice) => e.estado !== 'cancelada');
    const totalEsc = escrituras.length;
    const ultimoNum = escrituras[escrituras.length - 1]?.numero ?? 0;
    const ultimoTexto = numeroALetras(ultimoNum);
    const totalHojas = escrituras.reduce((sum: number, e: EscrituraIndice) => sum + (e.hojas_protocolo ?? 0), 0);
    const hojasUsadas = noCancel.reduce((sum: number, e: EscrituraIndice) => sum + (e.hojas_protocolo ?? 0), 0);
    const anioTexto = numeroALetras(anio);
    const cierreTexto = fechaCierre
      ? fechaATextoLegal(fechaCierre)
      : fechaATextoLegal(new Date());

    razonParagraphs.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
    razonParagraphs.push(new Paragraph({
      spacing: { after: 200 },
      children: [
        txt(`RAZÓN: Se hace constar que cerré el PROTOCOLO a mi cargo correspondiente al año ${anioTexto}, el cual contiene ${numeroALetras(totalEsc)} (${totalEsc}) instrumento${totalEsc > 1 ? 's' : ''} público${totalEsc > 1 ? 's' : ''}, del número uno (1) al número ${ultimoNum} (${ultimoTexto}), escritos en ${totalHojas} hojas de papel de protocolo, de las cuales utilicé ${hojasUsadas} hojas. Guatemala, ${cierreTexto}. Doy Fe.`, { bold: false }),
      ],
    }));

    razonParagraphs.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
    razonParagraphs.push(new Paragraph({ children: [txt(NOTARIA.nombre, { bold: true })] }));
    razonParagraphs.push(new Paragraph({ children: [txt(`COLEGIADO: ${NOTARIA.colegiado}`)] }));
    razonParagraphs.push(new Paragraph({ children: [txt(`Clave: ${NOTARIA.clave}`)] }));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 15840, height: 12240, orientation: PageOrientation.LANDSCAPE },
          margin: {
            top: convertMillimetersToTwip(20),
            right: convertMillimetersToTwip(20),
            bottom: convertMillimetersToTwip(20),
            left: convertMillimetersToTwip(20),
          },
        },
      },
      children: [...children, table, ...razonParagraphs],
    }],
  });

  return await Packer.toBlob(doc);
}
