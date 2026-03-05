'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const navigation = [
    { name: 'Inicio', href: '/' },
    { name: 'Blog', href: '/blog' },
    { name: 'Tienda', href: '/tienda' },
    { name: 'Servicios', href: '/servicios' },
    { name: 'Sobre mí', href: '/sobremi' },
    { name: 'Contacto', href: '/contacto' },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-navy/95 backdrop-blur-sm border-b border-navy-light">
      <nav className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-12 h-12 bg-gradient-to-br from-azure to-cyan rounded-lg flex items-center justify-center 
                          transform group-hover:scale-110 transition-transform duration-300">
              <span className="text-white font-display font-bold text-xl">AS</span>
            </div>
            <div className="hidden md:block">
              <div className="font-display font-bold text-white text-lg group-hover:text-cyan transition-colors">
                Amanda Santizo
              </div>
              <div className="text-cyan text-xs font-medium">Derecho Internacional</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-slate-light hover:text-cyan transition-colors duration-200 font-medium
                         relative group"
              >
                {item.name}
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-cyan group-hover:w-full transition-all duration-300"></span>
              </Link>
            ))}
            <Link href="/agendar" className="px-6 py-2.5 bg-azure text-white font-semibold rounded-lg
                             hover:bg-cyan hover:shadow-lg hover:shadow-cyan/50
                             transition-all duration-300 transform hover:scale-105">
              Agenda consulta
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden text-white p-2 hover:bg-navy-light rounded-lg transition-colors"
            aria-label="Menú"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="lg:hidden mt-4 pb-4 space-y-3 animate-fadeIn">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="block text-slate-light hover:text-cyan hover:bg-navy-light 
                         transition-all duration-200 py-3 px-4 rounded-lg font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <Link href="/agendar" className="block w-full mt-4 px-6 py-3 bg-azure text-white font-semibold rounded-lg
                             hover:bg-cyan transition-all duration-300 text-center"
                  onClick={() => setIsMenuOpen(false)}>
              Agenda consulta
            </Link>
          </div>
        )}
      </nav>
    </header>
  )
}