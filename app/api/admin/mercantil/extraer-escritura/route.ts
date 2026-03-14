// ============================================================================
// POST /api/admin/mercantil/extraer-escritura
// Recibe PDF o DOCX de escritura constitutiva → extrae cláusulas con Claude
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { getAnthropicClient } from '@/lib/ai/anthropic-client';
import { extraerTextoDocx } from '@/lib/templates/certificacion-acta';

export const maxDuration = 120;

const EXTRACTION_PROMPT = `Eres un asistente legal experto en derecho mercantil guatemalteco.
Analiza el contenido de esta escritura constitutiva y extrae los siguientes datos en formato JSON.

Devuelve SOLO un JSON válido (sin markdown, sin backticks), con esta estructura exacta:

{
  "entidad": "nombre completo de la sociedad o entidad",
  "tipo_entidad": "Sociedad Anónima | Sociedad de Responsabilidad Limitada | Asociación | otro",
  "numero_escritura": "número de la escritura pública si se menciona",
  "fecha_escritura": "YYYY-MM-DD si se menciona",
  "notario_autorizante": "nombre del notario que autorizó la escritura",
  "accionistas": [
    {
      "nombre": "nombre completo",
      "representacion": "por sí | en representación de...",
      "acciones": "número de acciones si se menciona"
    }
  ],
  "clausulas": [
    {
      "numero": "PRIMERA | SEGUNDA | TERCERA | etc.",
      "titulo": "título de la cláusula (Denominación, Objeto Social, Domicilio, Capital, etc.)",
      "contenido": "texto LITERAL y COMPLETO de la cláusula, copiado EXACTAMENTE como aparece"
    }
  ]
}

REGLAS CRÍTICAS DE EXTRACCIÓN:
- Extrae TODAS las cláusulas que aparezcan en la escritura
- contenido debe ser una COPIA TEXTUAL EXACTA de la cláusula, carácter por carácter
- NO resumas, NO parafrasees, NO modifiques el texto en absoluto
- Preserva la puntuación, mayúsculas, acentos y formato del original
- Los nombres deben estar completos como aparecen
- Si algún dato no se encuentra, usa null
- Las cláusulas suelen estar numeradas como PRIMERA, SEGUNDA, TERCERA, etc.`;

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
      const base64 = Buffer.from(bytes).toString('base64');
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16384,
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
      const textoDocx = await extraerTextoDocx(bytes);
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16384,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `A continuación se presenta el texto extraído de un archivo DOCX que contiene una escritura constitutiva:\n\n---\n${textoDocx}\n---\n\n${EXTRACTION_PROMPT}`,
              },
            ],
          },
        ],
      });
    }

    const textBlock = response.content.find((b: any) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json(
        { error: 'No se obtuvo respuesta del modelo.' },
        { status: 500 }
      );
    }

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
    console.error('[Extraer Escritura] Error:', error);
    return NextResponse.json(
      { error: error.message ?? 'Error al extraer datos de la escritura.' },
      { status: 500 }
    );
  }
}
