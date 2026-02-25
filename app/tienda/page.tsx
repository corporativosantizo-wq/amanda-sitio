import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

// Componente del cliente para los filtros
import TiendaClient from './TiendaClient'

export default async function TiendaPage() {
  const supabase = await createClient()
  
  // Obtener solo productos digitales activos (servicios se muestran en /servicios)
  const { data: productos, error } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(name, slug)
    `)
    .eq('status', 'active')
    .eq('type', 'digital')
    .order('is_featured', { ascending: false })
  
  // Obtener categorías de productos
  const { data: categorias } = await supabase
    .from('categories')
    .select('*')
    .eq('type', 'product')
    .order('name')

  if (error) {
    console.error('Error fetching products:', error)
  }

  return (
    <TiendaClient 
      productos={productos || []} 
      categorias={categorias || []} 
    />
  )
}
