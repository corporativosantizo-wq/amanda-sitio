// ============================================================================
// app/admin/ai/page.tsx
// Asistente IA — interfaz de chat con panel de tareas del asistente
// ============================================================================
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import type { TareaConCliente } from '@/lib/types';
import {
  CATEGORIA_TAREA_LABEL,
  CATEGORIA_TAREA_COLOR,
  CategoriaTarea,
} from '@/lib/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTION_CATEGORIES = [
  {
    label: 'Documentos',
    icon: '\uD83D\uDCC4',
    color: '#0d9488',
    items: [
      'Genera un contrato de arrendamiento',
      'Genera un contrato laboral',
      'Genera un acta de asamblea (AGOT)',
      'Genera un acta notarial de certificaci\u00f3n',
      'Genera un recurso de amparo',
      'Genera una demanda de rendici\u00f3n de cuentas',
    ],
  },
  {
    label: 'Emails',
    icon: '\uD83D\uDCE7',
    color: '#6366f1',
    items: [
      'Redacta un email de seguimiento para un cliente',
      'Redacta un email de cobranza profesional',
      'Redacta un email de env\u00edo de documentos',
    ],
  },
  {
    label: 'Consultas',
    icon: '\uD83D\uDCCA',
    color: '#f59e0b',
    items: [
      '\u00bfCu\u00e1ntas facturas pendientes tengo?',
      'Dame un resumen de clientes recientes',
      'Hazme una cotizaci\u00f3n para una constituci\u00f3n de S.A.',
      '\u00bfCu\u00e1nto cobro por un juicio ejecutivo con IVA?',
    ],
  },
  {
    label: 'Tareas',
    icon: '\u2611\uFE0F',
    color: '#8b5cf6',
    items: [
      '\u00bfQu\u00e9 tengo pendiente hoy?',
      'Anota que debes cobrarle a Flor Q500',
      '\u00bfQu\u00e9 tareas tiene pendientes el contador?',
      'Migra las tareas vencidas a ma\u00f1ana',
    ],
  },
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch tareas assigned to asistente
  const { data: tareasData, refetch: refetchTareas } = useFetch<{
    data: TareaConCliente[];
    total: number;
  }>('/api/admin/tareas?asignado_a=asistente&limit=20');

  const tareasPendientes = (tareasData?.data ?? []).filter(
    (t: TareaConCliente) => t.estado === 'pendiente' || t.estado === 'en_progreso'
  );
  const tareasCompletadas = (tareasData?.data ?? []).filter(
    (t: TareaConCliente) => t.estado === 'completada'
  );

  const { mutate } = useMutate();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m: Message) => ({
            role: m.role,
            content: m.content,
          })),
        }),
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
      // Refresh tareas after AI response (it may have created/completed tasks)
      refetchTareas();
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

  const handleCompleteTarea = async (id: string) => {
    await mutate(`/api/admin/tareas/${id}`, {
      method: 'PATCH',
      body: { estado: 'completada' },
      onSuccess: () => refetchTareas(),
    });
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div className="flex h-[calc(100vh-0px)]">
      {/* Tareas Panel */}
      {showPanel && (
        <div className="w-72 border-r border-slate-200 bg-white flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Tareas del Asistente</h2>
              <p className="text-[11px] text-slate-400">{tareasPendientes.length} pendientes</p>
            </div>
            <button
              onClick={() => setShowPanel(false)}
              className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              title="Cerrar panel"
            >
              {'\u00D7'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Pending tasks */}
            {tareasPendientes.length > 0 ? (
              <div className="p-3 space-y-2">
                {tareasPendientes.map((t: TareaConCliente) => (
                  <TareaItem key={t.id} tarea={t} onComplete={handleCompleteTarea} />
                ))}
              </div>
            ) : (
              <div className="p-4 text-center">
                <p className="text-2xl mb-2">{'\uD83E\uDD16'}</p>
                <p className="text-xs text-slate-400">Sin tareas pendientes</p>
                <p className="text-[11px] text-slate-300 mt-1">Escribe &quot;anota que debes...&quot; en el chat</p>
              </div>
            )}

            {/* Completed tasks (collapsed) */}
            {tareasCompletadas.length > 0 && (
              <div className="border-t border-slate-100">
                <details>
                  <summary className="px-4 py-2 text-[11px] font-medium text-slate-400 cursor-pointer hover:text-slate-600">
                    {tareasCompletadas.length} completada(s)
                  </summary>
                  <div className="px-3 pb-3 space-y-1.5">
                    {tareasCompletadas.slice(0, 5).map((t: TareaConCliente) => (
                      <div key={t.id} className="px-2 py-1.5 rounded bg-slate-50 opacity-60">
                        <p className="text-[11px] text-slate-400 line-through">{t.titulo}</p>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-3 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {!showPanel && (
              <button
                onClick={() => setShowPanel(true)}
                className="text-slate-400 hover:text-teal-600 mr-1"
                title="Mostrar tareas"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-lg">
              {'\u2696\uFE0F'}
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
                <div className="text-5xl mb-4">{'\u2696\uFE0F'}</div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Hola Amanda</h2>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Puedo generar documentos Word, redactar emails, calcular honorarios, gestionar tareas y consultar el sistema.
                </p>
              </div>

              <div className="max-w-3xl mx-auto">
                {SUGGESTION_CATEGORIES.map((cat: any, ci: number) => (
                  <div key={ci} className="mb-6">
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: cat.color }}>
                      {cat.icon} {cat.label}
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {cat.items.map((suggestion: string, i: number) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(suggestion)}
                          className="p-3 bg-white border border-slate-200 rounded-xl text-left text-xs text-slate-600 hover:border-teal-400 hover:bg-teal-50/30 transition-colors leading-relaxed"
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
                    <span className="animate-pulse">{'\u2696\uFE0F'}</span>
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
          <div className="flex gap-3 items-end max-w-3xl mx-auto">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu consulta... (Enter para enviar, Shift+Enter para nueva l\u00ednea)"
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
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            IA puede cometer errores. Verifica la informaci\u00f3n importante.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Tarea Item for sidebar panel ────────────────────────────────────────────

function TareaItem({
  tarea,
  onComplete,
}: {
  tarea: TareaConCliente;
  onComplete: (id: string) => void;
}) {
  const catColor = CATEGORIA_TAREA_COLOR[tarea.categoria as CategoriaTarea] ?? 'bg-gray-100 text-gray-600';
  const catLabel = CATEGORIA_TAREA_LABEL[tarea.categoria as CategoriaTarea] ?? tarea.categoria;
  const isOverdue = tarea.fecha_limite && tarea.fecha_limite < new Date().toISOString().split('T')[0];
  const isInProgress = tarea.estado === 'en_progreso';

  return (
    <div className={`p-2.5 rounded-lg border transition-colors ${
      isInProgress ? 'border-blue-200 bg-blue-50/50' : 'border-slate-100 bg-white hover:border-slate-200'
    }`}>
      <div className="flex items-start gap-2">
        <button
          onClick={() => onComplete(tarea.id)}
          className="mt-0.5 w-4 h-4 rounded border-2 border-slate-300 hover:border-teal-500 hover:bg-teal-50 transition-colors shrink-0"
          title="Completar"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-700 leading-snug">{tarea.titulo}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded-full ${catColor}`}>
              {catLabel}
            </span>
            {isInProgress && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded-full bg-blue-100 text-blue-700">
                En progreso
              </span>
            )}
            {tarea.cliente && (
              <span className="text-[9px] text-slate-400">{tarea.cliente.nombre}</span>
            )}
            {tarea.fecha_limite && (
              <span className={`text-[9px] ${isOverdue ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                {new Date(tarea.fecha_limite + 'T12:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Markdown formatter ──────────────────────────────────────────────────────

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
