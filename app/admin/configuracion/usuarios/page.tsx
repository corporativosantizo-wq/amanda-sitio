'use client';

import { useState } from 'react';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { PageHeader, Badge } from '@/components/admin/ui';
import { useAdminUser } from '@/lib/rbac/admin-user-context';
import type { Rol, Modulo } from '@/lib/rbac/permissions';

// ── Types ───────────────────────────────────────────────────────────────────

interface UsuarioAdmin {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  modulos_permitidos: Modulo[];
  activo: boolean;
  created_at: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const ROLES: { value: Rol; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'abogado', label: 'Abogado/a' },
  { value: 'asistente', label: 'Asistente' },
  { value: 'contador', label: 'Contador/a' },
  { value: 'pasante', label: 'Pasante' },
];

const MODULOS: { value: Modulo; label: string }[] = [
  { value: 'clientes', label: 'Clientes' },
  { value: 'proveedores', label: 'Proveedores' },
  { value: 'calendario', label: 'Calendario' },
  { value: 'tareas', label: 'Tareas' },
  { value: 'documentos', label: 'Documentos' },
  { value: 'clasificador', label: 'Clasificador' },
  { value: 'plantillas', label: 'Plantillas' },
  { value: 'notariado', label: 'Notariado' },
  { value: 'jurisprudencia', label: 'Jurisprudencia' },
  { value: 'contabilidad', label: 'Contabilidad' },
  { value: 'posts', label: 'Posts' },
  { value: 'productos', label: 'Productos' },
  { value: 'mensajes', label: 'Mensajes' },
  { value: 'configuracion', label: 'Configuracion' },
];

const ROL_BADGE: Record<Rol, 'info' | 'success' | 'warning' | 'default' | 'danger'> = {
  admin: 'danger',
  abogado: 'info',
  asistente: 'success',
  contador: 'warning',
  pasante: 'default',
};

// ── Page ────────────────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const { isAdmin } = useAdminUser();
  const { data: usuarios, loading, refetch } = useFetch<UsuarioAdmin[]>('/api/admin/usuarios');
  const { mutate, loading: mutating } = useMutate();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState<UsuarioAdmin | null>(null);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-slate-500">No tienes acceso a esta seccion.</p>
        </div>
      </div>
    );
  }

  const handleDeactivate = async (user: UsuarioAdmin) => {
    const action = user.activo ? 'desactivar' : 'activar';
    if (!confirm(`¿${action.charAt(0).toUpperCase() + action.slice(1)} a ${user.nombre}?`)) return;
    await mutate(`/api/admin/usuarios/${user.id}`, {
      method: 'PATCH',
      body: { activo: !user.activo },
      onSuccess: () => refetch(),
      onError: (err) => alert(err),
    });
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Usuarios"
        description="Gestiona el equipo y sus permisos"
        action={{ label: 'Agregar usuario', icon: '+', onClick: () => setShowAddModal(true) }}
      />

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Rol</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Modulos</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Creado</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Cargando...
                  </td>
                </tr>
              ) : !usuarios?.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No hay usuarios registrados
                  </td>
                </tr>
              ) : (
                usuarios.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-900">{u.nombre}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={ROL_BADGE[u.rol]}>{u.rol}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.rol === 'admin' ? (
                          <Badge variant="info">Todos</Badge>
                        ) : (
                          u.modulos_permitidos?.map((m) => (
                            <Badge key={m} variant="default">{m}</Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.activo ? 'success' : 'danger'}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(u.created_at).toLocaleDateString('es-GT')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditUser(u)}
                          className="text-xs px-2.5 py-1.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeactivate(u)}
                          disabled={mutating}
                          className={`text-xs px-2.5 py-1.5 rounded-md transition-colors ${
                            u.activo
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          }`}
                        >
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); refetch(); }}
        />
      )}

      {/* Edit Modal */}
      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSuccess={() => { setEditUser(null); refetch(); }}
        />
      )}
    </div>
  );
}

// ── Add User Modal ──────────────────────────────────────────────────────────

function AddUserModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { mutate, loading } = useMutate();
  const [form, setForm] = useState({
    email: '',
    nombre: '',
    password: '',
    rol: 'asistente' as Rol,
    modulos_permitidos: [] as Modulo[],
  });

  const toggleModulo = (m: Modulo) => {
    setForm((f) => ({
      ...f,
      modulos_permitidos: f.modulos_permitidos.includes(m)
        ? f.modulos_permitidos.filter((x) => x !== m)
        : [...f.modulos_permitidos, m],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await mutate('/api/admin/usuarios', {
      method: 'POST',
      body: form,
      onSuccess: () => {
        alert('Usuario creado correctamente');
        onSuccess();
      },
      onError: (err) => alert(err),
    });
  };

  return (
    <ModalOverlay onClose={onClose}>
      <h2 className="text-lg font-bold text-slate-900 mb-4">Agregar Usuario</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email">
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="input-field"
          />
        </Field>
        <Field label="Nombre">
          <input
            type="text"
            required
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            className="input-field"
          />
        </Field>
        <Field label="Contraseña">
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="input-field"
          />
        </Field>
        <Field label="Rol">
          <select
            value={form.rol}
            onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value as Rol }))}
            className="input-field"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </Field>
        {form.rol !== 'admin' && (
          <Field label="Modulos permitidos">
            <div className="flex flex-wrap gap-2">
              {MODULOS.map((m) => (
                <label
                  key={m.value}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                    form.modulos_permitidos.includes(m.value)
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={form.modulos_permitidos.includes(m.value)}
                    onChange={() => toggleModulo(m.value)}
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </Field>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Creando...' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}

// ── Edit User Modal ─────────────────────────────────────────────────────────

function EditUserModal({
  user,
  onClose,
  onSuccess,
}: {
  user: UsuarioAdmin;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { mutate, loading } = useMutate();
  const [form, setForm] = useState({
    rol: user.rol,
    modulos_permitidos: user.modulos_permitidos ?? [],
    activo: user.activo,
  });

  const toggleModulo = (m: Modulo) => {
    setForm((f) => ({
      ...f,
      modulos_permitidos: f.modulos_permitidos.includes(m)
        ? f.modulos_permitidos.filter((x) => x !== m)
        : [...f.modulos_permitidos, m],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await mutate(`/api/admin/usuarios/${user.id}`, {
      method: 'PATCH',
      body: form,
      onSuccess: () => {
        alert('Usuario actualizado');
        onSuccess();
      },
      onError: (err) => alert(err),
    });
  };

  return (
    <ModalOverlay onClose={onClose}>
      <h2 className="text-lg font-bold text-slate-900 mb-1">Editar Usuario</h2>
      <p className="text-sm text-slate-500 mb-4">{user.nombre} ({user.email})</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Rol">
          <select
            value={form.rol}
            onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value as Rol }))}
            className="input-field"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </Field>
        {form.rol !== 'admin' && (
          <Field label="Modulos permitidos">
            <div className="flex flex-wrap gap-2">
              {MODULOS.map((m) => (
                <label
                  key={m.value}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                    form.modulos_permitidos.includes(m.value)
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={form.modulos_permitidos.includes(m.value)}
                    onChange={() => toggleModulo(m.value)}
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </Field>
        )}
        <Field label="Estado">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.activo}
              onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">Activo</span>
          </label>
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}

// ── Shared UI ───────────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}

      <style jsx global>{`
        .input-field {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          color: #1e293b;
          background: white;
          transition: border-color 0.15s;
        }
        .input-field:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: linear-gradient(to right, #1E40AF, #0891B2);
          color: white;
          font-size: 0.875rem;
          font-weight: 500;
          border-radius: 0.5rem;
          transition: all 0.15s;
        }
        .btn-primary:hover {
          box-shadow: 0 4px 12px rgba(30, 64, 175, 0.2);
        }
        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: #f1f5f9;
          color: #475569;
          font-size: 0.875rem;
          font-weight: 500;
          border-radius: 0.5rem;
          transition: all 0.15s;
        }
        .btn-secondary:hover {
          background: #e2e8f0;
        }
      `}</style>
    </div>
  );
}
