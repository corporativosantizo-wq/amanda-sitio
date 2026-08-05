// La página de contacto es client component ('use client'), que no admite
// export const metadata — de ahí este layout.
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contacto | Amanda Santizo, Abogada — Guatemala',
  description:
    'Despacho en Edificio Géminis 10, zona 10, Ciudad de Guatemala. Respuesta en máximo 24 horas hábiles.',
}

export default function ContactoLayout({ children }: { children: React.ReactNode }) {
  return children
}
