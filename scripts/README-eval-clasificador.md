# Eval del clasificador de Molly — instrumental y marcas de versión

Scripts de evaluación offline del clasificador (`requiere_respuesta` en `lib/molly/brain.ts`):

- `eval-clasificador-offline.ts` — corre el clasificador vigente del working tree contra los entrantes
  reales de 45 días y compara con la decisión histórica almacenada. Solo lectura.
- `eval-refinar-veredicto.ts` — recalcula la matriz con veredicto fino por-mensaje (borrador enviado de
  ESE mensaje, o último entrante antes de la respuesta del despacho).

Uso: `pnpm dlx tsx scripts/<script>.ts` (lee `.env.local`). Estos scripts quedan FUERA del typecheck que
bloquea el build (ver `scripts/tsconfig.json`); chequearlos con `npm run typecheck:scripts`.

---

## ⚠️ Cortes de versión del clasificador en PRODUCCIÓN

Las clasificaciones almacenadas en `legal.email_messages` (`clasificacion`, `confidence_score`,
`requiere_respuesta`) provienen de la versión de `lib/molly/brain.ts` desplegada en el momento de cada
clasificación. Para armar sets de evaluación hay que segmentar por estos cortes (comparar
`created_at` del mensaje contra el instante del corte):

| Desde (UTC) | Hasta (UTC) | Versión de brain.ts | Características |
|---|---|---|---|
| — | 2026-07-01 ~15:00 | `4480511` y anteriores (modelo `claude-sonnet-4` retirado) | Clasificación caída del 28-jun al 1-jul (incidente); backfill masivo el 1-jul 15:19–15:47 |
| 2026-07-01 ~15:00 | 2026-07-07 ~22:30 | `4480511` (modelo `claude-sonnet-4-6`) | `requiere_respuesta` NO persistido (efímero) |
| 2026-07-07 ~22:30 | **2026-07-26 05:39:36** | `f86c551` | `requiere_respuesta` persistido; clasifica cada correo AISLADO; temperature default (1.0); sin regla financiero |
| **2026-07-26 05:39:36** | — | **`c92f949`** (merge `78f87fd`, deploy `2bb7899`) | temperature 0 (determinista) + contexto de hilo (3 mensajes previos) + regla FINANCIERO por contenido + enum de tipo completo |

**Nota crítica sobre el 25-jul:** el merge `78f87fd` se hizo a las 21:57 UTC del 25-jul, pero su deploy
**FALLÓ en build** (error de typecheck en estos mismos scripts) y producción siguió sirviendo `f86c551`
hasta el cutover real de las **05:39:36 UTC del 26-jul** (deploy `2bb7899`, que además arregló el build).
Cualquier análisis que asuma que la variante (a) corrió en producción el 25-jul es incorrecto.

Historial de referencia del set de evaluación (25-jul-2026): baseline fino de 52 casos —
(a) actual: aciertos 17 / falsos-sí 34 / falsos-no 1 · (b) relajada: 24 / 24 / 4 · siempre-false: 38/0/14.
Sesgos documentados: set condicionado a casos con veredicto deducible (sobre-representa borradores
generados), ~15 falsos-sí provienen de borradores póstumos del backfill del 1-jul, y la pista
"Contacto conocido" empuja a `requiere_respuesta=true`.
