// ============================================================================
// app/admin/clientes/importar/page.tsx
// Importador visual de clientes desde Excel
// ============================================================================
'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import ExcelJS from 'exceljs';

// ── Tipos ───────────────────────────────────────────────────────────────────

interface ExcelRow {
  [key: string]: unknown;
}

interface MappedRow {
  codigo_cliente: string;
  tipo: string;
  nombre: string;
  nit: string;
  dpi: string;
  telefono: string;
  email: string;
  direccion: string;
  fuente: string;
  estado: string;
  abogado_asignado: string;
}

interface ImportResult {
  insertados: number;
  errores: number;
  duplicados: number;
  detalle_errores: string[];
}

// ── Campos de destino en la BD ──────────────────────────────────────────────

const DB_FIELDS = [
  { key: 'codigo_cliente', label: 'Código cliente', desc: 'ID interno (CLI-0001)' },
  { key: 'tipo', label: 'Tipo', desc: 'Persona / Empresa' },
  { key: 'nombre', label: 'Nombre *', desc: 'Nombre completo o razón social' },
  { key: 'nit', label: 'NIT', desc: 'Número de identificación tributaria' },
  { key: 'dpi', label: 'DPI', desc: '13 dígitos (solo personas)' },
  { key: 'telefono', label: 'Teléfono', desc: 'Número de contacto' },
  { key: 'email', label: 'Correo', desc: 'Email del cliente' },
  { key: 'direccion', label: 'Dirección', desc: 'Dirección física' },
  { key: 'fuente', label: 'Fuente', desc: 'Cómo llegó al bufete' },
  { key: 'estado', label: 'Estado', desc: 'Activo / Inactivo / Prospecto' },
  { key: 'abogado_asignado', label: 'Abogado asignado', desc: 'Abogado responsable' },
];

// ── Mapeo automático de columnas Excel → BD ─────────────────────────────────

const AUTO_MAP: Record<string, string[]> = {
  codigo_cliente: ['id cliente', 'codigo', 'código', 'codigo_cliente', 'id', 'code', 'cliente_id'],
  tipo: ['tipo', 'type', 'tipo_cliente', 'categoria'],
  nombre: ['nombre', 'name', 'razón social', 'razon social', 'razon_social', 'cliente', 'nombre completo'],
  nit: ['nit', 'nit_cliente', 'rtn', 'ruc', 'tax_id'],
  dpi: ['dpi', 'cui', 'documento', 'identidad', 'cedula', 'cédula'],
  telefono: ['teléfono', 'telefono', 'phone', 'tel', 'celular', 'móvil', 'movil'],
  email: ['correo', 'email', 'e-mail', 'correo electrónico', 'mail'],
  direccion: ['dirección', 'direccion', 'address', 'domicilio'],
  fuente: ['fuente', 'source', 'origen', 'referencia', 'referido'],
  estado: ['estado', 'status', 'state', 'activo'],
  abogado_asignado: ['abogado', 'abogado asignado', 'abogado_asignado', 'lawyer', 'asignado'],
};

function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const field of DB_FIELDS) {
    const candidates = AUTO_MAP[field.key] ?? [];
    const match = headers.find((h: string) =>
      candidates.some((c: string) => h.toLowerCase().trim() === c)
    );
    if (match) {
      mapping[field.key] = match;
    }
  }
  return mapping;
}

// ── Componente ──────────────────────────────────────────────────────────────

