'use client';

import { useState } from 'react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { useFetch } from '@/lib/hooks/use-fetch';

// ── Types ───────────────────────────────────────────────────────────────────

interface Stats {
  tomos_procesados: number;
  fragmentos_indexados: number;
}

interface Fragmento {
  id: string;
  tomo_id: string;
  contenido: string;
  pagina_inicio: number;
  pagina_fin: number;
  numero_fragmento: number;
  metadata: any;
  similarity: number;
  tomo_titulo: string;
  tomo_archivo: string;
  carpeta_nombre: string | null;
}

interface SearchResponse {
  query: string;
  total_resultados: number;
  respuesta_ia: string;
  resultados: Fragmento[];
}

interface Ficha {
  numero_casacion: string;
  fecha_sentencia: string;
  tomo_fuente: string;
  materia: string;
  tema_principal: string;
  subtemas: string[];
  hechos_relevantes: string;
  ratio_decidendi: string;
  obiter_dicta: string;
  normas_citadas: string[];
  criterio_aplicable: string;
}

// ── Materia colors ──────────────────────────────────────────────────────────

const MATERIA_COLORS: Record<string, string> = {
  civil: '#2d6bcf',
  penal: '#dc2626',
  laboral: '#16a34a',
  'contencioso administrativo': '#7c3aed',
  contencioso: '#7c3aed',
};

function materiaColor(materia: string): string {
  const key = materia.toLowerCase();
  for (const [k, v] of Object.entries(MATERIA_COLORS)) {
    if (key.includes(k)) return v;
  }
  return '#6b7280';
}

function materiaBadgeClass(materia: string): string {
  const key = materia.toLowerCase();
  if (key.includes('civil')) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (key.includes('penal')) return 'bg-red-50 text-red-700 border-red-200';
  if (key.includes('laboral')) return 'bg-green-50 text-green-700 border-green-200';
  if (key.includes('contencioso')) return 'bg-purple-50 text-purple-700 border-purple-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

// ── Threshold presets ────────────────────────────────────────────────────────

const THRESHOLDS = [
  { label: 'Alta', value: 0.5, desc: 'Solo resultados muy relevantes' },
  { label: 'Media', value: 0.35, desc: 'Balance entre relevancia y cobertura' },
  { label: 'Baja', value: 0.2, desc: 'Más resultados, menor precisión' },
];

// ── Download helpers ─────────────────────────────────────────────────────────

async function downloadDocx(query: string, respuestaIA: string, resultados: Fragmento[]) {
  const children: Paragraph[] = [];

  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'RESULTADO DE BÚSQUEDA JURISPRUDENCIAL', bold: true })],
  }));

  children.push(new Paragraph({
    children: [new TextRun({ text: `Consulta: ${query}`, size: 22 })],
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: `Fecha: ${new Date().toLocaleDateString('es-GT')}`, size: 22 })],
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: `Resultados encontrados: ${resultados.length}`, size: 22 })],
  }));

  children.push(new Paragraph({ children: [] }));

  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text: 'SÍNTESIS', bold: true })],
  }));

  if (respuestaIA) {
    respuestaIA.split('\n').filter((p: string) => p.trim()).forEach((parrafo: string) => {
      children.push(new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: parrafo, size: 22 })],
      }));
    });
  }

  children.push(new Paragraph({ children: [] }));

  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text: 'FRAGMENTOS DE JURISPRUDENCIA', bold: true })],
  }));

  resultados.forEach((r: Fragmento, i: number) => {
    const similitud = r.similarity ? `${(r.similarity * 100).toFixed(0)}%` : 'N/A';

    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 240 },
      children: [new TextRun({
        text: `Fragmento ${i + 1} — ${r.tomo_titulo} (Similitud: ${similitud})`,
        bold: true,
      })],
    }));

    r.contenido.split('\n').filter((p: string) => p.trim()).forEach((parrafo: string) => {
      children.push(new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: parrafo, font: 'Courier New', size: 20 })],
      }));
    });
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, `jurisprudencia-${query.replace(/\s+/g, '-').toLowerCase()}.docx`);
}

