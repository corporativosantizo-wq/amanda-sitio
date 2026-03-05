// ============================================================================
// components/admin/ui.tsx
// Componentes reutilizables para el panel admin
// ============================================================================

'use client';

import { type ReactNode } from 'react';

// ── KPI Card ────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  accent?: boolean;
  trend?: number;   // +12 = 12% arriba, -5 = 5% abajo
}

export function KPICard({ label, value, sub, icon, accent, trend }: KPICardProps) {
  return (
    <div className={`rounded-xl p-5 transition-all ${
      accent
        ? 'bg-gradient-to-br from-[#1E40AF] to-[#0891B2] text-white shadow-lg shadow-blue-900/20'
        : 'bg-white border border-slate-200 shadow-sm'
    }`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className={`text-xs font-medium uppercase tracking-wider ${accent ? 'text-blue-100' : 'text-slate-500'}`}>
            {label}
          </p>
          <p className={`text-2xl font-bold mt-1 tracking-tight ${accent ? 'text-white' : 'text-slate-900'}`}>
            {value}
          </p>
          {sub && (
            <p className={`text-sm mt-1 ${accent ? 'text-blue-100' : 'text-slate-500'}`}>{sub}</p>
          )}
        </div>
        {icon && (
          <div className={`text-2xl shrink-0 ${accent ? 'opacity-40' : 'opacity-20'}`}>
            {icon}
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div className={`mt-3 flex items-center gap-1 text-xs font-medium ${
          trend > 0
            ? (accent ? 'text-emerald-200' : 'text-emerald-600')
            : (accent ? 'text-red-200' : 'text-red-500')
        }`}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs mes anterior
        </div>
      )}
    </div>
  );
}

// ── Badge ───────────────────────────────────────────────────────────────

type BadgeVariant =
  | 'default' | 'success' | 'warning' | 'danger' | 'info'
  | 'borrador' | 'enviada' | 'aceptada' | 'rechazada' | 'vencida'
  | 'pendiente' | 'pagada' | 'parcial' | 'anulada'
  | 'autorizada' | 'escaneada' | 'con_testimonio' | 'cancelada'
  | 'registrado' | 'confirmado'
  | 'generado' | 'firmado' | 'entregado'
  | 'clasificado' | 'aprobado' | 'rechazado';

const BADGE_STYLES: Record<string, string> = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  danger: 'bg-red-50 text-red-700 border border-red-200',
  info: 'bg-sky-50 text-sky-700 border border-sky-200',
  // Cotizaciones
  borrador: 'bg-slate-100 text-slate-600',
  enviada: 'bg-blue-50 text-blue-700',
  aceptada: 'bg-emerald-50 text-emerald-700',
  rechazada: 'bg-red-50 text-red-600',
  vencida: 'bg-orange-50 text-orange-700',
  // Facturas
  pendiente: 'bg-amber-50 text-amber-700',
  pagada: 'bg-emerald-50 text-emerald-700',
  parcial: 'bg-sky-50 text-sky-700',
  anulada: 'bg-slate-100 text-slate-500 line-through',
  // Escrituras
  autorizada: 'bg-blue-50 text-blue-700',
  escaneada: 'bg-indigo-50 text-indigo-700',
  con_testimonio: 'bg-emerald-50 text-emerald-700',
  cancelada: 'bg-red-50 text-red-600 line-through',
  // Pagos
  registrado: 'bg-amber-50 text-amber-700',
  confirmado: 'bg-emerald-50 text-emerald-700',
  // Testimonios
  generado: 'bg-blue-50 text-blue-700',
  firmado: 'bg-indigo-50 text-indigo-700',
  entregado: 'bg-emerald-50 text-emerald-700',
  // Clasificador
  clasificado: 'bg-blue-50 text-blue-700 border border-blue-200',
  aprobado: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  rechazado: 'bg-red-50 text-red-700 border border-red-200',
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${BADGE_STYLES[variant] ?? BADGE_STYLES.default} ${className}`}>
      {children}
    </span>
  );
}

// ── Section Card ────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  action?: { label: string; onClick?: () => void; href?: string };
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Section({ title, action, children, className = '', noPadding }: SectionProps) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {action && (
          <button
            onClick={action.onClick}
            className="text-sm text-[#0891B2] hover:text-[#1E40AF] font-medium transition-colors"
          >
            {action.label} →
          </button>
        )}
      </div>
      <div className={noPadding ? '' : 'p-5'}>
        {children}
      </div>
    </div>
  );
}

// ── Alert Banner ────────────────────────────────────────────────────────

interface Alerta {
  tipo: 'danger' | 'warning' | 'info';
  mensaje: string;
}

export function AlertBanner({ alertas }: { alertas: Alerta[] }) {
  if (!alertas?.length) return null;

  const estilos: Record<string, string> = {
    danger: 'bg-red-50 text-red-800 border border-red-200',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200',
    info: 'bg-sky-50 text-sky-800 border border-sky-200',
  };

  const iconos: Record<string, string> = {
    danger: '🔴',
    warning: '🟡',
    info: '🔵',
  };

  return (
    <div className="space-y-2">
      {alertas.map((a, i) => (
        <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm ${estilos[a.tipo]}`}>
          <span>{iconos[a.tipo]}</span>
          <span>{a.mensaje}</span>
        </div>
      ))}
    </div>
  );
}

// ── Empty State ─────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon = '📋', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="text-4xl mb-3">{icon}</span>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-[#1E40AF] text-white text-sm font-medium rounded-lg hover:bg-[#1e3a8a] transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ── Loading Skeleton ────────────────────────────────────────────────────

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
  );
}

export function KPISkeleton() {
  return (
    <div className="rounded-xl p-5 bg-white border border-slate-200">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-7 w-32 mb-2" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

// ── Quetzales formatter ─────────────────────────────────────────────────

export function Q(monto: number | undefined | null): string { if (monto == null) return 'Q0';
  return `Q${monto.toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// ── Page Header ─────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: { label: string; onClick?: () => void; href?: string; icon?: string };
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white text-sm font-medium rounded-lg hover:shadow-lg hover:shadow-blue-900/20 transition-all shrink-0"
        >
          {action.icon && <span>{action.icon}</span>}
          {action.label}
        </button>
      )}
    </div>
  );
}
