// Página de pago cancelado (el cliente cerró el checkout de Stripe sin pagar).

export const metadata = { title: 'Payment cancelled — Amanda Santizo Law Firm' };

export default function PagoCanceladoPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-white rounded-xl shadow border-t-4 border-[#1e2a5a] p-10 text-center">
        <p className="text-5xl mb-4">↩️</p>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment cancelled</h1>
        <div className="h-1 w-16 bg-[#c2a05a] mx-auto rounded mb-5" />
        <p className="text-slate-600 leading-relaxed">
          No charge was made. You can try again anytime using the <strong>Pay by card</strong> button
          in your confirmation email, or pay by bank transfer with the details in the same email.
        </p>
        <p className="text-sm text-slate-400 mt-6">
          Questions? Write to <strong>contador@papeleo.legal</strong>
        </p>
      </div>
    </div>
  );
}
