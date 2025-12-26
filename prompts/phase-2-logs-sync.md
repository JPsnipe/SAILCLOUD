# Fase 2 — Logs y sincronización temporal

Objetivo: dar contexto de viento a las fotos.

## Requisitos
- Importar CSV/TXT de instrumentación.
- UI de “mapeo de variables”:
  - usuario elige columna de timestamp + formato + zona horaria
  - usuario asigna columnas a `TWS`, `TWA` (mínimo) y opcionales
- Persistir `LogImport` + `LogSample`.
- Sincronización:
  - al crear/registrar una `Photo`, enlazar con el `LogSample` más cercano (por `takenAt`)
  - permitir filtrar fotos por rangos de `TWS`/`TWA`

## Hecho cuando
- Se importa un archivo real y se visualiza una tabla/resumen.
- Las fotos muestran `TWS/TWA` asociados si hay logs.

