'use client'

import { usePathname } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')

  if (isAdmin) {
    return <>{children}</>
  }

  return (
    <>
      <Header />
      {/* Debe igualar la altura de la barra fija: sello de 60 px + py-4. */}
      <div className="pt-24">
        {children}
      </div>
      <Footer />
    </>
  )
}