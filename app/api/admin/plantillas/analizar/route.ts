// ============================================================================
// POST /api/admin/plantillas/analizar
// Recibe un .docx, extrae texto con mammoth, analiza con Claude,
// retorna campos detectados y estructura con marcadores
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import mammoth from 'mammoth';
import { createClient } from '@supabase/supabase-js';
import { sanitizarNombre } from '@/lib/services/documentos.service';

const ANALYSIS_PROMPT = `Eres un experto en documentos legales guatemaltecos. Analiza el siguiente texto extraído de un documento .docx y devuelve ÚNICAMENTE un JSON válido con la estructura de plantilla.

Tu tarea:
1. Identifica el tipo de documento (contrato, acta, demanda, poder, recurso, escritura, memorial, etc.)
2. Identifica TODOS los datos variables — datos que cambiarían si este documento se usara para otro cliente, otra fecha, otro monto, etc.
3. Reescribe la estructura del documento reemplazando cada dato variable con un marcador {{campo_id}}
4. Los marcadores deben tener nombres descriptivos en snake_case

Reglas:
- Nombres propios de personas → campo variable tipo "persona" (ej: {{nombre_arrendante}})
- Fechas específicas → campo variable tipo "fecha" (ej: {{fecha_documento}})
- Montos de dinero → campo variable tipo "numero" (ej: {{monto_renta}})
- Números de DPI/CUI → campo variable tipo "dpi" (ej: {{dpi_arrendante}})
- Direcciones específicas → campo variable tipo "texto" (ej: {{direccion_inmueble}})
- Números de finca, folio, libro → campo variable tipo "texto"
- Edades, estados civiles, profesiones, nacionalidades → campo variable tipo "texto"
- Números de registro mercantil → campo variable tipo "texto"
- Nombres de entidades/empresas → campo variable tipo "texto"
- Texto legal estándar (artículos de ley, cláusulas genéricas) → mantener fijo
- Las partes fijas del documento ("ANTE MI:", "PRIMERO:", cláusulas estándar) NO son variables

Responde ÚNICAMENTE con JSON válido, sin backticks, sin markdown:

{
  "nombre": "Nombre descriptivo de la plantilla",
  "tipo": "contrato|demanda|acta|escritura|memorial|recurso|poder|otro",
  "descripcion": "Descripción breve de para qué sirve esta plantilla",
  "campos": [
    {
      "id": "campo_en_snake_case",
      "label": "Nombre legible para mostrar en formulario",
      "tipo": "texto|persona|numero|fecha|dpi|parrafo|seleccion",
      "requerido": true,
      "placeholder": "ejemplo del dato esperado"
    }
  ],
  "estructura": "Texto completo del documento con marcadores {{campo_id}} en lugar de los datos variables. Mantén TODO el texto fijo exactamente como está en el original."
}`;

export async function POST(req: NextRequest) {
  try {
    // 1. Recibir archivo
    const formData = await req.formData();
    const archivo = formData.get('archivo') as File | null;

    if (!archivo) {
      return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });
    }

    if (!archivo.name.endsWith('.docx')) {
      return NextResponse.json({ error: 'Solo se aceptan archivos .docx' }, { status: 400 });
    }

    console.log(`[Analizar] Archivo recibido: ${archivo.name} (${(archivo.size / 1024).toFixed(0)} KB)`);

    // 2. Subir original a Storage
    const buffer = Buffer.from(await archivo.arrayBuffer());
    const storage = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const storagePath = `plantillas/${Date.now()}_${sanitizarNombre(archivo.name.replace('.docx', ''))}.docx`;

    const { error: uploadError } = await storage.storage
      .from('documentos')
      .upload(storagePath, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: false,
      });

    if (uploadError) {
      console.error('[Analizar] Error al subir:', uploadError);
      return NextResponse.json(
        { error: `Error al guardar archivo: ${uploadError.message}` },
        { status: 500 }
      );
    }

    console.log(`[Analizar] Archivo subido a: ${storagePath}`);

    // 3. Extraer texto con mammoth
    const { value: textoExtraido } = await mammoth.extractRawText({ buffer });

    if (!textoExtraido || textoExtraido.trim().length < 50) {
      return NextResponse.json(
        { error: 'No se pudo extraer texto suficiente del documento. Verifica que no esté vacío o sea solo imágenes.' },
        { status: 400 }
      );
    }

    console.log(`[Analizar] Texto extraído: ${textoExtraido.length} caracteres`);

    // 4. Enviar a Claude para análisis
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: `${ANALYSIS_PROMPT}\n\n--- DOCUMENTO ---\n\n${textoExtraido.slice(0, 15000)}`,
        },
      ],
    });

    const textBlock = response.content.find((b: any) => b.type === 'text') as any;
    const rawText = textBlock?.text ?? '';

    console.log(`[Analizar] Respuesta de Claude: ${rawText.length} chars`);

    // 5. Parsear JSON
    let analysis: any;
    try {
      // Intentar limpiar si viene con backticks
      const cleaned = rawText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();
      analysis = JSON.parse(cleaned);
    } catch (parseErr: any) {
      console.error('[Analizar] Error parseando JSON:', parseErr.message);
      console.error('[Analizar] Texto raw:', rawText.slice(0, 500));
      return NextResponse.json(
        { error: 'La IA no retornó un JSON válido. Intenta de nuevo.' },
        { status: 500 }
      );
    }

    // 6. Validar estructura mínima
    if (!analysis.nombre || !analysis.estructura) {
      return NextResponse.json(
        { error: 'La IA no detectó la estructura del documento correctamente.' },
        { status: 500 }
      );
    }

    console.log(`[Analizar] Plantilla detectada: "${analysis.nombre}", ${(analysis.campos || []).length} campos`);

    return NextResponse.json({
      analysis: {
        nombre: analysis.nombre,
        tipo: analysis.tipo || 'otro',
        descripcion: analysis.descripcion || '',
        campos: analysis.campos || [],
        estructura: analysis.estructura,
      },
      storage_path: storagePath,
    });
  } catch (error: any) {
    console.error('[Analizar] Error:', error);
    return NextResponse.json(
      { error: `Error al analizar documento: ${error.message ?? 'desconocido'}` },
      { status: 500 }
    );
  }
}
