# Contexto legal guatemalteco — amanda-sitio

Este documento ayuda a Claude Code a entender los conceptos legales y
contables guatemaltecos que aparecen en el código y en los datos.
No es necesario ser abogado para trabajar en el sistema, pero sí
entender los términos para no romper lógica de negocio crítica.

---

## Numeración de expedientes judiciales

El formato es del Organismo Judicial (OJ) de Guatemala:

```
01001-2024-00123
│     │    │
│     │    └── Número correlativo del año
│     └──────── Año
└────────────── Código del juzgado
```

Este número es único por expediente y se usa como identificador
humano en toda la interfaz. El UUID de la base de datos es interno.

---

## Tipos de proceso

| Código | Descripción |
|--------|-------------|
| `civil` | Juicios civiles (ordinarios, ejecutivos, etc.) |
| `penal` | Procesos penales |
| `laboral` | Conflictos laborales |
| `contencioso_administrativo` | Vs. entidades del Estado |
| `constitucional` | Amparos constitucionales |
| `amparo` | Específicamente acción de amparo |
| `familia` | Divorcios, alimentos, filiación |
| `mercantil` | Derecho empresarial |
| `internacional` | Casos con elemento internacional |

---

## Impuestos guatemaltecos (contabilidad)

### IVA
- Tasa: **12%** sobre el valor del servicio
- Se aplica a todas las facturas de la firma

### ISR (retención en la fuente)
- **5%** si el monto de la factura es menor a Q30,000
- **7%** si el monto es mayor o igual a Q30,000
- La retiene el cliente (agente retenedor) y la remite al SAT

### Flujo de cobro de la firma

```
1. Amanda emite cotización (sin IVA desglosado visualmente, pero incluido)
2. Cliente acepta y paga
3. Amanda emite factura electrónica (FEL — Factura Electrónica en Línea)
4. Si el cliente es agente retenedor, descuenta ISR y paga el neto
5. Amanda recibe el neto y registra la retención para compensar en declaración
```

**Regla de negocio:** La firma NO genera la factura antes de recibir el pago, para no adelantar el IVA al SAT. El sistema debe reflejar este flujo: cotización → pago → recibo → factura.

### Monedas
- Moneda local: **GTQ** (Quetzal guatemalteco)
- También se trabaja en USD en algunos casos internacionales

---

## Notariado

Amanda es Notaria (además de Abogada), lo que significa que puede
autorizar escrituras públicas y actas notariales.

### Tipos de documentos notariales en el sistema
- Escrituras públicas (constitución de sociedades, modificaciones, compraventas)
- Actas notariales (actas de asambleas, actas de notificación)
- Protocolización de documentos

### Papel sellado especial
Las escrituras se redactan en papel con membrete especial (papel
sellado). En el módulo DOCX, los documentos notariales usan
márgenes espejo (`<w:mirrorMargins/>`) para impresión en libro de
protocolo.

### Grupos corporativos frecuentes
- **Robles/Pemueller:** Rope de Centro América, Transportes Rope, San Andrés Inversiones, Porcicultores de la Costa, Porto Sol
- **Construcciones Industriales S.A.**
- **ERA/RERA S.A.**

---

## Plazos procesales

Los plazos en Guatemala pueden ser en:
- **Días hábiles:** No cuentan sábados, domingos ni días de asueto oficial
- **Días calendario:** Todos los días corren

El campo `dias_habiles` en `legal.plazos_procesales` diferencia esto.
La lógica de cálculo de fechas de vencimiento debe respetar esta distinción.

### Plazos críticos conocidos
- Apelación de amparo: 48 horas (bajo LAEPC — Ley de Amparo, Exhibición Personal y de Constitucionalidad), cómputo en días hábiles continuos
- Contestación de demanda ordinaria civil: 9 días hábiles
- Período de prueba civil ordinario: 30 días hábiles

---

## Vocabulario legal en la UI

Para mantener consistencia con la terminología guatemalteca:

| Término correcto | Evitar |
|-----------------|--------|
| Expediente | Caso, asunto |
| Actor / Demandante | Querellante (en civil) |
| Demandado | Acusado (en civil) |
| Amparo | Recurso de amparo (el amparo es una acción, no un recurso) |
| Actuación procesal | Trámite, movimiento |
| Notificación | Citación (son actos distintos) |
| Memorial | Escrito (aunque se usan indistintamente) |

---

## Instancias judiciales relevantes

Aparecen en el campo `juzgado` de los expedientes:

- Juzgados de Primera Instancia (Civil, Penal, Laboral, Familia)
- Salas de Apelaciones (Sala Primera, Segunda, Tercera, etc.)
- Corte Suprema de Justicia (Cámara Civil, Cámara Penal)
- Corte de Constitucionalidad (CC) — para amparos en última instancia

---

*Este documento es de referencia para desarrolladores. No reemplaza
el criterio jurídico de Amanda para cualquier decisión de lógica de negocio.*
