# Plantilla para prompts (Vibecoding)

Usa esta plantilla para pedir a una IA que implemente una parte concreta sin perder el contexto náutico.

## 1) Objetivo (1–2 frases)
- Qué se construye y para qué usuario.

## 2) Contexto del dominio
- Definiciones mínimas (referenciar `docs/01-glossary.md`).
- Convenciones: `heightPct`, `rigHeightPct`, unidades, zona horaria/UTC.

## 3) Alcance
- **Incluye**: lista corta de features.
- **No incluye**: lo que explícitamente queda fuera.

## 4) Datos (fuente de verdad)
- Entidades afectadas (referenciar `docs/02-data-model.md`).
- Reglas/validaciones (porcentajes, duplicados, orden).
- Migraciones/seed si aplica.

## 5) Flujo de usuario
- Pasos UI/UX (pantallas, acciones, estados vacíos/errores).

## 6) API / Integraciones (si aplica)
- Endpoints, payloads, contratos (inputs/outputs).
- Consideraciones de rendimiento (tamaño de imágenes, streaming, colas).

## 7) Criterios de aceptación (checklist)
- “Hecho cuando…” con casos concretos.

## 8) Pruebas
- Unitarias (validaciones/mapping).
- Integración (importación logs, linking foto→log).

