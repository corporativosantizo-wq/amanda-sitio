// ============================================================================
// app/admin/ai/page.tsx
// Asistente IA — Bullet Journal + Chat con shortcuts organizados
// ============================================================================
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { adminFetch } from '@/lib/utils/admin-fetch';
import { sanitizeHtml } from '@/lib/utils/sanitize-html';
import { SESSION_EXPIRED_MSG } from '@/lib/utils/auth-redirect';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ── Suggestion categories ───────────────────────────────────────────────────

const SUGGESTION_CATEGORIES = [
  {
    label: 'Documentos Notariales',
    icon: '📜',
    color: '#0d9488',
    items: [
      'Redacta acta de asamblea para [cliente]',
      'Redacta acta de nombramiento para [cliente]',
      'Redacta poder general/especial para [cliente]',
      'Redacta declaración jurada',
    ],
  },
  {
    label: 'Memoriales y Escritos',
    icon: '⚖️',
    color: '#6366f1',
    items: [
      'Redacta memorial para expediente [número]',
      'Redacta recurso de apelación para [expediente]',
      'Redacta amparo para [expediente]',
      'Redacta contestación de demanda para [expediente]',
    ],
  },
  {
    label: 'Contratos',
    icon: '📋',
    color: '#8b5cf6',
    items: [
      'Redacta contrato de arrendamiento',
      'Redacta contrato de prestación de servicios',
      'Redacta contrato de trabajo',
      'Redacta NDA / confidencialidad',
    ],
  },
  {
    label: 'Briefing de Caso',
    icon: '📊',
    color: '#f59e0b',
    items: [
      'Prepárame el caso de [cliente]',
      'Resume el expediente [número]',
      '¿Cuáles son los plazos pendientes de [cliente]?',
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export default function AIAssistantPage() {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{
    name: string; size: number; storagePath: string; textoExtraido?: string | null;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Actions ─────────────────────────────────────────────────────────────

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

    // Keep Clerk session alive while uploading
    await getToken().catch(() => {});
    const uploadKeepAlive = setInterval(() => { getToken().catch(() => {}); }, 30_000);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await adminFetch('/api/admin/ai/upload', { method: 'POST', body: formData });

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
      clearInterval(uploadKeepAlive);
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

    // Refresh Clerk token before fetch + keep-alive every 30s while waiting
    await getToken().catch(() => {});
    const sessionKeepAlive = setInterval(() => { getToken().catch(() => {}); }, 30_000);

    try {
      // Limit conversation history: keep last 20 messages to avoid huge payloads
      const recentMessages = newMessages.slice(-20);
      const body: any = {
        messages: recentMessages.map((m: Message) => ({ role: m.role, content: m.content })),
      };
      if (currentAttachment) {
        body.attachment = currentAttachment;
      }

      const res = await adminFetch('/api/admin/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let errMsg = `Error ${res.status}`;
        try {
          const err = await res.json();
          errMsg = err.error ?? errMsg;
        } catch {
          if (res.status === 504) errMsg = 'El asistente tardó demasiado. Intenta con una pregunta más corta.';
          else if (res.status === 401 || res.status === 403) errMsg = SESSION_EXPIRED_MSG;
        }
        throw new Error(errMsg);
      }

      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error('La respuesta del servidor se cortó. Intenta de nuevo.');
      }
      if (!data?.content) {
        throw new Error('El asistente no generó respuesta. Intenta de nuevo.');
      }
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
        timestamp: new Date(),
      };

      setMessages((prev: Message[]) => [...prev, assistantMessage]);
    } catch (err: any) {
      setError(err.message ?? 'Error al comunicarse con el asistente');
    } finally {
      clearInterval(sessionKeepAlive);
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

  // Exporta el texto redactado a un documento Word (.docx) y lo descarga.
  const exportarDocx = async (content: string, id: string) => {
    setExportingId(id);
    try {
      await getToken().catch(() => {});
      const res = await adminFetch('/api/admin/ai/export-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, filename: 'documento-legal' }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'No se pudo exportar el documento');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `documento-legal-${new Date().toISOString().slice(0, 10)}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message ?? 'Error al exportar a DOCX');
    } finally {
      setExportingId(null);
    }
  };

  const copiar = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      setError('No se pudo copiar al portapapeles');
    }
  };

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex h-[calc(100vh-0px)]">
      {/* ─── Chat area ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-3 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-lg">
              ✍️
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800">Redactor Legal</h1>
              <p className="text-[11px] text-slate-400">Asistente de redacción de documentos legales</p>
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
                <div className="text-5xl mb-4">✍️</div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Redactor Legal</h2>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Redacto documentos legales conforme a la legislación guatemalteca: actas, poderes, memoriales,
                  recursos, amparos y contratos. También preparo briefings de caso con todo el contexto del cliente.
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
              {messages.map((msg: Message, msgIdx: number) => {
                const isLastAssistant = msg.role === 'assistant' && msgIdx === messages.map(m => m.role).lastIndexOf('assistant');
                const draft = msg.role === 'assistant' ? parseDraftEmail(msg.content) : null;
                const showDraftCard = draft && isLastAssistant;

                return (
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
                        showDraftCard ? (
                          <>
                            {draft.before && (
                              <div
                                className="whitespace-pre-wrap mb-2"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(formatMarkdown(draft.before)) }}
                              />
                            )}
                            <DraftEmailCard
                              de={draft.de}
                              para={draft.para}
                              cc={draft.cc}
                              asunto={draft.asunto}
                              cuerpo={draft.cuerpo}
                              isLoading={isLoading}
                              onSend={() => sendMessage('Apruebo el envío')}
                              onSendEdited={(asunto, cuerpo) =>
                                sendMessage(`Envía con estos cambios:\nAsunto: ${asunto}\nCuerpo:\n${cuerpo}`)
                              }
                              onCancel={() => sendMessage('No envíes este correo')}
                            />
                          </>
                        ) : (
                          <div
                            className="whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(formatMarkdown(msg.content)) }}
                          />
                        )
                      ) : (
                        <span>{msg.content}</span>
                      )}

                      {/* Acciones de documento (solo respuestas del redactor, no borradores de email) */}
                      {msg.role === 'assistant' && !showDraftCard && msg.content.trim().length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-slate-100">
                          <button
                            onClick={() => exportarDocx(msg.content, msg.id)}
                            disabled={exportingId === msg.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 disabled:opacity-50 transition-colors"
                          >
                            {exportingId === msg.id ? 'Exportando…' : '📄 Exportar a DOCX'}
                          </button>
                          <button
                            onClick={() => copiar(msg.content, msg.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            {copiedId === msg.id ? '✓ Copiado' : '📋 Copiar'}
                          </button>
                        </div>
                      )}

                      <div className={`text-[10px] mt-1.5 text-right ${msg.role === 'user' ? 'opacity-60' : 'text-slate-400'}`}>
                        {msg.timestamp.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}

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
// DraftEmailCard — editable email draft card
// ═══════════════════════════════════════════════════════════════════════════

function DraftEmailCard({
  de, para, cc, asunto, cuerpo, onSend, onSendEdited, onCancel, isLoading,
}: {
  de: string; para: string; cc?: string; asunto: string; cuerpo: string;
  onSend: () => void; onSendEdited: (asunto: string, cuerpo: string) => void;
  onCancel: () => void; isLoading: boolean;
}) {
  const [editedAsunto, setEditedAsunto] = useState(asunto);
  const [editedCuerpo, setEditedCuerpo] = useState(cuerpo);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasEdits = editedAsunto !== asunto || editedCuerpo !== cuerpo;

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
  }, [editedCuerpo]);

  return (
    <div className="border-l-[3px] border-blue-500 bg-slate-50 rounded-r-lg p-4 my-2">
      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">Borrador de email</p>

      <div className="space-y-2 text-sm">
        <div className="flex gap-2">
          <span className="font-semibold text-slate-500 shrink-0 w-12">De:</span>
          <span className="text-slate-700">{de}</span>
        </div>
        <div className="flex gap-2">
          <span className="font-semibold text-slate-500 shrink-0 w-12">Para:</span>
          <span className="text-slate-700">{para}</span>
        </div>
        {cc && (
          <div className="flex gap-2">
            <span className="font-semibold text-slate-500 shrink-0 w-12">CC:</span>
            <span className="text-slate-500 text-xs">{cc}</span>
          </div>
        )}
        <div className="flex gap-2 items-center">
          <span className="font-semibold text-slate-500 shrink-0 w-12">Asunto:</span>
          <input
            type="text"
            value={editedAsunto}
            onChange={(e) => setEditedAsunto(e.target.value)}
            className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
            disabled={isLoading}
          />
        </div>
        <div>
          <span className="font-semibold text-slate-500 text-sm">Cuerpo:</span>
          <textarea
            ref={textareaRef}
            value={editedCuerpo}
            onChange={(e) => setEditedCuerpo(e.target.value)}
            className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 resize-none leading-relaxed"
            rows={3}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        {hasEdits ? (
          <button
            onClick={() => onSendEdited(editedAsunto, editedCuerpo)}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Enviar editado
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            Enviar
          </button>
        )}
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="px-3 py-1.5 text-xs font-medium bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Draft email detection
// ═══════════════════════════════════════════════════════════════════════════

function parseDraftEmail(content: string): {
  before: string; de: string; para: string; cc: string; asunto: string; cuerpo: string; after: string;
} | null {
  // Resilient regex: \n\s*\n? between fields handles Claude adding blank lines
  // ¿? handles Claude sometimes omitting the inverted question mark
  const pattern = /(?:📧\s*)?\*\*Borrador de email\*\*\s*\n\s*\n?\*\*De:\*\*\s*(.+)\n\s*\n?\*\*Para:\*\*\s*(.+)\n\s*\n?(?:\*\*CC:\*\*\s*(.+)\n\s*\n?)?(?:\*\*BCC:\*\*\s*(?:.+)\n\s*\n?)?\*\*Asunto:\*\*\s*(.+)\n\s*\n?\*\*Cuerpo:\*\*\s*\n([\s\S]*?)\n\s*¿?Apruebas el envío\?/;
  const match = content.match(pattern);
  if (!match) return null;

  const fullMatch = match[0];
  const idx = content.indexOf(fullMatch);
  const before = content.slice(0, idx).trim();
  const after = content.slice(idx + fullMatch.length).trim();

  return {
    before,
    de: match[1].trim(),
    para: match[2].trim(),
    cc: match[3]?.trim() ?? '',
    asunto: match[4].trim(),
    cuerpo: match[5].trim(),
    after,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Markdown formatter
// ═══════════════════════════════════════════════════════════════════════════

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatMarkdown(text: string): string {
  // 1. Escapar HTML para prevenir XSS
  const safe = escapeHtml(text);
  // 2. Aplicar formato markdown sobre el texto seguro
  return safe
    .replace(/^### (.+)$/gm, '<strong style="font-size:15px;display:block;margin:12px 0 4px">$1</strong>')
    .replace(/^## (.+)$/gm, '<strong style="font-size:16px;display:block;margin:14px 0 6px">$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#0d9488;text-decoration:underline;font-weight:600">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:#f3f4f6;padding:12px;border-radius:8px;overflow-x:auto;font-size:13px;margin:8px 0"><code>$2</code></pre>')
    .replace(/`(.+?)`/g, '<code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px">$1</code>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0">')
    .replace(/(?<!href=&quot;)(https:\/\/[^\s&lt;&quot;]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:#0d9488;text-decoration:underline">Descargar documento</a>')
    .replace(/\n/g, '<br>');
}