export default function ImportarClientes() {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<ExcelRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Leer Excel ──────────────────────────────────────────────────────────

  const MAX_EXCEL_SIZE = 150 * 1024 * 1024; // 150MB

  const processFile = useCallback(async (file: File) => {
    setError(null);
    if (!file.name.match(/\.(xlsx?|csv)$/i)) {
      setError('Solo se aceptan archivos .xlsx, .xls o .csv');
      return;
    }
    if (file.size > MAX_EXCEL_SIZE) {
      setError(`El archivo es demasiado grande (${(file.size / (1024 * 1024)).toFixed(1)} MB). Máximo 150MB.`);
      return;
    }
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      if (file.name.match(/\.csv$/i)) {
        const text = new TextDecoder().decode(buffer);
        const blob = new Blob([text], { type: 'text/csv' });
        const stream = blob.stream() as any;
        await workbook.csv.read(stream);
      } else {
        await workbook.xlsx.load(buffer);
      }

      const ws = workbook.worksheets[0];
      if (!ws || ws.rowCount < 2) {
        setError('El archivo está vacío.');
        return;
      }

      // Extract headers from first row
      const headerRow = ws.getRow(1);
      const cols: string[] = [];
      headerRow.eachCell((cell: any, colNumber: number) => {
        cols[colNumber - 1] = String(cell.value ?? '').trim();
      });

      // Extract data rows
      const json: ExcelRow[] = [];
      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const obj: ExcelRow = {};
        let hasValue = false;
        cols.forEach((col: string, idx: number) => {
          const val = row.getCell(idx + 1).value;
          obj[col] = val != null ? String(val).trim() : '';
          if (val != null && String(val).trim()) hasValue = true;
        });
        if (hasValue) json.push(obj);
      }

      if (json.length === 0) {
        setError('El archivo está vacío.');
        return;
      }

      setHeaders(cols.filter(Boolean));
      setRawRows(json);

      // Auto-detectar mapeo
      const autoMap = autoDetectMapping(cols.filter(Boolean));
      setMapping(autoMap);
      setStep('preview');
    } catch {
      setError('Error al leer el archivo. Verifique que sea un Excel válido.');
    }
  }, []);

  // ── Drag & Drop handlers ────────────────────────────────────────────────

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) void processFile(file);
    },
    [processFile]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void processFile(file);
    },
    [processFile]
  );

  // ── Mapear datos ────────────────────────────────────────────────────────

  const getMappedRows = useCallback((): MappedRow[] => {
    return rawRows.map((row: ExcelRow) => {
      const mapped: Record<string, string> = {};
      for (const field of DB_FIELDS) {
        const excelCol = mapping[field.key];
        mapped[field.key] = excelCol ? String(row[excelCol] ?? '').trim() : '';
      }
      return mapped as unknown as MappedRow;
    });
  }, [rawRows, mapping]);

  // ── Importar ────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!mapping.nombre) {
      setError('Debe mapear al menos la columna "Nombre".');
      return;
    }

    setStep('importing');
    setError(null);

    try {
      const rows = getMappedRows().filter((r: MappedRow) => r.nombre.trim());

      const res = await fetch('/api/admin/clientes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Error al importar.');
        setStep('preview');
        return;
      }

      setResult(data);
      setStep('done');
    } catch {
      setError('Error de conexión al importar.');
      setStep('preview');
    }
  };

  // ── Contar filas válidas ────────────────────────────────────────────────

  const validRowCount = mapping.nombre
    ? rawRows.filter((r: ExcelRow) => {
        const val = r[mapping.nombre];
        return val && String(val).trim();
      }).length
    : 0;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '28px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <Link
              href="/admin/clientes"
              style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}
            >
              &larr; Clientes
            </Link>
          </div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#111827',
              margin: 0,
            }}
          >
            Importar Clientes desde Excel
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>
            Suba un archivo .xlsx con los datos de sus clientes
          </p>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '14px 18px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            marginBottom: '20px',
            fontSize: '14px',
            color: '#991b1b',
          }}
        >
          {error}
        </div>
      )}

      {/* ── STEP 1: Upload ── */}
      {step === 'upload' && (
        <div
          onDrop={handleDrop}
          onDragOver={(e: React.DragEvent) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          style={{
            background: dragOver ? '#f0fdf4' : 'white',
            border: `2px dashed ${dragOver ? '#0d9488' : '#d1d5db'}`,
            borderRadius: '16px',
            padding: '60px 40px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <svg
            width="48"
            height="48"
            fill="none"
            stroke={dragOver ? '#0d9488' : '#9ca3af'}
            viewBox="0 0 24 24"
            style={{ margin: '0 auto 16px', display: 'block' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p style={{ fontSize: '16px', fontWeight: '600', color: '#374151', margin: '0 0 6px' }}>
            {dragOver ? 'Suelte el archivo aquí' : 'Arrastre su archivo Excel aquí'}
          </p>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>
            o haga clic para seleccionar (.xlsx, .xls, .csv)
          </p>
        </div>
      )}

      {/* ── STEP 2: Preview & Mapping ── */}
      {step === 'preview' && (
        <>
          {/* File info */}
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '12px',
              padding: '14px 18px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="20" height="20" fill="none" stroke="#16a34a" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span style={{ fontSize: '14px', color: '#166534' }}>
                <strong>{fileName}</strong> — {rawRows.length} filas detectadas, {validRowCount} con nombre
              </span>
            </div>
            <button
              onClick={() => {
                setStep('upload');
                setHeaders([]);
                setRawRows([]);
                setMapping({});
                setFileName('');
              }}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                background: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                cursor: 'pointer',
                color: '#374151',
              }}
            >
              Cambiar archivo
            </button>
          </div>

          {/* Column mapping */}
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '28px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              marginBottom: '24px',
            }}
          >
            <h2 style={{ fontSize: '17px', fontWeight: '600', color: '#111827', margin: '0 0 4px' }}>
              Mapeo de columnas
            </h2>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 20px' }}>
              Verifique que cada columna del Excel corresponda al campo correcto. El sistema detectó automáticamente las más comunes.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '14px',
              }}
            >
              {DB_FIELDS.map((field: { key: string; label: string; desc: string }) => (
                <div
                  key={field.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    background: mapping[field.key] ? '#f0fdf4' : '#f9fafb',
                    borderRadius: '10px',
                    border: `1px solid ${mapping[field.key] ? '#bbf7d0' : '#e5e7eb'}`,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>
                      {field.label}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>{field.desc}</div>
                  </div>
                  <select
                    value={mapping[field.key] ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      setMapping((prev: Record<string, string>) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }));
                    }}
                    style={{
                      padding: '6px 10px',
                      fontSize: '13px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      background: 'white',
                      minWidth: '140px',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">— Sin mapear —</option>
                    {headers.map((h: string) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview table */}
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              overflow: 'hidden',
              marginBottom: '24px',
            }}
          >
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #f3f4f6' }}>
              <h2 style={{ fontSize: '17px', fontWeight: '600', color: '#111827', margin: 0 }}>
                Vista previa (primeras 5 filas)
              </h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: '#6b7280', fontWeight: '500' }}>#</th>
                    {DB_FIELDS.filter((f: { key: string }) => mapping[f.key]).map((f: { key: string; label: string }) => (
                      <th key={f.key} style={{ padding: '10px 14px', textAlign: 'left', color: '#6b7280', fontWeight: '500', whiteSpace: 'nowrap' }}>
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {getMappedRows()
                    .slice(0, 5)
                    .map((row: MappedRow, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 14px', color: '#9ca3af' }}>{i + 1}</td>
                        {DB_FIELDS.filter((f: { key: string }) => mapping[f.key]).map((f: { key: string }) => (
                          <td key={f.key} style={{ padding: '10px 14px', color: '#111827', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {(row as unknown as Record<string, string>)[f.key] || (
                              <span style={{ color: '#d1d5db' }}>—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                setStep('upload');
                setHeaders([]);
                setRawRows([]);
                setMapping({});
              }}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                background: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '10px',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleImport}
              disabled={!mapping.nombre || validRowCount === 0}
              style={{
                padding: '12px 28px',
                fontSize: '14px',
                fontWeight: '600',
                color: 'white',
                background:
                  mapping.nombre && validRowCount > 0
                    ? 'linear-gradient(135deg, #1e3a5f, #2563eb)'
                    : '#9ca3af',
                border: 'none',
                borderRadius: '10px',
                cursor: mapping.nombre && validRowCount > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              Importar {validRowCount} clientes
            </button>
          </div>
        </>
      )}

      {/* ── STEP 3: Importing ── */}
      {step === 'importing' && (
        <div
          style={{
            background: 'white',
            borderRadius: '16px',
            padding: '60px 40px',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              border: '4px solid #e5e7eb',
              borderTop: '4px solid #1e3a5f',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px',
            }}
          />
          <p style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: '0 0 6px' }}>
            Importando clientes...
          </p>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
            Esto puede tomar unos segundos.
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── STEP 4: Done ── */}
      {step === 'done' && result && (
        <div
          style={{
            background: 'white',
            borderRadius: '16px',
            padding: '40px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <svg
              width="52"
              height="52"
              fill="none"
              stroke="#16a34a"
              viewBox="0 0 24 24"
              style={{ margin: '0 auto 12px', display: 'block' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: '0 0 6px' }}>
              Importación completada
            </h2>
          </div>

          {/* Stats */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                textAlign: 'center',
                padding: '20px',
                borderRadius: '12px',
                background: '#f0fdf4',
              }}
            >
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#16a34a' }}>
                {result.insertados}
              </div>
              <div style={{ fontSize: '13px', color: '#166534' }}>Insertados</div>
            </div>
            <div
              style={{
                textAlign: 'center',
                padding: '20px',
                borderRadius: '12px',
                background: '#fef9c3',
              }}
            >
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#ca8a04' }}>
                {result.duplicados}
              </div>
              <div style={{ fontSize: '13px', color: '#854d0e' }}>Duplicados</div>
            </div>
            <div
              style={{
                textAlign: 'center',
                padding: '20px',
                borderRadius: '12px',
                background: result.errores > 0 ? '#fef2f2' : '#f3f4f6',
              }}
            >
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: '700',
                  color: result.errores > 0 ? '#dc2626' : '#6b7280',
                }}
              >
                {result.errores}
              </div>
              <div style={{ fontSize: '13px', color: result.errores > 0 ? '#991b1b' : '#6b7280' }}>
                Errores
              </div>
            </div>
          </div>

          {/* Error details */}
          {result.detalle_errores.length > 0 && (
            <div
              style={{
                background: '#fef9c3',
                border: '1px solid #fde68a',
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '24px',
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#854d0e', marginBottom: '8px' }}>
                Detalle:
              </div>
              {result.detalle_errores.map((err: string, i: number) => (
                <div key={i} style={{ fontSize: '13px', color: '#92400e', marginBottom: '4px' }}>
                  {err}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link
              href="/admin/clientes"
              style={{
                padding: '12px 28px',
                fontSize: '14px',
                fontWeight: '600',
                color: 'white',
                background: 'linear-gradient(135deg, #1e3a5f, #2563eb)',
                borderRadius: '10px',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Ver clientes
            </Link>
            <button
              onClick={() => {
                setStep('upload');
                setHeaders([]);
                setRawRows([]);
                setMapping({});
                setResult(null);
                setFileName('');
              }}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                background: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '10px',
                cursor: 'pointer',
              }}
            >
              Importar otro archivo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
