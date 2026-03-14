// ============================================================================
// POST /api/admin/mercantil/entidades/importar
// Importar entidades mercantiles desde archivo Excel (.xlsx)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import * as XLSX from 'xlsx';
import { createAdminClient } from '@/lib/supabase/admin';

const TIPOS_VALIDOS = ['sociedad_anonima', 'sociedad_limitada', 'empresa_individual', 'otra'];

interface FilaError {
  fila: number;
  error: string;
}

function toStr(val: unknown): string | null {
  if (val == null || val === '') return null;
  return String(val).trim();
}

function toInt(val: unknown): number | null {
  if (val == null || val === '') return null;
  const n = parseInt(String(val), 10);
  return isNaN(n) ? null : n;
}

function toDateStr(val: unknown): string | null {
  if (val == null || val === '') return null;
  // XLSX may return a JS Date object for date cells
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  // Try to parse common date formats
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return s;
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const formData = await req.formData();
    const file = formData.get('archivo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });
    }

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json({ error: 'El archivo debe ser .xlsx o .xls' }, { status: 400 });
    }

    // Parse Excel
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: 'El archivo no contiene hojas' }, { status: 400 });
    }

    const sheet = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    if (rows.length < 2) {
      return NextResponse.json({ error: 'El archivo no contiene datos (solo encabezado o vacío)' }, { status: 400 });
    }

    const db = createAdminClient();

    // Get existing entity names for duplicate detection
    const { data: existentes } = await db
      .from('entidades_mercantiles')
      .select('nombre');
    const nombresExistentes = new Set(
      (existentes ?? []).map((e: any) => e.nombre.toLowerCase().trim())
    );

    const errores: FilaError[] = [];
    let creadas = 0;
    let duplicadas = 0;

    // Process rows (skip header at index 0)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const filaNum = i + 1; // 1-based for user display

      // Skip completely empty rows
      if (!row || row.every((c: unknown) => c == null || c === '')) continue;

      const nombre = toStr(row[0]);    // Col A
      const tipo = toStr(row[2]);      // Col C

      // Validate required fields
      if (!nombre) {
        errores.push({ fila: filaNum, error: 'Nombre (col A) es obligatorio' });
        continue;
      }

      if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
        errores.push({
          fila: filaNum,
          error: `tipo_entidad (col C) inválido: "${tipo ?? ''}" — usar: ${TIPOS_VALIDOS.join(', ')}`,
        });
        continue;
      }

      // Check duplicates
      if (nombresExistentes.has(nombre.toLowerCase())) {
        duplicadas++;
        errores.push({ fila: filaNum, error: `Ya existe entidad con nombre "${nombre}"` });
        continue;
      }

      // Map columns to fields
      const entidad = {
        nombre,
        nombre_corto: toStr(row[1]),                         // Col B
        tipo_entidad: tipo,                                   // Col C
        nit: toStr(row[3]),                                   // Col D
        registro_mercantil_numero: toInt(row[4]),             // Col E
        registro_mercantil_folio: toInt(row[5]),              // Col F
        registro_mercantil_libro: toInt(row[6]),              // Col G
        patente_comercio: toStr(row[7]),                      // Col H
        escritura_numero: toInt(row[8]),                      // Col I
        escritura_fecha: toDateStr(row[9]),                   // Col J
        escritura_notario: toStr(row[10]),                    // Col K
        representante_legal_nombre: toStr(row[11]),           // Col L
        representante_legal_cargo: toStr(row[12]),            // Col M
        representante_legal_registro: toInt(row[13]),         // Col N
        representante_legal_folio: toInt(row[14]),            // Col O
        representante_legal_libro: toInt(row[15]),            // Col P
        notas: toStr(row[16]),                                // Col Q
        activa: true,
      };

      const { error } = await db
        .from('entidades_mercantiles')
        .insert(entidad);

      if (error) {
        errores.push({ fila: filaNum, error: error.message });
      } else {
        creadas++;
        // Add to set to detect duplicates within the same file
        nombresExistentes.add(nombre.toLowerCase());
      }
    }

    return NextResponse.json({ creadas, duplicadas, errores });
  } catch (err: any) {
    console.error('ERROR IMPORTAR ENTIDADES:', err);
    return NextResponse.json(
      { error: err.message ?? 'Error al procesar el archivo' },
      { status: 500 }
    );
  }
}
