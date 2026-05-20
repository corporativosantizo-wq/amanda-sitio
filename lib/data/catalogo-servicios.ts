// ============================================================================
// lib/data/catalogo-servicios.ts
// Tipos y helpers del catálogo de servicios. Los datos REALES se leen desde
// legal.catalogo_servicios vía /api/admin/catalogo-servicios — este archivo
// solo expone la forma de los datos, la lista de categorías conocidas y los
// colores asociados.
// ============================================================================

export interface ServicioCatalogo {
  codigo: string;
  categoria: string;
  nombre: string;
  descripcion: string;
  precioBase: number;
  unidad: string;
  activo: boolean;
}

/**
 * Categorías conocidas en orden alfabético. La BD puede tener categorías que
 * no estén acá (se renderizan con color fallback), pero estas 14 son las
 * canónicas que también usamos como pills de filtro por defecto.
 */
export const CATEGORIAS = [
  'Administrativo',
  'Constitucional',
  'Consultoría',
  'Contratos',
  'Internacional',
  'Litigio Civil',
  'Litigio Familia',
  'Litigio Laboral',
  'Litigio Mercantil',
  'Litigio Penal',
  'Marcario',
  'Notarial',
  'Otros',
  'Registral',
] as const;

export type CategoriaServicio = (typeof CATEGORIAS)[number];

const FALLBACK_COLOR = 'bg-slate-50 text-slate-700 border-slate-200';

export const CATEGORIA_COLORES: Record<string, string> = {
  'Administrativo':    'bg-orange-50 text-orange-700 border-orange-200',
  'Constitucional':    'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Consultoría':       'bg-violet-50 text-violet-700 border-violet-200',
  'Contratos':         'bg-blue-50 text-blue-700 border-blue-200',
  'Internacional':     'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Litigio Civil':     'bg-rose-50 text-rose-700 border-rose-200',
  'Litigio Familia':   'bg-pink-50 text-pink-700 border-pink-200',
  'Litigio Laboral':   'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Litigio Mercantil': 'bg-teal-50 text-teal-700 border-teal-200',
  'Litigio Penal':     'bg-red-50 text-red-700 border-red-200',
  'Marcario':          'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Notarial':          'bg-amber-50 text-amber-700 border-amber-200',
  'Otros':             'bg-slate-50 text-slate-700 border-slate-200',
  'Registral':         'bg-lime-50 text-lime-700 border-lime-200',
};

export function colorCategoria(cat: string): string {
  return CATEGORIA_COLORES[cat] ?? FALLBACK_COLOR;
}

/**
 * Filtra una lista de servicios por texto libre y categoría opcional.
 * El primer argumento es el catálogo cargado desde /api/admin/catalogo-servicios.
 */
export function buscarServicios(
  catalogo: ServicioCatalogo[],
  query: string,
  categoria?: string,
): ServicioCatalogo[] {
  let lista = catalogo.filter(s => s.activo);
  if (categoria) lista = lista.filter(s => s.categoria === categoria);
  if (query) {
    const q = query.toLowerCase();
    lista = lista.filter(s =>
      s.nombre.toLowerCase().includes(q) ||
      (s.descripcion || '').toLowerCase().includes(q) ||
      s.codigo.toLowerCase().includes(q)
    );
  }
  return lista;
}
