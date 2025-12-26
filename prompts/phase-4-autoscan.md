# Fase 4 — Herramientas + Auto-Scan

Objetivo: convertir píxeles en datos con herramientas manuales y auto-scan.

## Requisitos
1) Herramientas manuales
- Puntos, líneas, rectángulos y curvas (polilínea o spline).

2) Referencia de longitud
- El usuario define una distancia conocida en la foto (2 puntos + valor real + unidad).
- El sistema calcula escala px→unidad para métricas absolutas.

3) Auto-Scan (servidor de procesamiento)
- Endpoint que recibe:
  - imagen
  - 2 puntos (inicio/fin de una draft stripe o borde)
- Devuelve una polilínea siguiendo el borde detectado.
- Implementación sugerida:
  - OpenCV Canny + búsqueda de camino (coste sobre mapa de bordes)
  - o HED si hay modelo disponible

## Hecho cuando
- Se puede trazar una banda marcando inicio/fin y ajustar manualmente si falla.

