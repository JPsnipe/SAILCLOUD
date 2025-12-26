# Fase 1 — Arquitectura de datos e inventario

Implementa la base “archivador digital” organizada por barco.

## Requisitos
- Barcos con sub-secciones: `Fotos`, `Equipo`, `Inventario`.
- Inventario de velas: formulario con `type`, `name` y `draftStripesPct` **obligatorio** (porcentajes).
- Validaciones:
  - valores en `(0,100)`, sin duplicados, ordenados.
  - mostrar errores de forma clara en UI.
- Inventario de mástiles:
  - `spreadersPct` y `houndsPct` como listas de porcentajes del aparejo.

## Hecho cuando
- CRUD de `Boat`, `Sail`, `MastProfile`, `CrewMember`.
- Persistencia estable (DB o archivos), con migraciones/seed si aplica.

