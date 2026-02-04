import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    redirect('/admin/login')
  }

  const { count: postsCount } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })

  const { count: productsCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })

  const { count: messagesCount } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })

  const { count: messagesNew } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'new')

  const { data: recentMessages } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  const stats = [
    { name: 'Artículos', total: postsCount || 0, icon: '📝', href: '/admin/posts' },
    { name: 'Productos', total: productsCount || 0, icon: '📦', href: '/admin/productos' },
    { name: 'Mensajes', total: messagesCount || 0, subtitle: `${messagesNew || 0} nuevos`, icon: '✉️', href: '/admin/mensajes' },
  ]

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-navy">Dashboard</h1>
        <p className="text-slate mt-1">Bienvenida de vuelta, Amanda</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.name}
            href={stat.href}
            className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all"
          >
            <div className="text-4xl mb-4">{stat.icon}</div>
            <div className="text-3xl font-bold text-navy">{stat.total}</div>
            <div className="text-slate">{stat.name}</div>
            {stat.subtitle && <div className="text-sm text-cyan mt-1">{stat.subtitle}</div>}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold text-navy">Acciones rápidas</h2>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/admin/posts/nuevo" className="px-5 py-3 bg-azure text-white font-semibold rounded-lg hover:bg-navy transition-colors">
              + Nuevo artículo
            </Link>
            <Link href="/admin/productos/nuevo" className="px-5 py-3 bg-cyan text-navy-dark font-semibold rounded-lg hover:opacity-80 transition-colors">
              + Nuevo producto
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold text-navy">Mensajes recientes</h2>
            <Link href="/admin/mensajes" className="text-azure hover:text-cyan text-sm font-semibold">
              Ver todos →
            </Link>
          </div>
          {recentMessages && recentMessages.length > 0 ? (
            <div className="space-y-3">
              {recentMessages.map((msg) => (
                <div key={msg.id} className="p-3 bg-slate-lighter rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-navy">{msg.name}</span>
                    {msg.status === 'new' && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Nuevo</span>
                    )}
                  </div>
                  <p className="text-sm text-slate truncate">{msg.message}</p>
                  <p className="text-xs text-slate mt-1">{formatDate(msg.created_at)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate text-center py-4">No hay mensajes aún</p>
          )}
        </div>
      </div>
    </div>
  )
}