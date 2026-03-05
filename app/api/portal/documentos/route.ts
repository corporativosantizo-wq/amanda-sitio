// ============================================================================
// GET /api/portal/documentos
// Listar y descargar documentos del cliente (escrituras y testimonios)
// ============================================================================
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPortalSession, SECURITY_HEADERS } from '@/lib/portal/auth';
import { checkRateLimit } from '@/lib/portal/rate-limit';

export async function GET(req: Request) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { allowed } = checkRateLimit(`docs:${ip}`, 60, 60_000);
  if (!allowed) {
    return Response.json(
      { error: 'Demasiadas solicitudes.' },
      { status: 429, headers: SECURITY_HEADERS }
    );
  }

  const session = await getPortalSession(
    req.headers.get('authorization'),
    req.headers.get('x-cliente-id')
  );
  if (!session) {
    return Response.json(
      { error: 'No autorizado' },
      { status: 401, headers: SECURITY_HEADERS }
    );
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const db = createAdminClient();

  try {
    if (action === 'download') {
      // Descargar un documento específico
      const tipo = url.searchParams.get('tipo'); // escritura | testimonio
      const docId = url.searchParams.get('id');

      if (!tipo || !docId) {
        return Response.json(
          { error: 'Parámetros inválidos' },
          { status: 400, headers: SECURITY_HEADERS }
        );
      }

      let fileUrl: string | null = null;
      let fileName: string = 'documento.pdf';

      if (tipo === 'escritura') {
        const { data: esc } = await db
          .from('escrituras')
          .select('pdf_escritura_url, numero, pdf_nombre_archivo')
          .eq('id', docId)
          .eq('cliente_id', session.clienteId)
          .single();

        if (!esc || !esc.pdf_escritura_url) {
          return Response.json(
            { error: 'Documento no encontrado' },
            { status: 404, headers: SECURITY_HEADERS }
          );
        }
        fileUrl = esc.pdf_escritura_url;
        fileName =
          esc.pdf_nombre_archivo ?? `escritura-${esc.numero}.pdf`;
      } else if (tipo === 'testimonio') {
        // Verificar que el testimonio pertenece a una escritura del cliente
        const { data: test } = await db
          .from('testimonios')
          .select('pdf_url, tipo, escritura_id')
          .eq('id', docId)
          .single();

        if (!test || !test.pdf_url) {
          return Response.json(
            { error: 'Documento no encontrado' },
            { status: 404, headers: SECURITY_HEADERS }
          );
        }

        // Verificar propiedad: la escritura debe ser del cliente
        const { data: esc } = await db
          .from('escrituras')
          .select('id, numero')
          .eq('id', test.escritura_id)
          .eq('cliente_id', session.clienteId)
          .single();

        if (!esc) {
          return Response.json(
            { error: 'No autorizado para este documento' },
            { status: 403, headers: SECURITY_HEADERS }
          );
        }

        fileUrl = test.pdf_url;
        fileName = `testimonio-${esc.numero}-${test.tipo}.pdf`;
      } else if (tipo === 'documento') {
        // Documentos del sistema documental (aprobados)
        const { data: doc } = await db
          .from('documentos')
          .select('id, archivo_url, nombre_archivo')
          .eq('id', docId)
          .eq('cliente_id', session.clienteId)
          .eq('estado', 'aprobado')
          .single();

        if (!doc || !doc.archivo_url) {
          return Response.json(
            { error: 'Documento no encontrado' },
            { status: 404, headers: SECURITY_HEADERS }
          );
        }

        // Generar signed URL desde bucket 'documentos'
        const docStorage = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false } }
        );

        const { data: docSignedData, error: docSignError } = await docStorage.storage
          .from('documentos')
          .createSignedUrl(doc.archivo_url, 600);

        if (docSignError || !docSignedData) {
          return Response.json(
            { error: 'Error al generar enlace de descarga' },
            { status: 500, headers: SECURITY_HEADERS }
          );
        }

        return Response.json(
          { url: docSignedData.signedUrl, fileName: doc.nombre_archivo },
          { headers: SECURITY_HEADERS }
        );
      } else {
        return Response.json(
          { error: 'Tipo de documento no válido' },
          { status: 400, headers: SECURITY_HEADERS }
        );
      }

      if (!fileUrl) {
        return Response.json(
          { error: 'Documento sin archivo' },
          { status: 404, headers: SECURITY_HEADERS }
        );
      }

      // Generar URL firmada temporal (10 minutos)
      const storage = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );

      // Extraer path del bucket desde la URL completa
      const bucketPath = fileUrl.includes('/legal-docs/')
        ? fileUrl.split('/legal-docs/').pop()!
        : fileUrl;

      const { data: signedData, error: signError } = await storage.storage
        .from('legal-docs')
        .createSignedUrl(bucketPath, 600);

      if (signError || !signedData) {
        console.error('[Portal Docs] Signed URL error:', signError);
        return Response.json(
          { error: 'Error al generar enlace de descarga' },
          { status: 500, headers: SECURITY_HEADERS }
        );
      }

      return Response.json(
        { url: signedData.signedUrl, fileName },
        { headers: SECURITY_HEADERS }
      );
    }

    // Listar documentos aprobados del sistema documental
    const { data: documentosAprobados } = await db
      .from('documentos')
      .select('id, titulo, tipo, fecha_documento, nombre_archivo, archivo_url, created_at')
      .eq('cliente_id', session.clienteId)
      .eq('estado', 'aprobado')
      .order('fecha_documento', { ascending: false });

    // Listar documentos del cliente
    const { data: escrituras } = await db
      .from('escrituras')
      .select(
        'id, numero, fecha_autorizacion, tipo_instrumento_texto, descripcion, pdf_escritura_url'
      )
      .eq('cliente_id', session.clienteId)
      .not('pdf_escritura_url', 'is', null)
      .order('fecha_autorizacion', { ascending: false });

    // Obtener IDs de escrituras del cliente para filtrar testimonios
    const { data: todasEscrituras } = await db
      .from('escrituras')
      .select('id, numero')
      .eq('cliente_id', session.clienteId);

    const escrituraMap = new Map<string, number>();
    (todasEscrituras ?? []).forEach((e: any) =>
      escrituraMap.set(e.id, e.numero)
    );
    const escrituraIds = Array.from(escrituraMap.keys());

    let testimonios: any[] = [];
    if (escrituraIds.length > 0) {
      const { data: tests } = await db
        .from('testimonios')
        .select(
          'id, escritura_id, tipo, estado, fecha_emision, pdf_url'
        )
        .in('escritura_id', escrituraIds)
        .not('pdf_url', 'is', null)
        .order('fecha_emision', { ascending: false });

      testimonios = (tests ?? []).map((t: any) => ({
        ...t,
        escritura_numero: escrituraMap.get(t.escritura_id),
      }));
    }

    return Response.json(
      {
        escrituras: (escrituras ?? []).map((e: any) => ({
          id: e.id,
          numero: e.numero,
          fecha: e.fecha_autorizacion,
          tipo: e.tipo_instrumento_texto,
          descripcion: e.descripcion,
          tiene_pdf: !!e.pdf_escritura_url,
        })),
        testimonios,
        documentos: (documentosAprobados ?? []).map((d: any) => ({
          id: d.id,
          titulo: d.titulo,
          tipo: d.tipo,
          fecha: d.fecha_documento,
          nombre_archivo: d.nombre_archivo,
        })),
      },
      { headers: SECURITY_HEADERS }
    );
  } catch (error: any) {
    console.error('[Portal Docs] Error:', error);
    return Response.json(
      { error: 'Error al obtener documentos' },
      { status: 500, headers: SECURITY_HEADERS }
    );
  }
}
