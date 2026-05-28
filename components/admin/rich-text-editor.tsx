'use client'

// ============================================================================
// components/admin/rich-text-editor.tsx
// Editor rico (WYSIWYG) basado en Tiptap. Salida en HTML.
// SSR-safe (immediatelyRender:false). Estilos prose para vista WYSIWYG.
// ============================================================================

import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Heading from '@tiptap/extension-heading'
import Blockquote from '@tiptap/extension-blockquote'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Image as ImageIcon,
  Minus,
} from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`p-2 rounded-md transition-colors ${
        active ? 'bg-cyan/20 text-navy' : 'text-slate hover:bg-slate-lighter'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="w-px h-6 bg-slate-light mx-1" />
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        // En Tiptap v3 StarterKit incluye link/underline: los desactivamos
        // para registrar nuestras propias extensiones (no-op en v2).
        link: false,
        underline: false,
      } as any),
      Heading.configure({ levels: [2, 3] }),
      Blockquote,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Image.configure({ HTMLAttributes: { class: 'rounded-lg mx-auto' } }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Escribe el contenido del artículo…',
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none min-h-[320px] focus:outline-none px-4 py-3',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  // Sincroniza contenido externo (ej. carga async al editar) sin emitir update.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor])

  const setLink = () => {
    if (!editor) return
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL del enlace:', prev || 'https://')
    if (url === null) return
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  const addImage = () => {
    if (!editor) return
    const url = window.prompt('URL de la imagen:')
    if (url && url.trim()) {
      editor.chain().focus().setImage({ src: url.trim() }).run()
    }
  }

  return (
    <div className="border border-slate-light rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-cyan bg-white">
      {editor && (
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-light bg-slate-lighter">
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrita">
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Cursiva">
            <Italic className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Subrayado">
            <UnderlineIcon className="w-4 h-4" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Encabezado H2">
            <Heading2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Encabezado H3">
            <Heading3 className="w-4 h-4" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista con viñetas">
            <List className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada">
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Cita">
            <Quote className="w-4 h-4" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton onClick={setLink} active={editor.isActive('link')} title="Enlace">
            <Link2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={addImage} title="Insertar imagen">
            <ImageIcon className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Separador">
            <Minus className="w-4 h-4" />
          </ToolbarButton>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  )
}
