// ============================================================================
// lib/templates/seleccionar.ts
// Selector central de plantillas de email por idioma del cliente.
//
// El spread {...ES, ...EN} da fallback por función — toda
// plantilla sin versión EN (p. ej. emailFactura, internas) sirve la ES.
// El flujo español es byte-idéntico: plantillas('es') === módulo ES de siempre.
// ============================================================================

import * as ES from './emails';
import * as EN from './emails-en';
import { idiomaCliente, type IdiomaCliente } from '@/lib/utils/idioma';

// Fase 2 (activada tras revisión de traducciones de Amanda, jul-2026): los
// clientes con idioma='en' reciben el juego EN; todos los demás, ES intacto.
const EN_HABILITADO = true;

export type JuegoPlantillas = typeof ES & Partial<typeof EN>;

export function plantillas(idioma?: IdiomaCliente | string | null): JuegoPlantillas {
  if (EN_HABILITADO && idioma === 'en') {
    return { ...ES, ...EN };
  }
  return ES;
}

// Conveniencia: resuelve directo desde el objeto cliente (o null/undefined).
export function plantillasDeCliente(cliente?: { idioma?: string | null } | null): JuegoPlantillas {
  return plantillas(idiomaCliente(cliente));
}