function downloadTxt(query: string, respuestaIA: string, resultados: Fragmento[]) {
  let content = '';
  content += '========================================\n';
  content += 'RESULTADO DE BÚSQUEDA JURISPRUDENCIAL\n';
  content += '========================================\n\n';
  content += `Consulta: ${query}\n`;
  content += `Fecha: ${new Date().toLocaleDateString('es-GT')}\n`;
  content += `Resultados encontrados: ${resultados.length}\n\n`;
  content += '--- SÍNTESIS ---\n\n';
  content += (respuestaIA || 'Sin síntesis disponible') + '\n\n';
  content += '--- FRAGMENTOS DE JURISPRUDENCIA ---\n\n';

  resultados.forEach((r: Fragmento, i: number) => {
    const similitud = r.similarity ? `${(r.similarity * 100).toFixed(0)}%` : 'N/A';
    content += `━━━ Fragmento ${i + 1} ━━━\n`;
    content += `Tomo: ${r.tomo_titulo}\n`;
    content += `Similitud: ${similitud}\n\n`;
    content += r.contenido + '\n\n';
  });

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `jurisprudencia-${query.replace(/\s+/g, '-').toLowerCase()}.txt`);
}

async function downloadFichasDocx(query: string, fichas: Ficha[]) {
  const children: Paragraph[] = [];

  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'FICHAS JURISPRUDENCIALES', bold: true })],
  }));

  children.push(new Paragraph({
    children: [new TextRun({ text: `Consulta: ${query}`, size: 22 })],
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: `Fecha: ${new Date().toLocaleDateString('es-GT')}`, size: 22 })],
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: `Total de fichas: ${fichas.length}`, size: 22 })],
  }));

  fichas.forEach((ficha: Ficha, i: number) => {
    children.push(new Paragraph({ children: [] }));

    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: `FICHA ${i + 1}`, bold: true })],
    }));

    const campos: [string, string][] = [
      ['Casación No.', ficha.numero_casacion],
      ['Fecha de Sentencia', ficha.fecha_sentencia],
      ['Materia', ficha.materia],
      ['Tomo', ficha.tomo_fuente],
      ['Tema Principal', ficha.tema_principal],
    ];

    campos.forEach(([label, value]: [string, string]) => {
      children.push(new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({ text: `${label}: `, bold: true, size: 22 }),
          new TextRun({ text: value || 'No disponible', size: 22 }),
        ],
      }));
    });

    const secciones: [string, string][] = [
      ['HECHOS RELEVANTES', ficha.hechos_relevantes],
      ['RATIO DECIDENDI', ficha.ratio_decidendi],
      ['OBITER DICTA', ficha.obiter_dicta],
      ['CRITERIO APLICABLE', ficha.criterio_aplicable],
    ];

    secciones.forEach(([titulo, contenido]: [string, string]) => {
      if (contenido && contenido !== 'No disponible en el fragmento') {
        children.push(new Paragraph({
          spacing: { before: 180 },
          children: [new TextRun({ text: titulo, bold: true, size: 22, underline: {} })],
        }));

        contenido.split('\n').filter((p: string) => p.trim()).forEach((parrafo: string) => {
          children.push(new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({
              text: parrafo,
              size: 22,
              bold: titulo === 'RATIO DECIDENDI' || titulo === 'CRITERIO APLICABLE',
            })],
          }));
        });
      }
    });

    if (ficha.normas_citadas && ficha.normas_citadas.length > 0) {
      children.push(new Paragraph({
        spacing: { before: 180 },
        children: [new TextRun({ text: 'NORMAS CITADAS', bold: true, size: 22, underline: {} })],
      }));
      children.push(new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: ficha.normas_citadas.join(', '), size: 22 })],
      }));
    }
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, `fichas-${query.replace(/\s+/g, '-').toLowerCase()}.docx`);
}

// ── Component ───────────────────────────────────────────────────────────────

