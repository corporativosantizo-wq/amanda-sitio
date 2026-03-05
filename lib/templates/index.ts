// ============================================================================
// lib/templates/index.ts
// Registry y dispatcher de plantillas de documentos legales
// ============================================================================

import { Packer, Document } from 'docx';
import type { TipoDocumentoGenerable } from './types';
import { generarArrendamiento } from './arrendamiento';
import { generarLaboral } from './laboral';
import { generarAGOT } from './agot';
import { generarActaNotarialCertificacion } from './acta-notarial-certificacion';
import { generarAmparo } from './amparo';
import { generarRendicionCuentas } from './rendicion-cuentas';
import { generarSumarioNulidad } from './sumario-nulidad';
import { generarOposicionDesestimacion } from './oposicion-desestimacion';

export type { TipoDocumentoGenerable } from './types';

const GENERADORES: Record<TipoDocumentoGenerable, (datos: any) => Document> = {
  arrendamiento: generarArrendamiento,
  laboral: generarLaboral,
  agot: generarAGOT,
  acta_notarial_certificacion: generarActaNotarialCertificacion,
  amparo: generarAmparo,
  rendicion_cuentas: generarRendicionCuentas,
  sumario_nulidad: generarSumarioNulidad,
  oposicion_desestimacion: generarOposicionDesestimacion,
};

export const PLANTILLAS_DISPONIBLES: Record<TipoDocumentoGenerable, string> = {
  arrendamiento: 'Contrato de Arrendamiento',
  laboral: 'Contrato Individual de Trabajo',
  agot: 'Acta de Asamblea General Ordinaria Totalitaria',
  acta_notarial_certificacion: 'Acta Notarial de Certificación',
  amparo: 'Recurso de Amparo',
  rendicion_cuentas: 'Demanda Oral de Rendición de Cuentas',
  sumario_nulidad: 'Juicio Sumario de Nulidad',
  oposicion_desestimacion: 'Oposición a Desestimación',
};

export async function generarDocumento(
  tipo: TipoDocumentoGenerable,
  datos: any
): Promise<Buffer> {
  const generador = GENERADORES[tipo];
  if (!generador) {
    throw new Error(`Tipo de documento no soportado: "${tipo}". Tipos válidos: ${Object.keys(PLANTILLAS_DISPONIBLES).join(', ')}`);
  }

  const doc = generador(datos);
  return Buffer.from(await Packer.toBuffer(doc));
}
