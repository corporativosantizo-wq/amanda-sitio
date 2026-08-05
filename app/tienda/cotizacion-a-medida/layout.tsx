// La página de cotización a medida es client component ('use client'), que no
// admite export const metadata — de ahí este layout.
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cotización a medida | Amanda Santizo, Abogada — Guatemala',
  description:
    'Solicite un documento legal redactado para su caso. Respuesta en un máximo de 24 horas hábiles.',
  alternates: { canonical: '/tienda/cotizacion-a-medida' },
}

export default function CotizacionAMedidaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
