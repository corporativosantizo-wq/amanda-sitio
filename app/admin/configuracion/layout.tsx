'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/admin/configuracion/usuarios', label: 'Usuarios' },
  { href: '/admin/configuracion/mensajes-telegram', label: 'Mensajes Telegram' },
];

export default function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="space-y-4">
      <nav className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map(t => {
          const active = pathname?.startsWith(t.href) ?? false;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-px ${
                active
                  ? 'border-[#0891B2] text-[#0891B2]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
