# Fase 3 — Motor de medición (Escenas)

Objetivo: permitir elegir qué medir y capturar mediciones por escena.

## Requisitos
- Selector de `sceneType` al abrir una foto.
- Cada escena define:
  - herramientas disponibles (puntos/líneas/curvas)
  - inputs requeridos (ej. draft stripes, horizonte, referencia de longitud)
  - métricas a guardar en `Measurement`

## Hecho cuando
- Al menos 1 escena (recomendado: `ONBOARD_SAIL`) permite:
  - marcar elementos manualmente
  - guardar `Measurement` por `heightPct`
  - graficar resultado vs altura

