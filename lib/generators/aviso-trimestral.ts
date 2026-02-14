// ============================================================================
// lib/generators/aviso-trimestral.ts
// Genera DOCX de aviso trimestral al Archivo General de Protocolos
// ============================================================================

import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, PageOrientation, convertMillimetersToTwip,
} from 'docx';
import { numeroALetras, fechaATextoLegal, nombreTrimestre } from '@/lib/utils';

interface EscrituraAviso {
  numero: number;
  numero_texto: string;
  tipo_instrumento_texto: string;
  lugar_autorizacion: string;
  departamento: string;
  fecha_autorizacion: string;
  estado: string;
}

interface AvisoTrimestralParams {
  trimestre: 1 | 2 | 3 | 4;
  anio: number;
  escrituras: EscrituraAviso[];
}

const NOTARIA = {
  nombre: 'SOAZIG AMANDA SANTIZO CALDERÓN',
  colegiado: '19565',
  clave: 'S-1254',
};

const FONT = 'Times New Roman';
const SIZE = 24; // 12pt in half-points

function txt(text: string, opts: Partial<{ bold: boolean; size: number }> = {}): TextRun {
  return new TextRun({ text, font: FONT, size: opts.size ?? SIZE, bold: opts.bold ?? false });
}

function emptyLine(): Paragraph {
  return new Paragraph({ spacing: { after: 200 }, children: [txt('')] });
}

export async function generarAvisoTrimestral(params: AvisoTrimestralParams): Promise<Blob> {
  const { trimestre, anio, escrituras } = params;
  const hoy = new Date();
  const fechaHoy = fechaATextoLegal(hoy);

  const autorizadas = escrituras.filter((e: EscrituraAviso) => e.estado !== 'cancelada');
  const canceladas = escrituras.filter((e: EscrituraAviso) => e.estado === 'cancelada');
  const cantidad = autorizadas.length;
  const trimestreTexto = nombreTrimestre(trimestre);
  const anioTexto = numeroALetras(anio);

  // Build paragraphs
  const children: Paragraph[] = [];

  // Title
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [txt('AVISO TRIMESTRAL', { bold: true })],
  }));

  // Date + addressee
  children.push(new Paragraph({ children: [txt(`Guatemala, ${fechaHoy}.`)] }));
  children.push(emptyLine());
  children.push(new Paragraph({ children: [txt('Directora')] }));
  children.push(emptyLine());
  children.push(new Paragraph({ children: [txt('Archivo General de Protocolos')] }));
  children.push(emptyLine());
  children.push(new Paragraph({ children: [txt('Presente.')] }));
  children.push(emptyLine());
  children.push(new Paragraph({ children: [txt('Señora directora:')] }));
  children.push(emptyLine());

  if (cantidad === 0 && canceladas.length === 0) {
    // No instruments
    children.push(new Paragraph({
      spacing: { after: 200 },
      children: [
        txt(`Para los efectos legales correspondientes, aviso a usted que durante el ${trimestreTexto} del año ${anioTexto}; NO autoricé instrumento público alguno.`),
      ],
    }));
  } else {
    // Intro paragraph
    const numeros = autorizadas.map((e: EscrituraAviso) => String(e.numero));
    const numerosTexto = numeros.join(', ');
    const cantidadTexto = numeroALetras(cantidad);
    const plural = cantidad > 1;

    children.push(new Paragraph({
      spacing: { after: 200 },
      children: [
        txt(`Para los efectos legales correspondientes, aviso a usted que durante el ${trimestreTexto} del año ${anioTexto}; autoricé ${cantidadTexto} (${cantidad}) instrumento${plural ? 's' : ''} público${plural ? 's' : ''}, al${plural ? ' (los)' : ''} que le${plural ? '(s)' : ''} corresponde${plural ? '(n)' : ''} el${plural ? ' (los)' : ''} número${plural ? '(s)' : ''} ${numerosTexto} del registro notarial a mi cargo, dicha${plural ? 's' : ''} escritura${plural ? 's' : ''} contiene${plural ? 'n' : ''}:`),
      ],
    }));

    // List each escritura
    for (const esc of autorizadas) {
      const numLetras = numeroALetras(esc.numero);
      const tipoMayus = esc.tipo_instrumento_texto.toUpperCase();
      const fechaEsc = fechaATextoLegal(esc.fecha_autorizacion);

      children.push(new Paragraph({
        spacing: { after: 100 },
        indent: { left: convertMillimetersToTwip(5) },
        children: [
          txt(`Escritura número ${numLetras} (${esc.numero}): contrato de ${tipoMayus} autorizada en ${esc.lugar_autorizacion}, del Departamento de ${esc.departamento}, el ${fechaEsc}.`),
        ],
      }));
    }

    // Cancelled escrituras
    if (canceladas.length > 0) {
      children.push(emptyLine());
      const numsCanceladas = canceladas.map((e: EscrituraAviso) => String(e.numero)).join(', ');
      const pluralC = canceladas.length > 1;
      children.push(new Paragraph({
        spacing: { after: 200 },
        children: [
          txt(`La${pluralC ? 's' : ''} escritura${pluralC ? 's' : ''} número${pluralC ? 's' : ''} ${numsCanceladas} fue${pluralC ? 'ron' : ''} cancelada${pluralC ? 's' : ''}.`),
        ],
      }));
    }
  }

  // Closing
  children.push(emptyLine());
  children.push(new Paragraph({
    spacing: { after: 400 },
    children: [txt('Sin otro particular me suscribo, atentamente,')],
  }));
  children.push(emptyLine());
  children.push(emptyLine());

  // Signature
  children.push(new Paragraph({
    children: [txt(NOTARIA.nombre, { bold: true })],
  }));
  children.push(emptyLine());
  children.push(new Paragraph({
    children: [txt(`COLEGIADO: ${NOTARIA.colegiado}`, { bold: true })],
  }));
  children.push(emptyLine());
  children.push(new Paragraph({
    children: [txt(`Clave: ${NOTARIA.clave}`, { bold: true })],
  }));

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT },
          margin: {
            top: convertMillimetersToTwip(25.4),
            right: convertMillimetersToTwip(25.4),
            bottom: convertMillimetersToTwip(25.4),
            left: convertMillimetersToTwip(25.4),
          },
        },
      },
      children,
    }],
  });

  return await Packer.toBlob(doc);
}