export default function BuscarJurisprudenciaPage() {
  const { data: stats } = useFetch<Stats>('/api/admin/jurisprudencia/stats');

  const [query, setQuery] = useState('');
  const [threshold, setThreshold] = useState(0.35);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Selection & fichas state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFichasModal, setShowFichasModal] = useState(false);
  const [generatingFichas, setGeneratingFichas] = useState(false);
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [fichasError, setFichasError] = useState<string | null>(null);
  const [expandedFichaIds, setExpandedFichaIds] = useState<Set<number>>(new Set());

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedFragmentos = result?.resultados.filter((f: Fragmento) => selectedIds.has(f.id)) ?? [];

  const handleGenerarFichas = async () => {
    if (selectedFragmentos.length === 0) return;
    setGeneratingFichas(true);
    setFichasError(null);
    setFichas([]);
    setExpandedFichaIds(new Set());

    try {
      const res = await fetch('/api/admin/jurisprudencia/generar-fichas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: result?.query ?? query,
          fragmentos: selectedFragmentos.map((f: Fragmento) => ({
            tomo_titulo: f.tomo_titulo,
            contenido: f.contenido,
          })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFichasError(data.error ?? 'Error al generar fichas');
        return;
      }

      setFichas(data.fichas ?? []);
    } catch (err: any) {
      setFichasError(err.message ?? 'Error de conexión');
    } finally {
      setGeneratingFichas(false);
    }
  };

  const toggleFichaExpanded = (idx: number) => {
    setExpandedFichaIds((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || searching) return;

    setSearching(true);
    setError(null);
    setResult(null);
    setExpandedIds(new Set());
    setSelectedIds(new Set());
    setFichas([]);
    setShowFichasModal(false);

    try {
      const res = await fetch('/api/admin/jurisprudencia/buscar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), threshold, limit: 10 }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Error al buscar');
        return;
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message ?? 'Error de conexión');
    } finally {
      setSearching(false);
    }
  };

  const handleViewTomo = async (tomoId: string) => {
    const res = await fetch(`/api/admin/jurisprudencia/${tomoId}`);
    const data = await res.json();
    if (data.signed_url) {
      window.open(data.signed_url, '_blank');
    }
  };

  const similarityColor = (sim: number) => {
    const pct = Math.round(sim * 100);
    if (pct >= 80) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (pct >= 70) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Buscador de Jurisprudencia</h1>
        <p className="text-sm text-slate-500 mt-1">
          Búsqueda semántica con IA sobre los tomos procesados
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Tomos Procesados</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {stats ? stats.tomos_procesados.toLocaleString('es-GT') : '—'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Fragmentos Indexados</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {stats ? stats.fragmentos_indexados.toLocaleString('es-GT') : '—'}
          </p>
        </div>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej: ¿Qué dice la jurisprudencia sobre el despido injustificado?"
              className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
            />
            <svg className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="px-6 py-3 text-sm rounded-lg bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white font-medium hover:shadow-lg hover:shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {searching ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Buscando...
              </span>
            ) : (
              'Buscar'
            )}
          </button>
        </div>

        {/* Threshold chips */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs text-slate-500">Precisión:</span>
          {THRESHOLDS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setThreshold(t.value)}
              title={t.desc}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                threshold === t.value
                  ? 'bg-blue-50 text-blue-700 border-blue-200 font-medium'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
            >
              {t.label} ({t.value})
            </button>
          ))}
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 mb-6">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* AI Response */}
          {result.respuesta_ia && (
            <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl p-6 text-white shadow-lg shadow-blue-900/20">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.591.659H9.061a2 2 0 01-1.591-.659L5 14.5m14 0V17a2 2 0 01-2 2H7a2 2 0 01-2-2v-2.5" />
                </svg>
                <h3 className="font-semibold text-lg">Respuesta IA</h3>
              </div>
              <div className="text-blue-50 text-sm leading-relaxed whitespace-pre-wrap">
                {result.respuesta_ia}
              </div>
            </div>
          )}

          {/* Download buttons + Results header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-700">
              {result.total_resultados} fragmento{result.total_resultados !== 1 ? 's' : ''} encontrado{result.total_resultados !== 1 ? 's' : ''}
            </h3>
            {result.resultados.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => downloadDocx(result.query, result.respuesta_ia, result.resultados)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1a2744] text-white rounded-lg hover:bg-[#2d6bcf] transition-colors text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Descargar DOCX
                </button>
                <button
                  onClick={() => downloadTxt(result.query, result.respuesta_ia, result.resultados)}
                  className="flex items-center gap-2 px-4 py-2 border border-[#1a2744] text-[#1a2744] rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Descargar TXT
                </button>
              </div>
            )}
          </div>

          {/* Fragment cards */}
          {result.resultados.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
              <p className="text-slate-500 text-sm">No se encontraron fragmentos con la precisión seleccionada.</p>
              <p className="text-slate-400 text-xs mt-1">Intenta reducir el nivel de precisión o reformula tu consulta.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {result.resultados.map((frag: Fragmento) => {
                const pct = Math.round(frag.similarity * 100);
                const isExpanded = expandedIds.has(frag.id);

                return (
                  <div
                    key={frag.id}
                    className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
                      selectedIds.has(frag.id) ? 'border-blue-300 ring-1 ring-blue-200' : 'border-slate-200'
                    }`}
                  >
                    {/* Header row */}
                    <div className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50/50 transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(frag.id)}
                        onChange={() => toggleSelected(frag.id)}
                        className="w-4 h-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <button
                        onClick={() => toggleExpanded(frag.id)}
                        className="flex-1 flex items-center gap-3 text-left min-w-0"
                      >
                      <svg
                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-slate-900 truncate">
                            {frag.tomo_titulo}
                          </span>
                          {frag.carpeta_nombre && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                              {frag.carpeta_nombre}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Fragmento #{frag.numero_fragmento} — Págs. {frag.pagina_inicio}–{frag.pagina_fin}
                        </p>
                      </div>
                      <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${similarityColor(frag.similarity)}`}>
                        {pct}%
                      </span>
                      </button>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="px-5 pb-4 border-t border-slate-100">
                        <div className="pt-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
                          {frag.contenido}
                        </div>
                        <div className="flex justify-end mt-3">
                          <button
                            onClick={() => handleViewTomo(frag.tomo_id)}
                            className="text-xs px-3 py-1.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                          >
                            Ver Tomo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Selection bar ──────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 md:left-64">
          <div className="bg-[#1a2744] text-white px-6 py-3 flex items-center justify-between shadow-xl">
            <span className="text-sm font-medium">
              {selectedIds.size} fragmento{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-sm px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                Limpiar selección
              </button>
              <button
                onClick={() => { setShowFichasModal(true); setFichas([]); setFichasError(null); }}
                className="text-sm px-4 py-1.5 rounded-lg bg-cyan-500 text-white font-medium hover:bg-cyan-400 transition-colors"
              >
                Generar Fichas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fichas Modal ──────────────────────────────────────────────── */}
      {showFichasModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10 rounded-t-xl">
              <h2 className="text-lg font-semibold text-slate-900">Fichas Jurisprudenciales</h2>
              <button
                onClick={() => setShowFichasModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {/* Pre-generation: show selected fragments summary */}
              {fichas.length === 0 && !generatingFichas && !fichasError && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Se generarán fichas jurisprudenciales a partir de {selectedFragmentos.length} fragmento{selectedFragmentos.length !== 1 ? 's' : ''} seleccionado{selectedFragmentos.length !== 1 ? 's' : ''}:
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedFragmentos.map((f: Fragmento, i: number) => (
                      <div key={f.id} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg text-sm">
                        <span className="text-slate-400 font-mono text-xs">{i + 1}</span>
                        <span className="text-slate-700 truncate">{f.tomo_titulo}</span>
                        <span className="text-xs text-slate-400 shrink-0">Frag. #{f.numero_fragmento}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleGenerarFichas}
                    className="w-full px-4 py-3 text-sm rounded-lg bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white font-medium hover:shadow-lg hover:shadow-blue-900/20 transition-all"
                  >
                    Generar Fichas con IA
                  </button>
                </div>
              )}

              {/* Loading */}
              {generatingFichas && (
                <div className="flex flex-col items-center gap-4 py-12">
                  <svg className="w-8 h-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-sm text-slate-600">Analizando jurisprudencia... esto puede tardar unos segundos</p>
                </div>
              )}

              {/* Error */}
              {fichasError && (
                <div className="space-y-4">
                  <div className="px-4 py-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                    {fichasError}
                  </div>
                  <button
                    onClick={handleGenerarFichas}
                    className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              {/* Fichas generated */}
              {fichas.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700">{fichas.length} ficha{fichas.length !== 1 ? 's' : ''} generada{fichas.length !== 1 ? 's' : ''}</p>
                    <button
                      onClick={() => downloadFichasDocx(result?.query ?? query, fichas)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#1a2744] text-white rounded-lg hover:bg-[#2d6bcf] transition-colors text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Descargar Fichas DOCX
                    </button>
                  </div>

                  <div className="space-y-4">
                    {fichas.map((ficha: Ficha, idx: number) => {
                      const isFichaExpanded = expandedFichaIds.has(idx);
                      return (
                        <div
                          key={idx}
                          className="rounded-xl border border-slate-200 overflow-hidden animate-fadeIn"
                          style={{ borderLeftWidth: 4, borderLeftColor: materiaColor(ficha.materia) }}
                        >
                          {/* Ficha header */}
                          <div className="px-5 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h4 className="font-semibold text-slate-900">{ficha.numero_casacion}</h4>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  Sentencia: {ficha.fecha_sentencia} | Tomo: {ficha.tomo_fuente}
                                </p>
                              </div>
                              <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${materiaBadgeClass(ficha.materia)}`}>
                                {ficha.materia}
                              </span>
                            </div>

                            <p className="text-sm text-slate-700 mt-2">
                              <span className="font-medium">Tema:</span> {ficha.tema_principal}
                            </p>

                            {/* Criterio aplicable — always visible, highlighted */}
                            {ficha.criterio_aplicable && ficha.criterio_aplicable !== 'No disponible en el fragmento' && (
                              <div className="mt-3 px-4 py-3 bg-sky-50 border border-sky-100 rounded-lg">
                                <p className="text-xs font-semibold text-sky-800 uppercase tracking-wider mb-1">Criterio Aplicable</p>
                                <p className="text-sm text-sky-900 leading-relaxed">{ficha.criterio_aplicable}</p>
                              </div>
                            )}

                            {/* Normas */}
                            {ficha.normas_citadas && ficha.normas_citadas.length > 0 && (
                              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-medium text-slate-500">Normas:</span>
                                {ficha.normas_citadas.map((n: string, ni: number) => (
                                  <span key={ni} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{n}</span>
                                ))}
                              </div>
                            )}

                            {/* Expand toggle */}
                            <button
                              onClick={() => toggleFichaExpanded(idx)}
                              className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                            >
                              {isFichaExpanded ? 'Ver menos' : 'Ver detalles completos'}
                            </button>
                          </div>

                          {/* Expanded details */}
                          {isFichaExpanded && (
                            <div className="px-5 pb-4 border-t border-slate-100 pt-4 space-y-3">
                              {ficha.hechos_relevantes && ficha.hechos_relevantes !== 'No disponible en el fragmento' && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Hechos Relevantes</p>
                                  <p className="text-sm text-slate-700 leading-relaxed">{ficha.hechos_relevantes}</p>
                                </div>
                              )}
                              {ficha.ratio_decidendi && ficha.ratio_decidendi !== 'No disponible en el fragmento' && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Ratio Decidendi</p>
                                  <p className="text-sm text-slate-700 leading-relaxed font-medium">{ficha.ratio_decidendi}</p>
                                </div>
                              )}
                              {ficha.obiter_dicta && ficha.obiter_dicta !== 'No disponible en el fragmento' && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Obiter Dicta</p>
                                  <p className="text-sm text-slate-700 leading-relaxed">{ficha.obiter_dicta}</p>
                                </div>
                              )}
                              {ficha.subtemas && ficha.subtemas.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Subtemas</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {ficha.subtemas.map((s: string, si: number) => (
                                      <span key={si} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{s}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state — no search yet */}
      {!result && !searching && !error && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <svg className="w-12 h-12 mx-auto text-slate-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-slate-500 text-sm">
            Ingresa una consulta para buscar en los tomos de jurisprudencia procesados.
          </p>
          <p className="text-slate-400 text-xs mt-1">
            La búsqueda semántica encuentra fragmentos relevantes usando inteligencia artificial.
          </p>
        </div>
      )}
    </div>
  );
}
