// ============================================================================
// app/portal/chat/page.tsx
// Asistente del portal de clientes
// ============================================================================
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePortal } from '../layout';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

function formatMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, '<strong style="font-size:15px;display:block;margin:12px 0 4px">$1</strong>')
    .replace(/^## (.+)$/gm, '<strong style="font-size:16px;display:block;margin:14px 0 6px">$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:#f3f4f6;padding:12px;border-radius:8px;overflow-x:auto;font-size:13px;margin:8px 0"><code>$2</code></pre>')
    .replace(/`(.+?)`/g, '<code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px">$1</code>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0">')
    .replace(/\n/g, '<br>');
}

export default function PortalChat() {
  const { accessToken } = usePortal();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Cargar historial
  useEffect(() => {
    if (!accessToken || historyLoaded) return;
    fetch('/api/portal/chat', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r: any) => r.json())
      .then((d: any) => {
        if (d.messages) setMessages(d.messages);
      })
      .catch(() => {})
      .finally(() => setHistoryLoaded(true));
  }, [accessToken, historyLoaded]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading || !accessToken) return;

    const sanitized = content.trim().replace(/[<>]/g, '').slice(0, 2000);
    const tempMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: sanitized,
      created_at: new Date().toISOString(),
    };

    setMessages((prev: Message[]) => [...prev, tempMsg]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/portal/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ message: sanitized }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Error al comunicarse con el asistente.');
        return;
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev: Message[]) => [...prev, assistantMsg]);
    } catch {
      setError('Error de conexión. Intente de nuevo.');
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

  const SUGGESTIONS = [
    '¿Cuál es el estado de mi trámite?',
    '¿Qué documentos necesito para una escritura?',
    '¿Cuál es el costo de una consulta?',
    '¿Cómo puedo agendar una cita con la Licda. Santizo?',
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 64px)',
        maxWidth: '800px',
        margin: '0 auto',
      }}
    >
      {/* Chat header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb',
          background: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0d9488, #0891b2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '18px',
          }}
        >
          <svg
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <div>
          <div
            style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}
          >
            Astrid Bolaños — Asistente del Bufete
          </div>
          <div style={{ fontSize: '12px', color: '#16a34a' }}>
            En línea
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          background: '#f9fafb',
        }}
      >
        {messages.length === 0 && historyLoaded ? (
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>
              <svg
                width="48"
                height="48"
                fill="none"
                stroke="#d1d5db"
                viewBox="0 0 24 24"
                style={{ margin: '0 auto', display: 'block' }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h2
              style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#111827',
                margin: '0 0 8px',
              }}
            >
              Astrid Bolaños
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: '#6b7280',
                maxWidth: '460px',
                margin: '0 auto 24px',
                lineHeight: '1.6',
              }}
            >
              Buen día, soy Astrid. Estoy aquí para ayudarle con información
              sobre sus trámites, seguimientos, costos y consultas generales.
              Para atención jurídica personalizada, solicite una cita con la
              Licda. Amanda Santizo.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '10px',
                maxWidth: '500px',
                margin: '0 auto',
              }}
            >
              {SUGGESTIONS.map((s: string, i: number) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  style={{
                    padding: '12px 14px',
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '13px',
                    color: '#374151',
                    lineHeight: '1.4',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e: any) =>
                    (e.target.style.borderColor = '#0d9488')
                  }
                  onMouseLeave={(e: any) =>
                    (e.target.style.borderColor = '#e5e7eb')
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {messages.map((msg: Message) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent:
                    msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '12px 16px',
                    borderRadius:
                      msg.role === 'user'
                        ? '16px 16px 4px 16px'
                        : '16px 16px 16px 4px',
                    background:
                      msg.role === 'user'
                        ? 'linear-gradient(135deg, #0d9488, #0891b2)'
                        : 'white',
                    color: msg.role === 'user' ? 'white' : '#111827',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    fontSize: '14px',
                    lineHeight: '1.6',
                  }}
                >
                  {msg.role === 'assistant' ? (
                    <div
                      style={{ whiteSpace: 'pre-wrap' }}
                      dangerouslySetInnerHTML={{
                        __html: formatMarkdown(msg.content),
                      }}
                    />
                  ) : (
                    <span>{msg.content}</span>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '16px 16px 16px 4px',
                    background: 'white',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    color: '#6b7280',
                  }}
                >
                  <span style={{ animation: 'pulse 1.5s infinite' }}>
                    &bull;&bull;&bull;
                  </span>
                  Astrid está escribiendo...
                </div>
              </div>
            )}

            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  color: '#991b1b',
                  fontSize: '13px',
                }}
              >
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div
        style={{
          padding: '14px 20px',
          borderTop: '1px solid #e5e7eb',
          background: 'white',
        }}
      >
        <div
          style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e: any) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escriba su consulta aquí..."
            disabled={isLoading}
            rows={1}
            style={{
              flex: 1,
              padding: '10px 14px',
              border: '2px solid #e5e7eb',
              borderRadius: '12px',
              fontSize: '14px',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: '1.5',
              maxHeight: '160px',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e: any) =>
              (e.target.style.borderColor = '#0d9488')
            }
            onBlur={(e: any) =>
              (e.target.style.borderColor = '#e5e7eb')
            }
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            style={{
              padding: '10px 18px',
              background:
                input.trim() && !isLoading
                  ? 'linear-gradient(135deg, #0d9488, #0891b2)'
                  : '#d1d5db',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor:
                input.trim() && !isLoading ? 'pointer' : 'not-allowed',
              fontSize: '16px',
              fontWeight: '600',
              transition: 'all 0.15s',
            }}
          >
            &#10148;
          </button>
        </div>
        <p
          style={{
            fontSize: '11px',
            color: '#9ca3af',
            marginTop: '6px',
            textAlign: 'center',
          }}
        >
          Horario de atención: lunes a viernes, 7:00 AM a 3:00 PM
        </p>
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}
