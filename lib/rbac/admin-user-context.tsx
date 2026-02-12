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

// ── Provider ────────────────────────────────────────────────────────────────

export function AdminUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  // Fetch current user once on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchMe() {
      try {
        const res = await fetch('/api/admin/me');
        if (res.status === 403) {
          router.replace('/admin/acceso-denegado');
          return;
        }
        if (!res.ok) throw new Error('Error fetching user');
        const data = await res.json();
        if (!cancelled) setUser(data);
      } catch {
        if (!cancelled) router.replace('/admin/acceso-denegado');
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
