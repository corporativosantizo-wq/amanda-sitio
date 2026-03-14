// ============================================================================
// POST /api/admin/mercantil/extraer-acta
// Recibe PDF de acta → extrae datos estructurados con Claude
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { getAnthropicClient } from '@/lib/ai/anthropic-client';

export const maxDuration = 120;

const EXTRACTION_PROMPT = `Eres un asistente legal experto en derecho mercantil guatemalteco.
Analiza el contenido de esta acta de asamblea y extrae los siguientes datos en formato JSON.

Devuelve SOLO un JSON válido (sin markdown, sin backticks), con esta estructura exacta:

{
  "entidad": "nombre completo de la sociedad o entidad",
  "tipo_entidad": "Sociedad Anónima | Sociedad de Responsabilidad Limitada | Asociación | Fundación | otro",
  "numero_acta": 5,
  "fecha_acta": "2025-01-31",
  "hora_acta": "las diez horas",
  "lugar_acta": "ciudad de Guatemala, departamento de Guatemala",
  "presidente_asamblea": "nombre completo de quien preside",
  "secretario_asamblea": "nombre completo del secretario",
  "asistentes": [
    {
      "nombre": "nombre completo",
      "cargo": "Presidente | Secretario | Director | Accionista | Representante Legal | otro",
      "acciones": "número de acciones si se menciona"
    }
  ],
  "puntos": [
    {
      "numero": 1,
      "titulo": "título o descripción breve del punto",
      "contenido_literal": "texto LITERAL y COMPLETO del punto, tal como aparece en el acta, incluyendo resoluciones"
    }
  ],
  "quorum": "descripción del quórum si se menciona",
  "convocatoria": "tipo de convocatoria: primera | segunda | totalitaria",
  "notas": "cualquier observación relevante"
}

IMPORTANTE:
- El contenido_literal de cada punto debe ser TEXTUAL, copiado tal cual del acta
- Si hay resoluciones dentro de un punto, inclúyelas en el contenido_literal
- Los nombres deben estar completos como aparecen en el acta
- La fecha debe estar en formato YYYY-MM-DD
- Si algún dato no se encuentra, usa null`;

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const formData = await req.formData();
    const file = formData.get('archivo') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Se requiere un archivo PDF.' },
        { status: 400 }
      );
    }

    if (!file.type.includes('pdf')) {
      return NextResponse.json(
        { error: 'Solo se permiten archivos PDF.' },
        { status: 400 }
      );
    }

    // Convert file to base64 for Claude
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    const anthropic = getAnthropicClient();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });

    // Extract text from response
    const textBlock = response.content.find((b: any) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json(
        { error: 'No se obtuvo respuesta del modelo.' },
        { status: 500 }
      );
    }

    // Parse JSON response
    let datos;
    try {
      // Clean potential markdown wrappers
      let jsonStr = textBlock.text.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      datos = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: 'Error al parsear la respuesta del modelo.', raw: textBlock.text },
        { status: 500 }
      );
    }

    return NextResponse.json({ datos });
  } catch (error: any) {
    console.error('[Extraer Acta] Error:', error);
    return NextResponse.json(
      { error: error.message ?? 'Error al extraer datos del acta.' },
      { status: 500 }
    );
  }
}
