# Modelo de datos (mínimo viable)

Este modelo describe *qué* hay que almacenar; la implementación puede ser DB + almacenamiento de objetos/archivos.

## Convenciones
- **Tiempos**: almacenar timestamps en **UTC** y conservar `timezone` (por barco/importación/foto) para visualización y depuración.
- **Alturas**: mediciones de vela usan `heightPct` (0–100) y herrajes de mástil usan `rigHeightPct` (0–100).

## Entidades

### Barco (`Boat`)
- `id`
- `name`
- `timezone` (ej. `Europe/Madrid`)
- `createdAt`

### Miembro de equipo (`CrewMember`)
- `id`
- `boatId`
- `name`
- `role` (opcional)

### Vela (`Sail`)
- `id`
- `boatId`
- `type` (`MAIN` | `JIB` | `SPI` | otros)
- `name`
- `draftStripesPct`: lista ordenada de porcentajes (ej. `[25,50,75]`)
- `notes` (opcional)

**Reglas**:
- `draftStripesPct` es obligatorio y debe estar en `(0,100)`, sin duplicados y ordenado ascendente.

### Perfil de mástil (`MastProfile`)
- `id`
- `boatId`
- `name`
- `rigHeight` (opcional, unidad definida por el sistema)
- `spreadersPct`: lista (ej. `[45, 65]`)
- `houndsPct`: lista (ej. `[80]`)
- `notes` (opcional)

**Reglas**:
- `spreadersPct`/`houndsPct` en `(0,100)` y ordenado ascendente.

### Importación de log (`LogImport`)
- `id`
- `boatId`
- `sourceFileName`
- `sourceFormat` (`CSV` | `TXT`)
- `timezone`
- `mapping` (cómo mapear columnas → variables)
- `createdAt`

### Muestra de log (`LogSample`)
- `id`
- `logImportId`
- `ts` (timestamp)
- `tws` (opcional)
- `twa` (opcional)
- `aws`/`awa`/`sog`/`cog`/... (opcionales)

### Foto (`Photo`)
- `id`
- `boatId`
- `path` (ruta local o clave en storage)
- `takenAt`
- `timezone` (opcional si `takenAt` ya es UTC)
- `sceneType` (`ONBOARD_SAIL` | `CHASE_SAIL` | `MAST_BEND` | `RAKE_HEEL`)
- `logSampleId` (opcional; referencia al sample más cercano)

### Medición (`Measurement`)
- `id`
- `photoId`
- `metric` (ej. `CAMBER_PCT`, `DRAFT_POS_PCT`, `TWIST_DEG`, `FORESTAY_SAG_MM`)
- `heightPct` (opcional; para métricas por banda)
- `value`
- `unit` (`PCT` | `DEG` | `MM` | `M` | etc.)
- `payload` (opcional: puntos/curva normalizada, parámetros de ajuste, etc.)

### Anotación / Nota (`Note`)
- `id`
- `photoId`
- `authorId`
- `body`
- `createdAt`

### Reporte (`Report`)
- `id`
- `boatId`
- `generatedAt`
- `path` (archivo PDF o similar)
- `inputs` (fotos/mediciones incluidas)

## Mapeo de variables (ejemplo)
Ejemplo conceptual de `mapping` para importar logs:

```json
{
  "timestamp": { "column": "time", "format": "ISO8601" },
  "tws": { "column": "TWS", "unit": "kn" },
  "twa": { "column": "TWA", "unit": "deg" }
}
```
