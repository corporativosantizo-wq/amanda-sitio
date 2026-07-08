// Página de éxito del pago con tarjeta (consulta internacional, correos EN).
// Stripe redirige aquí tras el pago; el webhook marca la cita como pagada.

export const metadata = { title: 'Payment received — Amanda Santizo Law Firm' };

export default function PagoGraciasPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-white rounded-xl shadow border-t-4 border-[#1e2a5a] p-10 text-center">
        <p className="text-5xl mb-4">✅</p>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment received — thank you!</h1>
        <div className="h-1 w-16 bg-[#c2a05a] mx-auto rounded mb-5" />
        <p className="text-slate-600 leading-relaxed">
          Your consultation is confirmed. You will receive a receipt from Stripe by email,
          and the Teams meeting invitation is in your confirmation email.
        </p>
        <p className="text-sm text-slate-400 mt-6">
          Amanda Santizo — Law Firm · <a href="https://amandasantizo.com" className="text-[#1e2a5a] underline">amandasantizo.com</a>
        </p>
      </div>
    </div>
  );
}
