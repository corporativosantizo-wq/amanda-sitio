// ============================================================================
// app/api/admin/notariado/escrituras/[id]/pdf/route.ts
// POST → Subir PDF escaneado de la escritura firmada
// PUT  → Verificar o agregar notas al PDF subido
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  subirPDFEscritura,
  verificarPDFEscritura,
  obtenerEscritura,
  EscrituraError,
} from '@/lib/services/escrituras.service';

type RouteParams = { params: Promise<{ id: string }> };

const MAX_FILE_SIZE = 150 * 1024 * 1024; // 150MB
const ALLOWED_TYPES = ['application/pdf'];

/**
 * POST - Subir PDF escaneado.
 * Acepta multipart/form-data con campo "archivo".
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Verificar que la escritura existe y está en estado válido
    await obtenerEscritura(id);

    const formData = await request.formData();
    const archivo = formData.get('archivo') as File | null;

    if (!archivo) {
      return NextResponse.json(
        { error: 'Se requiere un archivo PDF en el campo "archivo"' },
        { status: 400 }
      );
    }

    // Validar tipo
    if (!ALLOWED_TYPES.includes(archivo.type)) {
      return NextResponse.json(
        { error: `Tipo de archivo no permitido: ${archivo.type}. Solo se acepta PDF.` },
        { status: 400 }
      );
    }

    // Validar tamaño
    if (archivo.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `El archivo excede el límite de 150MB (${(archivo.size / 1024 / 1024).toFixed(1)}MB)` },
        { status: 400 }
      );
    }

    // Subir a Supabase Storage
    const db = createAdminClient();
    const nombreArchivo = `escrituras/${id}/${Date.now()}_${sanitizarNombre(archivo.name)}`;

    const buffer = Buffer.from(await archivo.arrayBuffer());

    // Usar el cliente de Supabase con schema 'public' para storage
    const { createClient } = await import('@supabase/supabase-js');
    const storageClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: uploadData, error: uploadError } = await storageClient
      .storage
      .from('legal-docs')
      .upload(nombreArchivo, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      throw new EscrituraError('Error al subir archivo a storage', uploadError);
    }

    // Obtener URL pública (o signed URL si el bucket es privado)
    const { data: urlData } = storageClient
      .storage
      .from('legal-docs')
      .getPublicUrl(nombreArchivo);

    const pdfUrl = urlData.publicUrl;

    // Registrar en la escritura (trigger cambia estado a 'escaneada')
    const escritura = await subirPDFEscritura(id, {
      url: pdfUrl,
      nombre: archivo.name,
      tamano: archivo.size,
    });

    return NextResponse.json({
      success: true,
      message: 'PDF subido correctamente. Estado cambiado a "escaneada".',
      data: {
        escritura_id: escritura.id,
        estado: escritura.estado,
        pdf_escritura_url: escritura.pdf_escritura_url,
        pdf_nombre_archivo: escritura.pdf_nombre_archivo,
        pdf_tamano_bytes: escritura.pdf_tamano_bytes,
        pdf_verificado: escritura.pdf_verificado,
      },
    });
  } catch (error) {
    return manejarError(error);
  }
}

/**
 * PUT - Verificar PDF o agregar notas.
 * body: { verificado: true, notas?: "Todo bien" }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (typeof body.verificado !== 'boolean') {
      return NextResponse.json(
        { error: 'Se requiere el campo "verificado" (true/false)' },
        { status: 400 }
      );
    }

    const escritura = await verificarPDFEscritura(id, body.verificado, body.notas);

    return NextResponse.json({
      success: true,
      message: body.verificado
        ? 'PDF marcado como verificado'
        : 'PDF marcado como pendiente de revisión',
      data: {
        escritura_id: escritura.id,
        pdf_verificado: escritura.pdf_verificado,
        pdf_notas: escritura.pdf_notas,
      },
    });
  } catch (error) {
    return manejarError(error);
  }
}

// --- Helpers ---

function sanitizarNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Quitar acentos
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

function manejarError(error: unknown) {
  if (error instanceof EscrituraError) {
    const status = error.message.includes('no encontrad') ? 404 : 400;
    return NextResponse.json(
      { error: error.message },
      { status }
    );
  }
  console.error('Error en PDF de escritura:', error);
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
}
