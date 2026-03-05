import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ session_id?: string }>
}

export default async function GraciasPage({ searchParams }: PageProps) {
  const { session_id } = await searchParams
  let order: { product_type: string; product_id: string } | null = null
  let product: { name: string; type: string; file_url: string | null } | null = null

  if (session_id) {
    const supabase = await createClient()

    const { data: orderData } = await supabase
      .from('orders')
      .select('product_id, product_type')
      .eq('stripe_session_id', session_id)
      .single()

    if (orderData) {
      order = orderData

      const { data: productData } = await supabase
        .from('products')
        .select('name, type, file_url')
        .eq('id', orderData.product_id)
        .single()

      if (productData) product = productData
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center py-20">
      <div className="max-w-lg mx-auto px-6 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="font-display text-3xl md:text-4xl font-bold text-navy mb-4">
          ¡Gracias por tu compra!
        </h1>

        {product ? (
          <>
            <p className="text-slate text-lg mb-2">
              Tu compra de <span className="font-semibold text-navy">{product.name}</span> fue exitosa.
            </p>

            {product.type === 'digital' ? (
              <div className="mt-8 p-6 bg-slate-lighter rounded-2xl">
                <p className="text-navy font-semibold mb-4">
                  Tu producto digital está listo
                </p>
                {product.file_url ? (
                  <a
                    href={product.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-8 py-4 bg-cyan text-navy-dark font-bold rounded-lg hover:bg-navy hover:text-white transition-all duration-300"
                  >
                    Descargar archivo
                  </a>
                ) : (
                  <p className="text-slate text-sm">
                    Recibirás un correo con el enlace de descarga en breve.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-8 p-6 bg-slate-lighter rounded-2xl">
                <p className="text-navy font-semibold mb-2">
                  Servicio profesional adquirido
                </p>
                <p className="text-slate text-sm">
                  Nos pondremos en contacto contigo para agendar tu sesión.
                  También puedes escribirnos directamente.
                </p>
                <Link
                  href="/contacto"
                  className="inline-block mt-4 px-6 py-3 bg-navy text-white font-semibold rounded-lg hover:bg-navy-dark transition-colors"
                >
                  Contactar ahora
                </Link>
              </div>
            )}
          </>
        ) : (
          <p className="text-slate text-lg">
            Tu pago fue procesado correctamente. Recibirás un correo de confirmación.
          </p>
        )}

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/tienda"
            className="px-6 py-3 border-2 border-navy text-navy font-semibold rounded-lg hover:bg-navy hover:text-white transition-all duration-300"
          >
            Volver a la tienda
          </Link>
          <Link
            href="/"
            className="px-6 py-3 text-slate hover:text-navy font-medium transition-colors"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
