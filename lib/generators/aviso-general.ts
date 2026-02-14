// ============================================================================
// lib/generators/aviso-general.ts
// Genera DOCX de aviso general (cancelación, aclaración, etc.)
// ============================================================================

import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, PageOrientation, convertMillimetersToTwip,
} from 'docx';
import { numeroALetras, fechaATextoLegal } from '@/lib/utils';
import { buildHeader, buildFooter, type MembreteConfig } from './membrete';

export type TipoAviso = 'cancelacion' | 'aclaracion' | 'ampliacion' | 'modificacion' | 'rescision';

interface AvisoGeneralParams {
  tipoAviso: TipoAviso;
  motivo: string;
  fechaAviso: string; // YYYY-MM-DD
  escritura: {
    numero: number;
    fecha_autorizacion: string;
    lugar_autorizacion: string;
    departamento: string;
  };
  membrete?: MembreteConfig;
}

const NOTARIA = {
  nombre: 'SOAZIG AMANDA SANTIZO CALDERÓN',
  colegiado: '19565',
  clave: 'S-1254',
};

const VERBOS: Record<TipoAviso, string> = {
  cancelacion: 'cancelar',
  aclaracion: 'aclarar',
  ampliacion: 'ampliar',
  modificacion: 'modificar',
  rescision: 'rescindir',
};

const TITULOS: Record<TipoAviso, string> = {
  cancelacion: 'CANCELACIÓN',
  aclaracion: 'ACLARACIÓN',
  ampliacion: 'AMPLIACIÓN',
  modificacion: 'MODIFICACIÓN',
  rescision: 'RESCISIÓN',
};

const FONT = 'Times New Roman';
const SIZE = 24;

function txt(text: string, opts: Partial<{ bold: boolean }> = {}): TextRun {
  return new TextRun({ text, font: FONT, size: SIZE, bold: opts.bold ?? false });
}

function emptyLine(): Paragraph {
  return new Paragraph({ spacing: { after: 200 }, children: [txt('')] });
}

export async function generarAvisoGeneral(params: AvisoGeneralParams): Promise<Blob> {
  const { tipoAviso, motivo, fechaAviso, escritura, membrete } = params;

  const fechaAvisoTexto = fechaATextoLegal(fechaAviso);
  const numLetras = numeroALetras(escritura.numero);
  const fechaEscTexto = fechaATextoLegal(escritura.fecha_autorizacion);
  const verbo = VERBOS[tipoAviso];
  const titulo = TITULOS[tipoAviso];

  const children: Paragraph[] = [];

  // Title
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [txt(`AVISO DE ${titulo}`, { bold: true })],
  }));

  // Date + addressee
  children.push(new Paragraph({ children: [txt(`Guatemala, ${fechaAvisoTexto}.`)] }));
  children.push(emptyLine());
  children.push(new Paragraph({ children: [txt('Directora')] }));
  children.push(emptyLine());
  children.push(new Paragraph({ children: [txt('Archivo General de Protocolos')] }));
  children.push(emptyLine());
  children.push(new Paragraph({ children: [txt('Presente.')] }));
  children.push(emptyLine());
  children.push(new Paragraph({ children: [txt('Señora directora:')] }));
  children.push(emptyLine());

  // Body
  const motivoTexto = motivo.trim() ? ` ${motivo.trim()}` : '';
  children.push(new Paragraph({
    spacing: { after: 200 },
    children: [
      txt(`Para los efectos legales correspondientes, aviso a usted que procedí a ${verbo} la escritura pública número ${numLetras} (${escritura.numero}) de fecha ${fechaEscTexto}, en ${escritura.lugar_autorizacion} del Departamento de ${escritura.departamento}${motivoTexto}.`),
    ],
  }));

  // Closing
  children.push(emptyLine());
  children.push(new Paragraph({
    spacing: { after: 400 },
    children: [txt('Sin otro particular me suscribo, atentamente,')],
  }));
  children.push(emptyLine());
  children.push(emptyLine());

  // Signature
  children.push(new Paragraph({ children: [txt(NOTARIA.nombre, { bold: true })] }));
  children.push(emptyLine());
  children.push(new Paragraph({ children: [txt(`COLEGIADO: ${NOTARIA.colegiado}`, { bold: true })] }));
  children.push(emptyLine());
  children.push(new Paragraph({ children: [txt(`Clave: ${NOTARIA.clave}`, { bold: true })] }));

  const headers = buildHeader(membrete);
  const hasHeader = !!headers;

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT },
          margin: {
            top: convertMillimetersToTwip(hasHeader ? 35 : 25.4),
            right: convertMillimetersToTwip(25.4),
            bottom: convertMillimetersToTwip(25.4),
            left: convertMillimetersToTwip(25.4),
          },
        },
      },
      headers,
      footers: hasHeader ? buildFooter() : undefined,
      children,
    }],
  });

  return await Packer.toBlob(doc);
}
