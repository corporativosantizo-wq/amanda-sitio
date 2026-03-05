import Link from 'next/link';

export default function AccesoDenegadoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m-4.93-4.364A9 9 0 1121 12a8.963 8.963 0 01-1.93 5.636M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Acceso Denegado</h1>
          <p className="text-sm text-slate-500 mb-6">
            Tu cuenta no tiene acceso al panel de administración. Si crees que es un error, contacta al administrador.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white text-sm font-medium rounded-lg hover:shadow-lg transition-all"
          >
            Volver al sitio
          </Link>
        </div>
      </div>
    </div>
  );
}
