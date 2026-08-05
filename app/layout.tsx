import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import LayoutWrapper from '@/components/LayoutWrapper'
import { Providers } from './providers'
import { Analytics } from "@vercel/analytics/react"
import { SITE_URL } from '@/lib/site'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '700'],
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Amanda Santizo — Abogada y Notaria | Derecho Civil y Empresarial, Guatemala',
  description:
    'Despacho jurídico boutique en Guatemala. Derecho civil y empresarial con enfoque transfronterizo: contratos, empresas y patrimonio que cruzan fronteras.',
  // Verificación de propiedad en Google Search Console. Va aquí y no en la
  // portada: el metadata se fusiona campo por campo, y como ninguna página
  // declara `verification`, esta etiqueta llega a todas, portada incluida.
  verification: {
    google: 'spM97SB-QJux03jZfoXyLImyQMhQCxwCZ3J8mwEKKuQ',
  },
  // Open Graph del sitio. `title` y `description` NO se declaran aquí a
  // propósito: Next los resuelve con los de cada página, así que al compartir
  // /servicios sale su propio título. `url` tampoco: en el layout raíz haría
  // que todas las páginas anunciaran la portada — los rastreadores usan el
  // canonical, que sí es correcto por página.
  // Los artículos del blog declaran su propio openGraph y su opengraph-image,
  // que prevalecen sobre esto.
  openGraph: {
    type: 'website',
    locale: 'es_GT',
    siteName: 'Amanda Santizo — Despacho Jurídico',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Amanda Santizo — Despacho Jurídico Boutique',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        <Providers>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}