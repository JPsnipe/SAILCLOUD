# Prompt de arranque (Vibecoding)

Actúa como arquitecto/desarrollador y construye una app inspirada en “The Sail Cloud” para gestionar barcos, inventario, logs y análisis de velas desde fotos.

## Contexto del dominio (no inventar términos)
- Usa el glosario de `docs/01-glossary.md`.
- Todo análisis de vela se indexa por `heightPct` (draft stripes).

## Reglas de trabajo
- Propón un stack y estructura de carpetas, pero **pide confirmación** antes de bloquear decisiones irreversibles (web vs móvil vs desktop; local-first vs cloud).
- Implementa primero un *MVP* con datos, importación de logs y escenas.
- Define entidades según `docs/02-data-model.md`.

## Entregables por iteración
1) Modelo de datos + persistencia
2) Flujo de “Barco → Vela/Mástil → Fotos → Logs”
3) Primera escena funcional con herramientas manuales

## Criterios de aceptación (mínimos)
- Se puede crear un barco, registrar una vela con `draftStripesPct` obligatorias y un perfil de mástil con `spreadersPct`/`houndsPct`.
- Se puede importar un log (CSV/TXT) y mapear columnas a `TWS/TWA/timestamp`.
- Al añadir una foto, se enlaza automáticamente al `LogSample` más cercano en el tiempo.

