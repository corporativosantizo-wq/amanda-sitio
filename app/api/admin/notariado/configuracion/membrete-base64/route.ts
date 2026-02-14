// ============================================================================
// app/api/admin/notariado/configuracion/membrete-base64/route.ts
// Devuelve la imagen de membrete como base64 (para uso en generadores DOCX)
// ============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';

function storageClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data: configs, error } = await supabase
      .from('configuracion_notariado')
      .select('clave, valor')
      .in('clave', ['membrete_path', 'membrete_width', 'membrete_height']);

    if (error) throw error;

    const config: Record<string, string> = {};
    for (const row of configs ?? []) {
      config[row.clave] = row.valor;
    }

    if (!config.membrete_path) {
      return NextResponse.json({ membrete: null });
    }

    // Download the image
    const storage = storageClient();
    const { data: fileData, error: dlErr } = await storage.storage
      .from('notariado')
      .download(config.membrete_path);

    if (dlErr || !fileData) {
      return NextResponse.json({ membrete: null });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const isPng = config.membrete_path.endsWith('.png');

    return NextResponse.json({
      membrete: {
        headerImageBase64: base64,
        headerImageWidth: Number(config.membrete_width ?? '600'),
        headerImageHeight: Number(config.membrete_height ?? '100'),
        headerImageType: isPng ? 'png' : 'jpg',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
