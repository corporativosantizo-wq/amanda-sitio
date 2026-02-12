'use client';

// ============================================================================
// lib/rbac/admin-user-context.tsx
// React context para el usuario admin — provee datos + helpers de permisos
// ============================================================================

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  type AdminUser,
  type Rol,
  type Modulo,
  canCreate as _canCreate,
  canEdit as _canEdit,
  canDelete as _canDelete,
  hasAccessToRoute,
} from './permissions';

// ── Context type ────────────────────────────────────────────────────────────

interface AdminUserContextType {
  user: AdminUser | null;
  loading: boolean;
  canCreate: (modulo: Modulo) => boolean;
  canEdit: (modulo: Modulo) => boolean;
  canDelete: (modulo: Modulo) => boolean;
  hasModule: (modulo: Modulo) => boolean;
  isAdmin: boolean;
}

const AdminUserContext = createContext<AdminUserContextType>({
  user: null,
  loading: true,
  canCreate: () => false,
  canEdit: () => false,
  canDelete: () => false,
  hasModule: () => false,
  isAdmin: false,
});

export const useAdminUser = () => useContext(AdminUserContext);

// ── Fallback: admin por defecto si la tabla no es accesible (RLS, etc.) ────

const FALLBACK_ADMIN: AdminUser = {
  id: 'fallback',
  email: '',
  nombre: 'Admin',
  rol: 'admin',
  modulos_permitidos: [],
  activo: true,
};

// ── Provider ────────────────────────────────────────────────────────────────

export function AdminUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  // Fetch current user once on mount
  // Fallback: if the API fails (RLS issues, table not accessible, etc.)
  // assume admin role so existing users aren't locked out of production.
  useEffect(() => {
    let cancelled = false;
    async function fetchMe() {
      try {
        const res = await fetch('/api/admin/me');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setUser(data);
          return;
        }
        // 403 with "desactivado" → genuinely deactivated, block access
        if (res.status === 403) {
          const body = await res.json().catch(() => ({}));
          if (body.error?.includes('desactivado')) {
            router.replace('/admin/acceso-denegado');
            return;
          }
        }
        // Any other error (user not found, RLS issues, etc.) → fallback admin
        if (!cancelled) setUser(FALLBACK_ADMIN);
      } catch {
        // Network error → fallback admin so the panel stays usable
        if (!cancelled) setUser(FALLBACK_ADMIN);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchMe();
    return () => { cancelled = true; };
  }, [router]);

  // Route protection: check on every pathname change
  useEffect(() => {
    if (loading || !user) return;
    if (!hasAccessToRoute(pathname, user.rol, user.modulos_permitidos)) {
      alert('No tienes acceso a esta sección.');
      router.replace('/admin');
    }
  }, [pathname, user, loading, router]);

  // Permission helpers bound to current user
  const canCreate = useCallback(
    (modulo: Modulo) => {
      if (!user) return false;
      if (user.rol === 'admin') return true;
      if (!user.modulos_permitidos.includes(modulo)) return false;
      return _canCreate(user.rol, modulo);
    },
    [user]
  );

  const canEdit = useCallback(
    (modulo: Modulo) => {
      if (!user) return false;
      if (user.rol === 'admin') return true;
      if (!user.modulos_permitidos.includes(modulo)) return false;
      return _canEdit(user.rol, modulo);
    },
    [user]
  );

  const canDelete = useCallback(
    (modulo: Modulo) => {
      if (!user) return false;
      if (user.rol === 'admin') return true;
      if (!user.modulos_permitidos.includes(modulo)) return false;
      return _canDelete(user.rol, modulo);
    },
    [user]
  );

  const hasModule = useCallback(
    (modulo: Modulo) => {
      if (!user) return false;
      if (user.rol === 'admin') return true;
      return user.modulos_permitidos.includes(modulo);
    },
    [user]
  );

  const isAdmin = user?.rol === 'admin';

  return (
    <AdminUserContext.Provider
      value={{ user, loading, canCreate, canEdit, canDelete, hasModule, isAdmin }}
    >
      {children}
    </AdminUserContext.Provider>
  );
}
