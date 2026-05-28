// ============================================================================
// lib/og/qr.ts
// Genera un QR como data URL (PNG) para incrustar dentro de ImageResponse.
// ============================================================================

import QRCode from 'qrcode';

export async function qrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    margin: 1,
    width: 240,
    errorCorrectionLevel: 'M',
    color: { dark: '#0F172A', light: '#FFFFFF' },
  });
}
