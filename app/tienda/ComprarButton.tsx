'use client';

import { useState } from 'react';

interface Props {
  productId: string;
}

export default function ComprarButton({ productId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleComprar = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/pagos/checkout-producto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al procesar el pago');
        setLoading(false);
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleComprar}
        disabled={loading}
        className="w-full py-4 bg-cyan text-navy-dark font-bold text-lg rounded-lg hover:bg-navy hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Redirigiendo a pago...' : 'Comprar ahora'}
      </button>
      {error && (
        <p className="mt-2 text-red-600 text-sm text-center">{error}</p>
      )}
    </div>
  );
}
