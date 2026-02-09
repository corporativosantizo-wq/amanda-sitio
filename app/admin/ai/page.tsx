// ============================================================================
// app/admin/ai/page.tsx
// Asistente IA — Bullet Journal + Chat con shortcuts organizados
// ============================================================================
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import type { TareaConCliente } from '@/lib/types';
import {
  CATEGORIA_TAREA_LABEL,
  CATEGORIA_TAREA_COLOR,
  CategoriaTarea,
  TipoTarea,
  EstadoTarea,
} from '@/lib/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Cita {
  id: string;
  titulo: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  tipo: string;
  estado: string;
  cliente_nombre?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function hoy() {
  return new Date().toISOString().split('T')[0];
}

function finDeSemana() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  const end = new Date(d);
  end.setDate(d.getDate() + diff);
  return end.toISOString().split('T')[0];
}

function formatFechaHoy() {
  const d = new Date();
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${dias[d.getDay()]} ${d.getDate()} · ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

function formatHora12(hora: string) {
  const [h, m] = hora.split(':');
  const hNum = parseInt(h);
  const suffix = hNum >= 12 ? 'PM' : 'AM';
  const h12 = hNum === 0 ? 12 : hNum > 12 ? hNum - 12 : hNum;
  return `${h12}:${m} ${suffix}`;
}

// ── Suggestion categories ───────────────────────────────────────────────────

const SUGGESTION_CATEGORIES = [
  {
    label: 'Gestión de Casos',
    icon: '📋',
    color: '#0d9488',
    items: [
      '¿Qué expedientes tengo activos?',
      'Resume el estado del caso de [cliente]',
      '¿Qué audiencias tengo esta semana?',
    ],
  },
  {
    label: 'Comunicación',
    icon: '✉️',
    color: '#6366f1',
    items: [
      'Envía email de seguimiento a [cliente]',
      'Cobra Q[monto] a [cliente]',
      'Envía documentos disponibles a [cliente]',
      'Redacta email personalizado',
    ],
  },
  {
    label: 'Documentos',
    icon: '📄',
    color: '#8b5cf6',
    items: [
      'Genera contrato de arrendamiento',
      'Genera contrato laboral',
      'Genera acta de asamblea',
      'Genera recurso de amparo',
    ],
  },
  {
    label: 'Cobros y Pagos',
    icon: '💰',
    color: '#f59e0b',
    items: [
      '¿Quién me debe?',
      'Genera cotización para [cliente]',
      'Confirma pago de [cliente]',
      'Envía estado de cuenta a [cliente]',
    ],
  },
  {
    label: 'Tareas',
    icon: '✓',
    color: '#10b981',
    items: [
      '¿Qué tengo pendiente hoy?',
      'Anota: [tarea]',
      'Migra las tareas de ayer',
      '¿Qué tareas tiene el contador?',
    ],
  },
  {
    label: 'Reportes',
    icon: '📊',
    color: '#ef4444',
    items: [
      'Resumen de clientes recientes',
      '¿Cuántas consultas tuve este mes?',
      '¿Cuánto he facturado?',
    ],
  },
];

// ── Bullet symbols ──────────────────────────────────────────────────────────

const BULLET: Record<string, { symbol: string; className: string }> = {
  pendiente:   { symbol: '•', className: 'text-slate-800' },
  en_progreso: { symbol: '•', className: 'text-blue-600' },
  completada:  { symbol: '✕', className: 'text-slate-400' },
  migrada:     { symbol: '→', className: 'text-purple-500' },
  evento:      { symbol: '○', className: 'text-teal-600' },
  nota:        { symbol: '—', className: 'text-slate-400' },
};

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(true);
  const [quickInput, setQuickInput] = useState('');
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [attachedFile, setAttachedFile] = useState<{
    name: string; size: number; storagePath: string; textoExtraido?: string | null;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fechaHoy = hoy();
  const fechaFinSemana = finDeSemana();

  // ── Data fetching ───────────────────────────────────────────────────────

  // All tareas for today (any assignee)
  const { data: tareasHoyData, refetch: refetchTareasHoy } = useFetch<{
    data: TareaConCliente[];
    total: number;
  }>(`/api/admin/tareas?fecha_desde=${fechaHoy}&fecha_hasta=${fechaHoy}&limit=50`);

  // All pending/in-progress tareas (for "hoy" section — no date filter, just pending)
  const { data: tareasPendientesData, refetch: refetchPendientes } = useFetch<{
    data: TareaConCliente[];
    total: number;
  }>('/api/admin/tareas?estado=pendiente&limit=30');

  const { data: tareasEnProgresoData, refetch: refetchEnProgreso } = useFetch<{
    data: TareaConCliente[];
    total: number;
  }>('/api/admin/tareas?estado=en_progreso&limit=30');

  // Tareas completed today
  const { data: tareasCompletadasHoyData, refetch: refetchCompletadasHoy } = useFetch<{
    data: TareaConCliente[];
    total: number;
  }>(`/api/admin/tareas?estado=completada&fecha_desde=${fechaHoy}&limit=30`);

  // Tareas assigned to asistente
  const { data: tareasAsistenteData, refetch: refetchAsistente } = useFetch<{
    data: TareaConCliente[];
    total: number;
  }>('/api/admin/tareas?asignado_a=asistente&limit=20');

  // Próximas citas (this week)
  const { data: citasData } = useFetch<{
    data: Cita[];
    total: number;
  }>(`/api/admin/calendario/eventos?fecha_inicio=${fechaHoy}&fecha_fin=${fechaFinSemana}`);

  const { mutate } = useMutate();

  // ── Derived data ────────────────────────────────────────────────────────

  // Tareas for "Hoy" section: tasks due today OR pending with no date
  const allPending = tareasPendientesData?.data ?? [];
  const allEnProgreso = tareasEnProgresoData?.data ?? [];
  const completadasHoy = tareasCompletadasHoyData?.data ?? [];

  const tareasHoy = [...allPending, ...allEnProgreso].filter(
    (t: TareaConCliente) => !t.fecha_limite || t.fecha_limite <= fechaHoy
  );

  // Tasks this week (with future dates, not today)
  const tareasProximamente = [...allPending, ...allEnProgreso].filter(
    (t: TareaConCliente) => t.fecha_limite && t.fecha_limite > fechaHoy && t.fecha_limite <= fechaFinSemana
  );

  // Asistente tareas
  const tareasAsistentePendientes = (tareasAsistenteData?.data ?? []).filter(
    (t: TareaConCliente) => t.estado === 'pendiente' || t.estado === 'en_progreso'
  );
  const tareasAsistenteCompletadas = (tareasAsistenteData?.data ?? []).filter(
    (t: TareaConCliente) => t.estado === 'completada'
  );

  // Próximas citas
  const proximasCitas = (citasData?.data ?? [])
    .filter((c: Cita) => c.estado !== 'cancelada')
    .slice(0, 3);

  // Counters
  const countPendientes = allPending.length;
  const countEnProgreso = allEnProgreso.length;
  const countCompletadasHoy = completadasHoy.length;

  // ── Actions ─────────────────────────────────────────────────────────────

  const refetchAll = useCallback(() => {
    refetchTareasHoy();
    refetchPendientes();
    refetchEnProgreso();
    refetchCompletadasHoy();
    refetchAsistente();
  }, [refetchTareasHoy, refetchPendientes, refetchEnProgreso, refetchCompletadasHoy, refetchAsistente]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const handleCompleteTarea = async (id: string) => {
    setCompletingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      mutate(`/api/admin/tareas/${id}`, {
        method: 'PATCH',
        body: { estado: 'completada' },
        onSuccess: () => {
          setTimeout(() => {
            setCompletingIds((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            refetchAll();
          }, 300);
        },
      });
    }, 200);
  };

  const handleQuickAdd = async () => {
    const text = quickInput.trim();
    if (!text) return;
    setQuickInput('');
    await mutate('/api/admin/tareas', {
      method: 'POST',
      body: {
        titulo: text,
        tipo: text.startsWith('—') ? TipoTarea.NOTA : TipoTarea.TAREA,
        estado: EstadoTarea.PENDIENTE,
        prioridad: 'media',
        asignado_a: 'amanda',
        categoria: 'tramites',
        fecha_limite: fechaHoy,
      },
      onSuccess: () => refetchAll(),
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    const MAX_SIZE = 3 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError(`El archivo excede 3 MB (${(file.size / 1024 / 1024).toFixed(1)} MB). Límite de Graph API para adjuntos inline.`);
      return;
    }

    const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
    const allowed = new Set(['.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png']);
    if (!allowed.has(ext)) {
      setError(`Tipo de archivo no permitido (${ext}). Permitidos: PDF, DOCX, DOC, JPG, PNG.`);
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/ai/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `Error ${res.status}`);
      }

      const data = await res.json();
      setAttachedFile({
        name: data.fileName,
        size: data.fileSize,
        storagePath: data.storagePath,
        textoExtraido: data.textoExtraido,
      });
    } catch (err: any) {
      setError(err.message ?? 'Error al subir archivo');
    } finally {
      setIsUploading(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    const currentAttachment = attachedFile;
    setMessages(newMessages);
    setInput('');
    setAttachedFile(null);
    setIsLoading(true);
    setError(null);

    try {
      const body: any = {
        messages: newMessages.map((m: Message) => ({ role: m.role, content: m.content })),
      };
      if (currentAttachment) {
        body.attachment = currentAttachment;
      }

      const res = await fetch('/api/admin/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `Error ${res.status}`);
      }

      const data = await res.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
        timestamp: new Date(),
      };

      setMessages((prev: Message[]) => [...prev, assistantMessage]);
      refetchAll();
    } catch (err: any) {
      setError(err.message ?? 'Error al comunicarse con el asistente');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex h-[calc(100vh-0px)]">
      {/* ─── Panel lateral Bullet Journal ─────────────────────────────── */}
      {showPanel && (
        <div className="w-[300px] border-r border-slate-200 bg-white flex flex-col shrink-0">
          {/* Counters */}
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3 text-[11px] font-medium">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                <span className="text-slate-600">{countPendientes}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                <span className="text-slate-600">{countEnProgreso}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                <span className="text-slate-600">{countCompletadasHoy}</span>
              </span>
            </div>
            <button
              onClick={() => setShowPanel(false)}
              className="text-slate-300 hover:text-slate-500 transition-colors"
              title="Cerrar panel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">

            {/* ── Sección HOY ────────────────────────────────────────── */}
            <div className="px-4 pt-3 pb-2">
              <p className="text-[11px] font-medium text-teal-600 tracking-wide uppercase">{formatFechaHoy()}</p>
            </div>

            <div className="px-3 space-y-0.5">
              {tareasHoy.length === 0 && proximasCitas.length === 0 && completadasHoy.length === 0 ? (
                <div className="px-2 py-4 text-center">
                  <p className="text-xs text-slate-400">Sin tareas para hoy</p>
                  <p className="text-[10px] text-slate-300 mt-1">Usa el campo de abajo para agregar</p>
                </div>
              ) : (
                <>
                  {/* Active tasks for today */}
                  {tareasHoy.map((t: TareaConCliente) => (
                    <BulletItem
                      key={t.id}
                      tarea={t}
                      isCompleting={completingIds.has(t.id)}
                      onComplete={handleCompleteTarea}
                    />
                  ))}

                  {/* Today's events (citas) */}
                  {proximasCitas
                    .filter((c: Cita) => c.fecha === fechaHoy)
                    .map((c: Cita) => (
                      <div key={c.id} className="flex items-start gap-2 px-2 py-1.5 rounded-md group">
                        <span className="font-mono text-sm leading-5 text-teal-600 w-4 text-center shrink-0">○</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-700 leading-snug">{c.titulo || c.tipo}</p>
                          <p className="text-[10px] text-teal-600">{formatHora12(c.hora_inicio)}</p>
                        </div>
                      </div>
                    ))}

                  {/* Completed today */}
                  {completadasHoy.map((t: TareaConCliente) => (
                    <div key={t.id} className="flex items-start gap-2 px-2 py-1.5 rounded-md opacity-50">
                      <span className="font-mono text-sm leading-5 text-slate-400 w-4 text-center shrink-0">✕</span>
                      <p className="text-xs text-slate-400 line-through leading-snug">{t.titulo}</p>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Quick add input */}
            <div className="px-3 py-2">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm text-slate-300 w-4 text-center shrink-0">•</span>
                <input
                  type="text"
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
                  placeholder="Agregar tarea rápida..."
                  className="flex-1 text-xs bg-transparent border-none outline-none text-slate-600 placeholder:text-slate-300"
                />
              </div>
            </div>

            {/* ── Sección PRÓXIMAMENTE ────────────────────────────────── */}
            {(tareasProximamente.length > 0 || proximasCitas.filter((c: Cita) => c.fecha > fechaHoy).length > 0) && (
              <div className="border-t border-slate-100 mt-1">
                <div className="px-4 pt-3 pb-1.5">
                  <p className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">Próximamente</p>
                </div>
                <div className="px-3 space-y-0.5 pb-2">
                  {tareasProximamente.map((t: TareaConCliente) => (
                    <BulletItem
                      key={t.id}
                      tarea={t}
                      isCompleting={completingIds.has(t.id)}
                      onComplete={handleCompleteTarea}
                      showDate
                    />
                  ))}
                  {proximasCitas
                    .filter((c: Cita) => c.fecha > fechaHoy)
                    .map((c: Cita) => (
                      <div key={c.id} className="flex items-start gap-2 px-2 py-1.5 rounded-md">
                        <span className="font-mono text-sm leading-5 text-teal-600 w-4 text-center shrink-0">○</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-700 leading-snug">{c.titulo || c.tipo}</p>
                          <p className="text-[10px] text-teal-600">
                            {new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric' })} · {formatHora12(c.hora_inicio)}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* ── Sección ASIGNADAS AL ASISTENTE ────────────────────── */}
            <div className="border-t border-slate-100 mt-1">
              <div className="px-4 pt-3 pb-1.5">
                <p className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
                  Asistente IA · {tareasAsistentePendientes.length} pendiente{tareasAsistentePendientes.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="px-3 space-y-0.5 pb-2">
                {tareasAsistentePendientes.length === 0 ? (
                  <div className="px-2 py-3 text-center">
                    <p className="text-[10px] text-slate-300">Sin tareas asignadas</p>
                  </div>
                ) : (
                  tareasAsistentePendientes.map((t: TareaConCliente) => (
                    <BulletItem
                      key={t.id}
                      tarea={t}
                      isCompleting={completingIds.has(t.id)}
                      onComplete={handleCompleteTarea}
                      showCategory
                    />
                  ))
                )}
                {tareasAsistenteCompletadas.length > 0 && (
                  <details className="mt-1">
                    <summary className="text-[10px] text-slate-300 cursor-pointer hover:text-slate-500 px-2 py-1">
                      {tareasAsistenteCompletadas.length} completada{tareasAsistenteCompletadas.length !== 1 ? 's' : ''}
                    </summary>
                    <div className="space-y-0.5 mt-0.5">
                      {tareasAsistenteCompletadas.slice(0, 5).map((t: TareaConCliente) => (
                        <div key={t.id} className="flex items-start gap-2 px-2 py-1 rounded-md opacity-40">
                          <span className="font-mono text-sm leading-5 text-slate-400 w-4 text-center shrink-0">✕</span>
                          <p className="text-xs text-slate-400 line-through leading-snug">{t.titulo}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Chat area ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-3 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {!showPanel && (
              <button
                onClick={() => setShowPanel(true)}
                className="text-slate-400 hover:text-teal-600 mr-1"
                title="Mostrar Bullet Journal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-lg">
              ⚖️
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800">Asistente IA</h1>
              <p className="text-[11px] text-slate-400">IURISLEX — Documentos, consultas, emails y tareas</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="px-3 py-1.5 text-xs text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Limpiar chat
            </button>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {messages.length === 0 ? (
            <div className="mt-4">
              <div className="text-center mb-8">
                <div className="text-5xl mb-4">⚖️</div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Hola Amanda</h2>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Puedo generar documentos Word, redactar emails, calcular honorarios, gestionar tareas y consultar el sistema.
                </p>
              </div>

              <div className="max-w-3xl mx-auto grid grid-cols-2 gap-6">
                {SUGGESTION_CATEGORIES.map((cat: any, ci: number) => (
                  <div key={ci}>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: cat.color }}>
                      <span>{cat.icon}</span> {cat.label}
                    </h3>
                    <div className="space-y-1.5">
                      {cat.items.map((suggestion: string, i: number) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(suggestion)}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-left text-xs text-slate-600 hover:border-teal-400 hover:bg-teal-50/30 transition-colors leading-relaxed"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5 max-w-3xl mx-auto">
              {messages.map((msg: Message) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-3 text-sm leading-relaxed shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-teal-500 to-cyan-500 text-white rounded-2xl rounded-br-sm'
                        : 'bg-white text-slate-800 rounded-2xl rounded-bl-sm'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div
                        className="whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                      />
                    ) : (
                      <span>{msg.content}</span>
                    )}
                    <div className={`text-[10px] mt-1.5 text-right ${msg.role === 'user' ? 'opacity-60' : 'text-slate-400'}`}>
                      {msg.timestamp.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 bg-white rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-2 text-sm text-slate-500">
                    <span className="animate-pulse">⚖️</span>
                    Pensando...
                  </div>
                </div>
              )}

              {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
                  Error: {error}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white shrink-0">
          <div className="max-w-3xl mx-auto">
            {/* Attachment chip preview */}
            {(attachedFile || isUploading) && (
              <div className="mb-2 flex items-center gap-2">
                {isUploading ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-xs">
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Subiendo...
                  </span>
                ) : attachedFile ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-xs">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    {attachedFile.name} ({Math.round(attachedFile.size / 1024)} KB)
                    <button
                      onClick={() => setAttachedFile(null)}
                      className="ml-1 text-teal-500 hover:text-teal-800 transition-colors"
                      title="Quitar adjunto"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ) : null}
              </div>
            )}

            <div className="flex gap-3 items-end">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Paperclip button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isUploading}
                className={`p-3 rounded-xl border-2 transition-all ${
                  isLoading || isUploading
                    ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                    : 'border-slate-200 text-slate-400 hover:border-teal-400 hover:text-teal-500 cursor-pointer'
                }`}
                title="Adjuntar archivo (PDF, DOCX, imagen, max 3 MB)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu consulta... (Enter para enviar, Shift+Enter para nueva línea)"
                disabled={isLoading}
                rows={1}
                className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-xl text-sm outline-none resize-none font-[inherit] leading-relaxed max-h-[200px] transition-colors focus:border-teal-500"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className={`px-5 py-3 text-white rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  input.trim() && !isLoading
                    ? 'bg-gradient-to-br from-teal-500 to-cyan-500 cursor-pointer hover:shadow-md'
                    : 'bg-slate-300 cursor-not-allowed'
                }`}
              >
                {isLoading ? '...' : 'Enviar'}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            IA puede cometer errores. Verifica la información importante.
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BulletItem — A single task in Bullet Journal style
// ═══════════════════════════════════════════════════════════════════════════

function BulletItem({
  tarea,
  isCompleting,
  onComplete,
  showDate = false,
  showCategory = false,
}: {
  tarea: TareaConCliente;
  isCompleting: boolean;
  onComplete: (id: string) => void;
  showDate?: boolean;
  showCategory?: boolean;
}) {
  const isOverdue = tarea.fecha_limite && tarea.fecha_limite < hoy();
  const isInProgress = tarea.estado === 'en_progreso';
  const isScheduled = !!(tarea as any).accion_automatica && !(tarea as any).ejecutada;
  const bullet = isScheduled
    ? { symbol: '⏰', className: 'text-amber-500' }
    : isInProgress
      ? BULLET.en_progreso
      : BULLET[tarea.estado] ?? BULLET.pendiente;

  const prioColor = tarea.prioridad === 'alta'
    ? 'bg-red-50'
    : tarea.prioridad === 'baja'
      ? 'bg-green-50/50'
      : '';

  return (
    <div
      className={`flex items-start gap-2 px-2 py-1.5 rounded-md group transition-all duration-300 ${
        isCompleting ? 'opacity-30 line-through' : ''
      } ${isOverdue && !isScheduled ? 'bg-red-50/60' : isScheduled ? 'bg-amber-50/40' : prioColor} hover:bg-slate-50`}
    >
      <button
        onClick={() => onComplete(tarea.id)}
        className={`font-mono text-sm leading-5 w-4 text-center shrink-0 transition-colors cursor-pointer ${
          bullet.className
        } hover:text-teal-600`}
        title={isScheduled ? 'Programada — click para completar' : 'Completar'}
      >
        {bullet.symbol}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-xs leading-snug ${
          isScheduled ? 'text-amber-800' : isInProgress ? 'text-blue-700 font-medium' : 'text-slate-700'
        } ${isOverdue && !isScheduled ? 'text-red-700' : ''}`}>
          {tarea.titulo}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {isScheduled && tarea.fecha_limite && (
            <span className="text-[9px] text-amber-600 font-medium">
              {new Date(tarea.fecha_limite + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric' })}
            </span>
          )}
          {showCategory && (
            <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded-full ${
              CATEGORIA_TAREA_COLOR[tarea.categoria as CategoriaTarea] ?? 'bg-gray-100 text-gray-600'
            }`}>
              {CATEGORIA_TAREA_LABEL[tarea.categoria as CategoriaTarea] ?? tarea.categoria}
            </span>
          )}
          {isInProgress && !isScheduled && (
            <span className="text-[9px] text-blue-500 font-medium">en progreso</span>
          )}
          {tarea.cliente && (
            <span className="text-[9px] text-slate-400">{tarea.cliente.nombre}</span>
          )}
          {showDate && !isScheduled && tarea.fecha_limite && (
            <span className={`text-[9px] ${isOverdue ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
              {new Date(tarea.fecha_limite + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          )}
          {!showDate && !isScheduled && isOverdue && (
            <span className="text-[9px] text-red-500 font-medium">vencida</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Markdown formatter
// ═══════════════════════════════════════════════════════════════════════════

function formatMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, '<strong style="font-size:15px;display:block;margin:12px 0 4px">$1</strong>')
    .replace(/^## (.+)$/gm, '<strong style="font-size:16px;display:block;margin:14px 0 6px">$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#0d9488;text-decoration:underline;font-weight:600">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:#f3f4f6;padding:12px;border-radius:8px;overflow-x:auto;font-size:13px;margin:8px 0"><code>$2</code></pre>')
    .replace(/`(.+?)`/g, '<code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px">$1</code>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0">')
    .replace(/(?<!href=")(https:\/\/[^\s<"]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:#0d9488;text-decoration:underline">Descargar documento</a>')
    .replace(/\n/g, '<br>');
}
