'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Message {
  id: string
  name: string
  email: string
  phone?: string
  subject: string
  message: string
  status: string
  created_at: string
}

export default function MessageActions({ message }: { message: Message }) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const router = useRouter()

  const updateStatus = async (newStatus: string) => {
    setIsUpdating(true)
    const supabase = createClient()
    
    await supabase
      .from('contacts')
      .update({ status: newStatus })
      .eq('id', message.id)
    
    setIsUpdating(false)
    setShowMenu(false)
    router.refresh()
  }

  const deleteMessage = async () => {
    if (!confirm('¿Estás segura de que quieres eliminar este mensaje?')) return
    
    setIsUpdating(true)
    const supabase = createClient()
    
    await supabase
      .from('contacts')
      .delete()
      .eq('id', message.id)
    
    setIsUpdating(false)
    router.refresh()
  }

  return (
    <div className="relative">
      <div className="flex items-center space-x-2">
        {/* Reply by email */}
        <a
          href={`mailto:${message.email}?subject=Re: ${message.subject}`}
          className="p-2 text-slate hover:text-azure hover:bg-slate-lighter rounded-lg transition-colors"
          title="Responder por email"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </a>

        {/* Reply by WhatsApp */}
        {message.phone && (
          <a
            href={`https://wa.me/${message.phone.replace(/\D/g, '')}?text=Hola ${message.name}, gracias por contactarnos.`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-slate hover:text-green-500 hover:bg-slate-lighter rounded-lg transition-colors"
            title="Responder por WhatsApp"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </a>
        )}

        {/* More options */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-2 text-slate hover:text-navy hover:bg-slate-lighter rounded-lg transition-colors"
          disabled={isUpdating}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>

      {/* Dropdown menu */}
      {showMenu && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-light z-10">
          <div className="py-1">
            {message.status !== 'read' && (
              <button
                onClick={() => updateStatus('read')}
                className="w-full px-4 py-2 text-left text-sm text-slate hover:bg-slate-lighter hover:text-navy transition-colors"
              >
                Marcar como leído
              </button>
            )}
            {message.status !== 'replied' && (
              <button
                onClick={() => updateStatus('replied')}
                className="w-full px-4 py-2 text-left text-sm text-slate hover:bg-slate-lighter hover:text-navy transition-colors"
              >
                Marcar como respondido
              </button>
            )}
            {message.status !== 'new' && (
              <button
                onClick={() => updateStatus('new')}
                className="w-full px-4 py-2 text-left text-sm text-slate hover:bg-slate-lighter hover:text-navy transition-colors"
              >
                Marcar como nuevo
              </button>
            )}
            <hr className="my-1 border-slate-light" />
            <button
              onClick={deleteMessage}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              Eliminar mensaje
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
