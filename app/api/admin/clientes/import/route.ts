// ============================================================================
// POST /api/admin/clientes/import
// Importación masiva de clientes desde Excel
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface ImportRow {
  codigo_cliente?: string;
  tipo?: string;
  nombre?: string;
  nit?: string;
  dpi?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  fuente?: string;
  estado?: string;
  abogado_asignado?: string;
}

interface ImportResult {
  insertados: number;
  errores: number;
  duplicados: number;
  detalle_errores: string[];
}

function inferTipo(nombre: string): 'persona' | 'empresa' {
  const upper = nombre.toUpperCase();
  if (
    upper.includes('S.A.') ||
    upper.includes('S. A.') ||
    upper.includes('SOCIEDAD') ||
    upper.includes('S.R.L.') ||
    upper.includes('LTDA') ||
    upper.includes('CIA.') ||
    upper.includes('COMPAÑÍA') ||
    upper.includes('ASOCIACIÓN') ||
    upper.includes('FUNDACIÓN') ||
    upper.includes('CORPORACIÓN') ||
    upper.includes('EMPRESA') ||
    upper.includes(', S.A') ||
    upper.includes(',S.A')
  ) {
    return 'empresa';
  }
  return 'persona';
}

function mapEstado(raw: string): 'activo' | 'inactivo' | 'prospecto' {
  const lower = raw.toLowerCase().trim();
  if (lower === 'inactivo' || lower === 'inactiva') return 'inactivo';
  if (lower === 'prospecto') return 'prospecto';
  return 'activo';
}

function mapTipo(raw: string, nombre: string): 'persona' | 'empresa' {
  const lower = raw.toLowerCase().trim();
  if (lower === 'empresa' || lower === 'jurídica' || lower === 'juridica') return 'empresa';
  if (lower === 'persona' || lower === 'individual' || lower === 'natural') return 'persona';
  // Si no se reconoce, inferir del nombre
  return inferTipo(nombre);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rows: ImportRow[] = body.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: 'No se recibieron datos para importar.' },
        { status: 400 }
      );
    }

    if (rows.length > 500) {
      return NextResponse.json(
        { error: 'Máximo 500 registros por importación.' },
        { status: 400 }
      );
    }

    const db = createAdminClient();
    const result: ImportResult = {
      insertados: 0,
      errores: 0,
      duplicados: 0,
      detalle_errores: [],
    };

    // Obtener clientes existentes para verificar duplicados
    const { data: existentes } = await db
      .from('clientes')
      .select('codigo, nombre, nit');

    const codigosExistentes = new Set(
      (existentes ?? []).map((c: any) => (c.codigo as string).toUpperCase())
    );
    const nombresExistentes = new Set(
      (existentes ?? []).map((c: any) => (c.nombre as string).toUpperCase().trim())
    );

    // Obtener el último código numérico para auto-generar si hace falta
    const codigosNumericos = (existentes ?? [])
      .map((c: any) => {
        const match = (c.codigo as string).match(/CLI-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n: number) => n > 0);
    let nextNum = codigosNumericos.length > 0 ? Math.max(...codigosNumericos) + 1 : 1;

    // Tracking de códigos usados en esta importación para evitar duplicados internos
    const codigosUsados = new Set<string>();

    const toInsert: Record<string, unknown>[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 porque fila 1 es header en Excel

      // Saltar filas sin nombre
      const nombre = (row.nombre ?? '').trim();
      if (!nombre) continue;

      // Verificar duplicados por nombre
      if (nombresExistentes.has(nombre.toUpperCase())) {
        result.duplicados++;
        result.detalle_errores.push(
          `Fila ${rowNum}: "${nombre}" ya existe en la base de datos.`
        );
        continue;
      }

      // Generar o usar código
      let codigo = (row.codigo_cliente ?? '').trim();
      if (codigo) {
        const codigoUpper = codigo.toUpperCase();
        if (codigosExistentes.has(codigoUpper) || codigosUsados.has(codigoUpper)) {
          result.duplicados++;
          result.detalle_errores.push(
            `Fila ${rowNum}: Código "${codigo}" ya existe.`
          );
          continue;
        }
        codigosUsados.add(codigoUpper);
      } else {
        // Auto-generar código CLI-XXXX
        codigo = `CLI-${String(nextNum).padStart(4, '0')}`;
        while (codigosExistentes.has(codigo.toUpperCase()) || codigosUsados.has(codigo.toUpperCase())) {
          nextNum++;
          codigo = `CLI-${String(nextNum).padStart(4, '0')}`;
        }
        codigosUsados.add(codigo.toUpperCase());
        nextNum++;
      }

      // Mapear tipo
      const tipo = row.tipo ? mapTipo(row.tipo, nombre) : inferTipo(nombre);

      // Mapear estado
      const estado = row.estado ? mapEstado(row.estado) : 'activo';

      // NIT y DPI como texto
      const nit = row.nit ? String(row.nit).trim() : 'CF';
      const dpi = row.dpi ? String(row.dpi).trim().replace(/[^0-9]/g, '') : null;

      // Validar DPI (13 dígitos si es persona)
      if (dpi && dpi.length !== 13 && tipo === 'persona') {
        result.detalle_errores.push(
          `Fila ${rowNum}: DPI "${dpi}" no tiene 13 dígitos (se importará de todas formas).`
        );
      }

      toInsert.push({
        codigo,
        tipo,
        nombre,
        nit,
        dpi: dpi || null,
        telefono: row.telefono ? String(row.telefono).trim() : null,
        email: row.email ? String(row.email).trim().toLowerCase() : null,
        direccion: row.direccion ? String(row.direccion).trim() : null,
        fuente: row.fuente ? String(row.fuente).trim() : null,
        estado,
        abogado_asignado: row.abogado_asignado
          ? String(row.abogado_asignado).trim()
          : 'Amanda Santizo',
        razon_social_facturacion: nombre,
        nit_facturacion: nit,
        direccion_facturacion: row.direccion
          ? String(row.direccion).trim()
          : 'Ciudad',
        activo: estado !== 'inactivo',
      });
    }

    // Insertar en lotes de 50
    if (toInsert.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const batch = toInsert.slice(i, i + batchSize);
        const { data: inserted, error } = await db
          .from('clientes')
          .insert(batch)
          .select('id');

        if (error) {
          result.errores += batch.length;
          result.detalle_errores.push(
            `Error en lote ${Math.floor(i / batchSize) + 1}: ${error.message}`
          );
        } else {
          result.insertados += (inserted ?? []).length;
        }
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Import Clientes] Error:', error);
    return NextResponse.json(
      { error: error.message ?? 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
