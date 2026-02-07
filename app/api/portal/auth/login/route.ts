// ============================================================================
// POST /api/portal/auth/login
// Verifica email en legal.clientes + envía magic link via Supabase Auth
// ============================================================================
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { SECURITY_HEADERS } from '@/lib/portal/auth';
import { checkRateLimit } from '@/lib/portal/rate-limit';

export async function POST(req: Request) {
  try {
    // Rate limit: 10 intentos por IP por minuto
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const { allowed } = checkRateLimit(`login:${ip}`, 10, 60_000);
    if (!allowed) {
      return Response.json(
        { error: 'Demasiados intentos. Espere un momento.' },
        { status: 429, headers: SECURITY_HEADERS }
      );
    }

    const body = await req.json();
    const email = (body.email ?? '').trim().toLowerCase();

    // Validar formato de email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json(
        { error: 'Ingrese un email válido.' },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    // Verificar que el email existe en legal.clientes con estado activo
    const db = createAdminClient();
    const { data: cliente } = await db
      .from('clientes')
      .select('id, nombre, email')
      .eq('email', email)
      .eq('estado', 'activo')
      .single();

    if (!cliente) {
      console.warn(`[Portal Login] Email no encontrado: ${email}`);
      return Response.json(
        { error: 'No tiene cuenta activa. Contacte al bufete.' },
        { status: 404, headers: SECURITY_HEADERS }
      );
    }

    // Enviar magic link via Supabase Auth (implicit flow para que el browser reciba los tokens)
    const origin = new URL(req.url).origin;
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          flowType: 'implicit',
        },
      }
    );

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/portal/auth/callback`,
      },
    });

    if (otpError) {
      console.error('[Portal Login] OTP error:', otpError.message);
      return Response.json(
        { error: 'Error al enviar el enlace. Intente de nuevo.' },
        { status: 500, headers: SECURITY_HEADERS }
      );
    }

    return Response.json(
      { success: true, message: 'Enlace de acceso enviado a su email.' },
      { headers: SECURITY_HEADERS }
    );
  } catch (error: any) {
    console.error('[Portal Login] Error:', error);
    return Response.json(
      { error: 'Error interno del servidor.' },
      { status: 500, headers: SECURITY_HEADERS }
    );
  }
}
