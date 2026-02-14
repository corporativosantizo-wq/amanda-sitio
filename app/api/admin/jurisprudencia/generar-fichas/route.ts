// ============================================================================
// POST /api/admin/jurisprudencia/generar-fichas
// Genera fichas jurisprudenciales estructuradas usando OpenAI
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { fragmentos, query } = await req.json();

    if (!fragmentos || fragmentos.length === 0) {
      return NextResponse.json(
        { error: 'No hay fragmentos seleccionados.' },
        { status: 400 }
      );
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY no configurada.' },
        { status: 500 }
      );
    }

    const contexto = fragmentos
      .map((f: any, i: number) =>
        `[Fragmento ${i + 1} — ${f.tomo_titulo}]\n${f.contenido}`
      )
      .join('\n\n===\n\n');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Eres un asistente legal experto en jurisprudencia guatemalteca. Tu tarea es analizar fragmentos de jurisprudencia y generar fichas jurisprudenciales estructuradas.

Para CADA casación o criterio jurisprudencial que identifiques en los fragmentos, genera una ficha con este formato exacto (responde en JSON):

{
  "fichas": [
    {
      "numero_casacion": "Casación No. XXX-YYYY",
      "fecha_sentencia": "DD/MM/YYYY",
      "tomo_fuente": "nombre del tomo",
      "materia": "Civil / Penal / Laboral / Contencioso Administrativo / etc",
      "tema_principal": "Tema jurídico principal (ej: Nulidad absoluta del negocio jurídico)",
      "subtemas": ["subtema1", "subtema2"],
      "hechos_relevantes": "Resumen breve de los hechos del caso si están disponibles en el fragmento",
      "ratio_decidendi": "El criterio vinculante / la razón de la decisión. Esta es la parte más importante.",
      "obiter_dicta": "Comentarios adicionales de la Corte que no son el criterio principal pero son relevantes",
      "normas_citadas": ["Art. X del Código Civil", "Art. Y del CPCyM"],
      "criterio_aplicable": "Resumen en 1-2 oraciones del criterio que se puede aplicar en otros casos similares"
    }
  ]
}

INSTRUCCIONES:
- Extrae TODAS las casaciones que encuentres en los fragmentos
- Si un fragmento es un índice o tabla de contenidos, ignóralo
- Si no puedes determinar un campo, pon "No disponible en el fragmento"
- El campo más importante es "ratio_decidendi" — esfuérzate por extraerlo bien
- "criterio_aplicable" debe ser una síntesis útil para un abogado que quiere citar esta casación
- Responde SOLO con el JSON, sin markdown ni backticks`,
          },
          {
            role: 'user',
            content: `Consulta original del usuario: ${query}\n\nFragmentos seleccionados:\n\n${contexto}`,
          },
        ],
        max_tokens: 4000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('[Generar Fichas] OpenAI error:', errData);
      return NextResponse.json(
        { error: 'Error al generar fichas con IA.' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '{}';

    let fichas;
    try {
      const clean = content.replace(/```json\n?|```\n?/g, '').trim();
      fichas = JSON.parse(clean);
    } catch {
      fichas = { fichas: [], error: 'No se pudo parsear la respuesta de IA' };
    }

    return NextResponse.json(fichas);
  } catch (error: any) {
    console.error('[Generar Fichas] Error:', error);
    return NextResponse.json(
      { error: error.message ?? 'Error al generar fichas.' },
      { status: 500 }
    );
  }
}
