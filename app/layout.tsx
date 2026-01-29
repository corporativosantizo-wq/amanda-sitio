import type { Metadata } from 'next'
import { Inter, Outfit } from 'next/font/google'
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const outfit = Outfit({ 
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
  weight: ['400', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Amanda Santizo | Derecho Internacional',
  description: 'Derecho claro para decisiones inteligentes',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${inter.variable} ${outfit.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
