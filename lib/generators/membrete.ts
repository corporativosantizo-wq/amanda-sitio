// ============================================================================
// lib/generators/membrete.ts
// Shared header/footer builder from membrete image for all DOCX generators
// ============================================================================

import {
  Header, Footer, Paragraph, ImageRun, TextRun, AlignmentType,
} from 'docx';

export interface MembreteConfig {
  headerImageBase64?: string; // base64-encoded PNG/JPG
  headerImageWidth?: number;  // px, default 600
  headerImageHeight?: number; // px, default 100
}

/**
 * Builds a DOCX Header with the membrete image, or undefined if no image.
 */
export function buildHeader(config?: MembreteConfig): { default: Header } | undefined {
  if (!config?.headerImageBase64) return undefined;

  const width = config.headerImageWidth ?? 600;
  const height = config.headerImageHeight ?? 100;

  return {
    default: new Header({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: Buffer.from(config.headerImageBase64, 'base64'),
              transformation: { width, height },
              type: 'png',
            }),
          ],
        }),
      ],
    }),
  };
}

/**
 * Builds a simple footer with the notary name centered.
 */
export function buildFooter(): { default: Footer } {
  return {
    default: new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'SOAZIG AMANDA SANTIZO CALDERÓN — Colegiado 19565',
              font: 'Arial',
              size: 16,
              color: '999999',
            }),
          ],
        }),
      ],
    }),
  };
}
