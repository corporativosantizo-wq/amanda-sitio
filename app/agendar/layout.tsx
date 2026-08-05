// La página de agendamiento es client component ('use client'), que no admite
// export const metadata — de ahí este layout.
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Agendar cita | Amanda Santizo, Abogada — Guatemala',
  description:
    'Agende en línea una consulta legal nueva o el seguimiento de su trámite, virtual o en oficina, con una abogada en Guatemala.',
  alternates: { canonical: '/agendar' },
}

export default function AgendarLayout({ children }: { children: React.ReactNode }) {
  return children
}
