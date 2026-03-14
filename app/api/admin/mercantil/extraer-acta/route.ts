// ============================================================================
// POST /api/admin/mercantil/extraer-acta
// Recibe PDF o DOCX de acta → extrae datos estructurados con Claude
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { getAnthropicClient } from '@/lib/ai/anthropic-client';
import { extraerTextoDocx } from '@/lib/templates/certificacion-acta';

export const maxDuration = 120;

const EXTRACTION_PROMPT = `Eres un asistente legal experto en derecho mercantil guatemalteco.
Analiza el contenido de esta acta de asamblea y extrae los siguientes datos en formato JSON.

Devuelve SOLO un JSON válido (sin markdown, sin backticks), con esta estructura exacta:

{
  "entidad": "nombre completo de la sociedad o entidad",
  "tipo_entidad": "Sociedad Anónima | Sociedad de Responsabilidad Limitada | Asociación | Fundación | otro",
  "tipo_asamblea": "Asamblea General Ordinaria | Asamblea General Extraordinaria | Asamblea Ordinaria | Asamblea Extraordinaria | Junta Directiva | Sesión de Junta Directiva | otro",
  "numero_acta": 5,
  "fecha_acta": "2025-01-31",
  "hora_acta": "las diez horas",
  "lugar_acta": "ciudad de Guatemala, departamento de Guatemala",
  "presidente_asamblea": "nombre completo de quien preside",
  "secretario_asamblea": "nombre completo del secretario",
  "folios": "rango de folios del libro si se mencionan, ej: 'del folio 15 al folio 20'",
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
      "contenido_literal": "texto LITERAL y COMPLETO del punto, copiado EXACTAMENTE como aparece en el acta"
    }
  ],
  "quorum": "descripción del quórum si se menciona",
  "convocatoria": "tipo de convocatoria: primera | segunda | totalitaria",
  "notas": "cualquier observación relevante"
}

REGLAS CRÍTICAS DE EXTRACCIÓN:
- contenido_literal debe ser una COPIA TEXTUAL EXACTA del punto del acta, carácter por carácter
- NO resumas, NO parafrasees, NO modifiques el texto en absoluto
- Preserva la puntuación EXACTA, las mayúsculas, los acentos y el formato del original
- Si hay resoluciones dentro de un punto, inclúyelas COMPLETAS en el contenido_literal
- Si el punto contiene sub-incisos (a, b, c...) o numerales, cópialos tal cual
- Los nombres deben estar completos como aparecen en el acta
- La fecha debe estar en formato YYYY-MM-DD
- tipo_asamblea debe indicar el tipo exacto de asamblea o reunión tal como aparece en el encabezado del acta
- Si se mencionan folios del libro, extráelos en el campo "folios"
- Si algún dato no se encuentra, usa null`;

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const formData = await req.formData();
    const file = formData.get('archivo') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Se requiere un archivo PDF o DOCX.' },
        { status: 400 }
      );
    }

    const isPdf = file.type.includes('pdf') || file.name.endsWith('.pdf');
    const isDocx = file.type === DOCX_MIME || file.name.endsWith('.docx');

    if (!isPdf && !isDocx) {
      return NextResponse.json(
        { error: 'Solo se permiten archivos PDF o DOCX.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const anthropic = getAnthropicClient();

    let response;

    if (isPdf) {
      // PDF: send as base64 document to Claude
      const base64 = Buffer.from(bytes).toString('base64');
      response = await anthropic.messages.create({
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
              { type: 'text', text: EXTRACTION_PROMPT },
            ],
          },
        ],
      });
    } else {
      // DOCX: extract text with JSZip, then send as text to Claude
      const textoDocx = await extraerTextoDocx(bytes);
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `A continuación se presenta el texto extraído de un archivo DOCX que contiene un acta de asamblea:\n\n---\n${textoDocx}\n---\n\n${EXTRACTION_PROMPT}`,
              },
            ],
          },
        ],
      });
    }

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
