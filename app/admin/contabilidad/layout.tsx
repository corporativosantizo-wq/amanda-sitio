'use client'

import { useState, useRef, useEffect } from 'react'
import { adminFetch } from '@/lib/utils/admin-fetch'

// ── Chat Panel: Asistente Contable ──────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

function ContableChatPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const userMsg: ChatMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await adminFetch('/api/admin/contabilidad/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error del servidor' }))
        setMessages([...newMessages, { role: 'assistant', content: err.error || 'Error al procesar la consulta.' }])
        return
      }

      const data = await res.json()
      setMessages([...newMessages, { role: 'assistant', content: data.content }])
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Error de conexión. Intenta de nuevo.' }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="fixed bottom-24 right-6 w-[420px] h-[560px] bg-white rounded-2xl shadow-2xl border flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-teal-600 rounded-t-2xl">
        <div>
          <h3 className="text-sm font-bold text-white">Asistente Contable</h3>
          <p className="text-[10px] text-teal-100">Daniel Herrera AI</p>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white text-lg">{'\u00D7'}</button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-8">
            <p className="text-2xl mb-2">{'\uD83D\uDCB0'}</p>
            <p>Asistente contable del despacho.</p>
            <p className="text-xs mt-1">Consulta pagos, cobros, cotizaciones<br/>o solicita facturas a RE Contadores.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-teal-600 text-white rounded-br-sm'
                : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-500 px-3 py-2 rounded-xl text-sm rounded-bl-sm">
              Pensando...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu consulta..."
            rows={1}
            className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:border-teal-500 resize-none max-h-20 overflow-y-auto"
            style={{ minHeight: '36px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {'\u2191'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Layout ──────────────────────────────────────────────────────────────────

export default function ContabilidadLayout({ children }: { children: React.ReactNode }) {
  const [showChat, setShowChat] = useState(false)

  return (
    <>
      {children}

      {/* Floating Chat Button — visible on all /admin/contabilidad/* pages */}
      <button
        onClick={() => setShowChat(!showChat)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-teal-600 text-white rounded-full shadow-lg hover:bg-teal-700 transition flex items-center justify-center text-2xl z-40"
        title="Asistente Contable"
      >
        {showChat ? '\u00D7' : '\uD83D\uDCB0'}
      </button>

      {/* Chat Panel */}
      {showChat && (
        <ContableChatPanel onClose={() => setShowChat(false)} />
      )}
    </>
  )
}
