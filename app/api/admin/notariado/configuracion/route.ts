// ============================================================================
// app/api/admin/notariado/configuracion/route.ts
// CRUD para configuración de notariado (membrete, etc.)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';

function storageClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// GET — obtener configuración de membrete
export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('configuracion_notariado')
      .select('clave, valor')
      .in('clave', ['membrete_path', 'membrete_width', 'membrete_height']);

    if (error) throw error;

    const config: Record<string, string> = {};
    for (const row of data ?? []) {
      config[row.clave] = row.valor;
    }

    // If there's a membrete image, generate a signed URL for preview
    let previewUrl: string | null = null;
    if (config.membrete_path) {
      const storage = storageClient();
      const { data: signed, error: signErr } = await storage.storage
        .from('notariado')
        .createSignedUrl(config.membrete_path, 3600);
      if (!signErr && signed) {
        previewUrl = signed.signedUrl;
      }
    }

    return NextResponse.json({
      membrete_path: config.membrete_path ?? null,
      membrete_width: config.membrete_width ? Number(config.membrete_width) : 600,
      membrete_height: config.membrete_height ? Number(config.membrete_height) : 100,
      previewUrl,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — subir/reemplazar imagen de membrete
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const width = formData.get('width') as string | null;
    const height = formData.get('height') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
    }

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Solo se aceptan imágenes PNG o JPG' }, { status: 400 });
    }

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'La imagen no debe superar 2MB' }, { status: 400 });
    }

    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    const storagePath = `plantillas/membrete.${ext}`;

    // Upload to storage (upsert)
    const storage = storageClient();
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadErr } = await storage.storage
      .from('notariado')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    // Upsert config values
    const supabase = createAdminClient();
    const configs = [
      { clave: 'membrete_path', valor: storagePath },
      { clave: 'membrete_width', valor: String(width ?? '600') },
      { clave: 'membrete_height', valor: String(height ?? '100') },
    ];

    for (const cfg of configs) {
      const { error: upsertErr } = await supabase
        .from('configuracion_notariado')
        .upsert(cfg, { onConflict: 'clave' });
      if (upsertErr) throw upsertErr;
    }

    return NextResponse.json({ ok: true, path: storagePath });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — eliminar membrete
export async function DELETE() {
  try {
    const supabase = createAdminClient();

    // Get current path
    const { data } = await supabase
      .from('configuracion_notariado')
      .select('valor')
      .eq('clave', 'membrete_path')
      .single();

    if (data?.valor) {
      const storage = storageClient();
      await storage.storage.from('notariado').remove([data.valor]);
    }

    // Delete config rows
    await supabase
      .from('configuracion_notariado')
      .delete()
      .in('clave', ['membrete_path', 'membrete_width', 'membrete_height']);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
