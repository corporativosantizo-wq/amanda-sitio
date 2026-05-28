'use client'

// ============================================================================
// components/admin/TagInput.tsx
// Campo de etiquetas tipo "chips": escribir + Enter agrega, X quita,
// autocompletado con etiquetas existentes.
// ============================================================================

import { useState, useRef } from 'react'

export default function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = 'Escribe una etiqueta y presiona Enter…',
}: {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  placeholder?: string
}) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addTag = (raw: string) => {
    const name = raw.trim()
    if (!name) return
    const exists = value.some((t) => t.toLowerCase() === name.toLowerCase())
    if (!exists) onChange([...value, name])
    setInput('')
    setOpen(false)
  }

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && input === '' && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  const filtered = suggestions
    .filter((s) => !value.some((t) => t.toLowerCase() === s.toLowerCase()))
    .filter((s) => input.trim() === '' || s.toLowerCase().includes(input.trim().toLowerCase()))
    .slice(0, 8)

  return (
    <div className="relative">
      <div
        className="flex flex-wrap items-center gap-2 w-full px-3 py-2 border border-slate-light rounded-lg focus-within:ring-2 focus-within:ring-cyan"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan/15 text-navy text-sm font-medium rounded-full"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                removeTag(tag)
              }}
              className="text-slate hover:text-red-600"
              aria-label={`Quitar ${tag}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[140px] py-1 outline-none bg-transparent text-navy"
        />
      </div>

      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-slate-light rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  addTag(s)
                }}
                className="w-full text-left px-3 py-2 text-sm text-navy hover:bg-slate-lighter"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
