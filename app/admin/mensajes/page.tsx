import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import MessageActions from './MessageActions'

export default async function AdminMensajes() {
  const supabase = await createClient()

  const { data: messages, error } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Nuevo</span>
      case 'read':
        return <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">Leído</span>
      case 'replied':
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">Respondido</span>
      default:
        return null
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">Mensajes</h1>
          <p className="text-slate mt-1">Mensajes recibidos desde el formulario de contacto</p>
        </div>
      </div>

      {/* Messages list */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {messages && messages.length > 0 ? (
          <div className="divide-y divide-slate-light">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`p-6 hover:bg-slate-lighter transition-colors ${
                  message.status === 'new' ? 'bg-green-50/50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="w-12 h-12 bg-azure rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                      {message.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-navy">{message.name}</h3>
                        {getStatusBadge(message.status)}
                      </div>
                      <p className="text-azure text-sm mb-1">{message.email}</p>
                      {message.phone && (
                        <p className="text-slate text-sm mb-2">Tel: {message.phone}</p>
                      )}
                      <div className="bg-slate-lighter rounded-lg p-4 mt-3">
                        <p className="text-sm font-semibold text-navy mb-1">{message.subject}</p>
                        <p className="text-slate text-sm whitespace-pre-wrap">{message.message}</p>
                      </div>
                      <p className="text-xs text-slate mt-3">{formatDate(message.created_at)}</p>
                    </div>
                  </div>
                  <MessageActions message={message} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-slate">
            <svg className="w-16 h-16 mx-auto mb-4 text-slate-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="font-display text-xl font-bold text-navy mb-2">No hay mensajes</h3>
            <p>Cuando alguien envíe un mensaje desde el formulario de contacto, aparecerá aquí.</p>
          </div>
        )}
      </div>
    </div>
  )
}