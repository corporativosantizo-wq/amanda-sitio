// ============================================================================
// lib/rbac/permissions.ts
// Tipos y funciones puras de permisos — importable desde client y server
// ============================================================================

// ── Types ───────────────────────────────────────────────────────────────────

export type Rol = 'admin' | 'abogado' | 'asistente' | 'contador' | 'pasante';

export type Modulo =
  | 'clientes'
  | 'expedientes'
  | 'mercantil'
  | 'laboral'
  | 'proveedores'
  | 'calendario'
  | 'tareas'
  | 'documentos'
  | 'clasificador'
  | 'plantillas'
  | 'notariado'
  | 'jurisprudencia'
  | 'contabilidad'
  | 'cotizaciones'
  | 'facturas'
  | 'pagos'
  | 'gastos'
  | 'reportes'
  | 'posts'
  | 'productos'
  | 'mensajes'
  | 'configuracion';

export interface AdminUser {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  modulos_permitidos: Modulo[];
  activo: boolean;
}

// ── Route mapping ───────────────────────────────────────────────────────────

export const MODULE_ROUTE_MAP: Record<Modulo, string> = {
  clientes: '/admin/clientes',
  expedientes: '/admin/expedientes',
  mercantil: '/admin/mercantil',
  laboral: '/admin/laboral',
  proveedores: '/admin/proveedores',
  calendario: '/admin/calendario',
  tareas: '/admin/tareas',
  documentos: '/admin/documentos',
  clasificador: '/admin/clasificador',
  plantillas: '/admin/plantillas',
  notariado: '/admin/notariado',
  jurisprudencia: '/admin/jurisprudencia',
  contabilidad: '/admin/contabilidad',
  cotizaciones: '/admin/contabilidad/cotizaciones',
  facturas: '/admin/contabilidad/facturas',
  pagos: '/admin/contabilidad/pagos',
  gastos: '/admin/contabilidad/gastos',
  reportes: '/admin/contabilidad/reportes',
  posts: '/admin/posts',
  productos: '/admin/productos',
  mensajes: '/admin/mensajes',
  configuracion: '/admin/configuracion',
};

export const ALWAYS_VISIBLE_ROUTES = ['/admin', '/admin/ai'];

// Sub-modules of contabilidad — maps sub-module name to its sub-route segment
export const CONTABILIDAD_SUBMODULES: Record<string, string> = {
  cotizaciones: 'cotizaciones',
  facturas: 'facturas',
  pagos: 'pagos',
  gastos: 'gastos',
  reportes: 'reportes',
};

/**
 * Checks if a user has access to a top-level module, considering
 * that contabilidad sub-modules grant access to the parent menu.
 */
export function hasModuleAccess(modulo: Modulo, rol: Rol, modulos: Modulo[]): boolean {
  if (rol === 'admin') return true;
  if (modulos.includes(modulo)) return true;

  // contabilidad parent is visible if user has ANY contabilidad sub-module
  if (modulo === 'contabilidad') {
    return Object.keys(CONTABILIDAD_SUBMODULES).some(
      (sub) => modulos.includes(sub as Modulo)
    );
  }

  return false;
}

// ── Pure permission functions ───────────────────────────────────────────────

export function canCreate(rol: Rol, modulo: Modulo): boolean {
  if (rol === 'admin') return true;
  if (rol === 'pasante') return false;
  if (rol === 'contador') return modulo === 'contabilidad';
  // abogado & asistente: delegated to module check (caller checks modulos_permitidos)
  return true;
}

export function canEdit(rol: Rol, modulo: Modulo): boolean {
  if (rol === 'admin') return true;
  if (rol === 'pasante') return false;
  if (rol === 'contador') return modulo === 'contabilidad';
  // abogado & asistente: delegated to module check
  return true;
}

export function canDelete(rol: Rol, modulo: Modulo): boolean {
  if (rol === 'admin') return true;
  if (rol === 'pasante') return false;
  if (rol === 'contador') return false;
  if (rol === 'asistente') return modulo !== 'clientes' && modulo !== 'documentos';
  // abogado: delegated to module check
  return true;
}

/**
 * Extracts the module key from a pathname.
 * e.g. '/admin/contabilidad/facturas' → 'contabilidad'
 */
export function extractModuleFromPath(pathname: string): Modulo | null {
  // Skip always-visible routes
  if (ALWAYS_VISIBLE_ROUTES.includes(pathname)) return null;

  // Match /admin/{segment}
  const match = pathname.match(/^\/admin\/([^/]+)/);
  if (!match) return null;

  const segment = match[1];

  // Find matching module
  for (const [modulo, route] of Object.entries(MODULE_ROUTE_MAP)) {
    const routeSegment = route.replace('/admin/', '');
    if (segment === routeSegment) return modulo as Modulo;
  }

  return null;
}

/**
 * Checks if a user with given rol and modules can access a route.
 * Admins can access everything. Others need the module in their list.
 */
export function hasAccessToRoute(
  pathname: string,
  rol: Rol,
  modulos: Modulo[]
): boolean {
  if (rol === 'admin') return true;
  if (ALWAYS_VISIBLE_ROUTES.includes(pathname)) return true;

  // /admin/acceso-denegado is always accessible
  if (pathname === '/admin/acceso-denegado') return true;

  // Handle contabilidad sub-routes with granular access
  if (pathname.startsWith('/admin/contabilidad')) {
    // Full contabilidad module → access everything under it
    if (modulos.includes('contabilidad')) return true;

    // Check specific sub-module (e.g. /admin/contabilidad/cotizaciones)
    const subSegment = pathname.replace('/admin/contabilidad/', '').split('/')[0];
    if (subSegment && CONTABILIDAD_SUBMODULES[subSegment]) {
      return modulos.includes(subSegment as Modulo);
    }

    // /admin/contabilidad main page → accessible if user has any sub-module
    if (pathname === '/admin/contabilidad') {
      return Object.keys(CONTABILIDAD_SUBMODULES).some(
        (sub) => modulos.includes(sub as Modulo)
      );
    }

    return false;
  }

  const modulo = extractModuleFromPath(pathname);
  if (!modulo) return true; // Unknown route — allow (safe default for sub-pages)

  return modulos.includes(modulo);
}
