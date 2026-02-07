// ============================================================================
// app/admin/ai/page.tsx
// Asistente IA — interfaz de chat
// ============================================================================
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  '📋 Hazme una cotización para una constitución de S.A.',
  '📧 Redacta un email de seguimiento para un cliente',
  '💰 ¿Cuántas facturas pendientes tengo?',
  '📊 Dame un resumen de clientes recientes',
  '⚖️ ¿Cuánto cobro por un juicio ejecutivo con IVA?',
  '📝 Redacta un contrato de confidencialidad básico',
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
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
          messages: newMessages.map(m => ({
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

      setMessages(prev => [...prev, assistantMessage]);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #0d9488, #0891b2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
          }}>
            🤖
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: 0 }}>
              Asistente IA
            </h1>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
              IURISLEX — Tu asistente legal inteligente
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              color: '#6b7280',
              background: '#f3f4f6',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            🗑️ Limpiar chat
          </button>
        )}
      </div>

      {/* Messages area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        background: '#f9fafb',
      }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚖️</div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
              Hola Amanda 👋
            </h2>
            <p style={{ fontSize: '15px', color: '#6b7280', marginBottom: '32px', maxWidth: '500px', margin: '0 auto 32px' }}>
              Soy tu asistente legal IA. Puedo generar cotizaciones, redactar emails, 
              consultar datos del sistema y ayudarte con tus casos.
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '12px',
              maxWidth: '700px',
              margin: '0 auto',
            }}>
              {SUGGESTIONS.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(suggestion.replace(/^[^\s]+ /, ''))}
                  style={{
                    padding: '14px 16px',
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '14px',
                    color: '#374151',
                    transition: 'all 0.15s',
                    lineHeight: '1.4',
                  }}
                  onMouseEnter={e => {
                    (e.target as HTMLElement).style.borderColor = '#0d9488';
                    (e.target as HTMLElement).style.background = '#f0fdfa';
                  }}
                  onMouseLeave={e => {
                    (e.target as HTMLElement).style.borderColor = '#e5e7eb';
                    (e.target as HTMLElement).style.background = 'white';
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{
                  maxWidth: '80%',
                  padding: '14px 18px',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: msg.role === 'user' ? 'linear-gradient(135deg, #0d9488, #0891b2)' : 'white',
                  color: msg.role === 'user' ? 'white' : '#111827',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  fontSize: '14px',
                  lineHeight: '1.6',
                }}>
                  {msg.role === 'assistant' ? (
                    <div 
                      style={{ whiteSpace: 'pre-wrap' }}
                      dangerouslySetInnerHTML={{ 
                        __html: formatMarkdown(msg.content) 
                      }} 
                    />
                  ) : (
                    <span>{msg.content}</span>
                  )}
                  <div style={{
                    fontSize: '11px',
                    opacity: 0.6,
                    marginTop: '6px',
                    textAlign: 'right',
                  }}>
                    {msg.timestamp.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '14px 18px',
                  borderRadius: '18px 18px 18px 4px',
                  background: 'white',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  color: '#6b7280',
                }}>
                  <span style={{ animation: 'pulse 1.5s infinite' }}>⚖️</span>
                  Pensando...
                </div>
              </div>
            )}

            {error && (
              <div style={{
                padding: '12px 16px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '12px',
                color: '#991b1b',
                fontSize: '14px',
              }}>
                ❌ {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{
        padding: '16px 24px',
        borderTop: '1px solid #e5e7eb',
        background: 'white',
      }}>
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-end',
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu consulta... (Enter para enviar, Shift+Enter para nueva línea)"
            disabled={isLoading}
            rows={1}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '2px solid #e5e7eb',
              borderRadius: '14px',
              fontSize: '14px',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: '1.5',
              maxHeight: '200px',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.target as HTMLElement).style.borderColor = '#0d9488'}
            onBlur={e => (e.target as HTMLElement).style.borderColor = '#e5e7eb'}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            style={{
              padding: '12px 20px',
              background: input.trim() && !isLoading ? 'linear-gradient(135deg, #0d9488, #0891b2)' : '#d1d5db',
              color: 'white',
              border: 'none',
              borderRadius: '14px',
              cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
              fontSize: '16px',
              fontWeight: '600',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {isLoading ? '⏳' : '➤'}
          </button>
        </div>
        <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px', textAlign: 'center' }}>
          IA puede cometer errores. Verifica la información importante.
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Formateador básico de markdown
// ============================================================================
function formatMarkdown(text: string): string {
  return text
    // Headers
    .replace(/^### (.+)$/gm, '<strong style="font-size:15px;display:block;margin:12px 0 4px">$1</strong>')
    .replace(/^## (.+)$/gm, '<strong style="font-size:16px;display:block;margin:14px 0 6px">$1</strong>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:#f3f4f6;padding:12px;border-radius:8px;overflow-x:auto;font-size:13px;margin:8px 0"><code>$2</code></pre>')
    // Inline code
    .replace(/`(.+?)`/g, '<code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px">$1</code>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0">')
    // Line breaks
    .replace(/\n/g, '<br>');
}
