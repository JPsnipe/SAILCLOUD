# Fase 6 — Visualización y Comparación

## 1) Objetivo

Permitir comparar métricas entre múltiples fotos/configuraciones, visualizar tendencias, y generar reportes PDF profesionales. Esta fase convierte SailCloud de una herramienta de medición a una plataforma de análisis y optimización.

## 2) Contexto del dominio

La comparación es fundamental para:
- **Optimización de trimado**: comparar misma vela en diferentes condiciones
- **Desarrollo de velas**: comparar diseños o generaciones de velas
- **Análisis de regatas**: revisar configuraciones de diferentes legs
- **Colaboración**: compartir análisis con veleros, entrenadores, diseñadores

Métricas típicas a comparar:
- Camber y draft position a diferentes TWS/TWA
- Twist en ceñida vs través
- Mast bend con diferentes tensiones de estay

## 3) Alcance

### Incluye
- Vista de comparación lado a lado (2-4 fotos)
- Overlay de gráficas de múltiples fotos
- Filtros por condiciones (TWS, TWA, vela, fecha)
- Timeline de evolución de métricas
- Generación de reportes PDF
- Dashboard resumen por barco
- Notas colaborativas en fotos

### No incluye
- Sincronización cloud entre usuarios
- Análisis predictivo / ML
- Integración con software de diseño de velas
- Video analysis

## 4) Datos

### Nuevas entidades

```typescript
// Comparación guardada
interface Comparison {
  id: string
  boatId: string
  name: string
  description?: string
  photoIds: string[]             // Fotos incluidas (2-4)
  metrics: MetricType[]          // Métricas a comparar
  filters?: ComparisonFilters
  createdAt: string
  updatedAt: string
}

interface ComparisonFilters {
  twsRange?: [number, number]    // Rango de TWS
  twaRange?: [number, number]    // Rango de TWA
  sailIds?: string[]             // Velas específicas
  dateRange?: [string, string]   // Rango de fechas
  sceneTypes?: SceneType[]
}

// Reporte generado
interface Report {
  id: string
  boatId: string
  generatedAt: string
  path: string                   // Ruta al PDF
  title: string
  inputs: {
    photoIds: string[]
    comparisonId?: string
    includeRawData: boolean
    includeCharts: boolean
    includePhotos: boolean
  }
}

// Nota colaborativa (existente en data-model)
interface Note {
  id: string
  photoId: string
  authorId: string               // CrewMember ID
  body: string
  position?: NormalizedPoint     // Posición en la foto (opcional)
  createdAt: string
  updatedAt?: string
}
```

### Extensión de Photo

```typescript
interface Photo {
  // ... existentes ...

  // NUEVO: Metadatos de condiciones
  conditions?: {
    tws?: number                 // True Wind Speed (kts)
    twa?: number                 // True Wind Angle (°)
    aws?: number                 // Apparent Wind Speed
    awa?: number                 // Apparent Wind Angle
    sog?: number                 // Speed Over Ground
    logSampleId?: string         // Referencia a LogSample (Fase 2)
  }

  // Notas
  notes?: Note[]
}
```

## 5) Arquitectura técnica

### 5.1 Estructura de archivos

```
apps/desktop/
├── src/
│   ├── pages/
│   │   ├── ComparisonPage.tsx            # Vista de comparación
│   │   ├── DashboardPage.tsx             # Dashboard del barco
│   │   └── ReportPreviewPage.tsx         # Preview de reporte
│   │
│   ├── components/
│   │   ├── comparison/
│   │   │   ├── PhotoGrid.tsx             # Grid de fotos lado a lado
│   │   │   ├── MetricOverlayChart.tsx    # Gráfica con múltiples series
│   │   │   ├── ComparisonFilters.tsx     # Filtros de condiciones
│   │   │   ├── PhotoSelector.tsx         # Selector de fotos a comparar
│   │   │   └── DeltaTable.tsx            # Tabla de diferencias
│   │   │
│   │   ├── dashboard/
│   │   │   ├── MetricsSummary.tsx        # Resumen de métricas
│   │   │   ├── ConditionsHeatmap.tsx     # Heatmap TWS x TWA
│   │   │   ├── TimelineChart.tsx         # Evolución temporal
│   │   │   └── SailUsageStats.tsx        # Stats por vela
│   │   │
│   │   ├── report/
│   │   │   ├── ReportBuilder.tsx         # Configurador de reporte
│   │   │   ├── ReportPreview.tsx         # Preview antes de generar
│   │   │   └── PdfGenerator.tsx          # Generación de PDF
│   │   │
│   │   └── notes/
│   │       ├── NoteEditor.tsx            # Editor de nota
│   │       ├── NoteOverlay.tsx           # Notas sobre foto
│   │       └── NoteList.tsx              # Lista de notas
│   │
│   └── lib/
│       ├── comparison/
│       │   ├── comparator.ts             # Lógica de comparación
│       │   ├── delta.ts                  # Cálculo de diferencias
│       │   └── filters.ts                # Aplicación de filtros
│       │
│       └── report/
│           ├── pdf-generator.ts          # Generador de PDF
│           ├── chart-renderer.ts         # Render de gráficas para PDF
│           └── templates/                # Templates de reportes
│               ├── basic.ts
│               └── detailed.ts
```

### 5.2 Nuevas rutas

```typescript
// React Router
const routes = [
  // ... existentes ...

  // Comparación
  { path: '/boats/:boatId/compare', element: <ComparisonPage /> },
  { path: '/boats/:boatId/compare/:comparisonId', element: <ComparisonPage /> },

  // Dashboard
  { path: '/boats/:boatId/dashboard', element: <DashboardPage /> },

  // Reportes
  { path: '/boats/:boatId/reports', element: <ReportsListPage /> },
  { path: '/boats/:boatId/reports/new', element: <ReportBuilderPage /> },
  { path: '/boats/:boatId/reports/:reportId', element: <ReportPreviewPage /> },
]
```

## 6) Vistas de comparación

### 6.1 Side-by-Side Photos

```
┌─────────────────────────────────────────────────────────────────┐
│ COMPARISON: Upwind Setup Analysis                    [Save] [×] │
├─────────────────────────────────────────────────────────────────┤
│ Filters: TWS 12-16kts | Main Sail | Scene: ONBOARD_SAIL        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │                 │  │                 │  │                 │  │
│  │   [Photo 1]     │  │   [Photo 2]     │  │   [Photo 3]     │  │
│  │                 │  │                 │  │                 │  │
│  │  ~~~stripe~~~   │  │  ~~~stripe~~~   │  │  ~~~stripe~~~   │  │
│  │                 │  │                 │  │                 │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│   12 kts / 32°        14 kts / 35°        16 kts / 38°         │
│   Camber: 14.2%       Camber: 12.8%       Camber: 11.5%        │
│   Draft:  42%         Draft:  44%         Draft:  46%          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Overlay Chart

```
┌─────────────────────────────────────────────────────────────────┐
│ METRIC COMPARISON: Camber vs Height                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Camber %                                                        │
│     16% ┤                                                        │
│         │  ●───────●                                             │
│     14% ┤  ▲───────▲───────●                                     │
│         │  ■───────■───────▲───────●                             │
│     12% ┤          ■───────▲                                     │
│         │                  ■                                     │
│     10% ┤                                                        │
│         │                                                        │
│      8% ┤                                                        │
│         └────────────────────────────────────                    │
│          25%      50%      75%      100%   Height                │
│                                                                  │
│  Legend: ● 12kts  ▲ 14kts  ■ 16kts                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Delta Table

```
┌─────────────────────────────────────────────────────────────────┐
│ DIFFERENCES (Photo 2 vs Photo 1)                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Height    Camber Δ     Draft Δ      Twist Δ                    │
│  ──────    ────────     ───────      ───────                    │
│   25%      -1.4%        +2%          +0.5°                      │
│   50%      -1.2%        +3%          +1.2°                      │
│   75%      -0.8%        +4%          +2.1°                      │
│                                                                  │
│  Summary: Flatter sail with aft draft, more twist               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 7) Dashboard

### 7.1 Componentes del dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│ BOAT DASHBOARD: "Sailing Yacht Name"                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐   │
│  │ PHOTOS ANALYZED         │  │ CONDITIONS COVERAGE         │   │
│  │ ─────────────────       │  │ ───────────────────         │   │
│  │  Total: 47              │  │                             │   │
│  │  With metrics: 38       │  │  TWS  8│  ■ ■ ■ ░ ░        │   │
│  │  This month: 12         │  │     12│  ■ ■ ■ ■ ░        │   │
│  │                         │  │     16│  ░ ■ ■ ■ ░        │   │
│  │  By sail:               │  │     20│  ░ ░ ░ ░ ░        │   │
│  │   Main: 28              │  │        └──────────────      │   │
│  │   Jib: 15               │  │        30° 40° 50° TWA      │   │
│  │   Spi: 4                │  │  ■ = data  ░ = no data     │   │
│  └─────────────────────────┘  └─────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ CAMBER EVOLUTION (Main sail, upwind)                     │   │
│  │ ──────────────────────────────────────                   │   │
│  │                                                          │   │
│  │  14% │    ●     ●                                        │   │
│  │      │  ●   ● ●   ●  ●                                   │   │
│  │  12% │              ●  ●  ●                              │   │
│  │      │                                                   │   │
│  │  10% │                                                   │   │
│  │      └──────────────────────────────────────────         │   │
│  │       Jan    Feb    Mar    Apr    May   (2024)           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Heatmap de condiciones

Muestra cobertura de datos por TWS × TWA:
- Verde: datos disponibles
- Amarillo: pocos datos
- Rojo/gris: sin datos

Útil para identificar gaps en el análisis.

## 8) Generación de reportes PDF

### 8.1 Contenido del reporte

```
┌─────────────────────────────────────────────────────────────────┐
│                         SAIL ANALYSIS REPORT                     │
│                         ═══════════════════                     │
│                                                                  │
│  Boat: "Racing Yacht"                                           │
│  Date: 2024-03-15                                               │
│  Sail: Main #2                                                  │
│  Conditions: TWS 12-14kts, TWA 35-40°                          │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. SUMMARY                                                      │
│  ──────────                                                     │
│  Photos analyzed: 5                                             │
│  Average camber: 13.2%                                          │
│  Average draft position: 44%                                    │
│  Twist range: 5-8°                                              │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  2. CAMBER PROFILE                                              │
│  ─────────────────                                              │
│                                                                  │
│  [Chart: Camber vs Height for all photos]                       │
│                                                                  │
│  Observations:                                                  │
│  - Consistent depth in lower sections                           │
│  - Top section (75%+) showing reduced depth                     │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  3. PHOTO EVIDENCE                                              │
│  ─────────────────                                              │
│                                                                  │
│  [Photo 1 with overlays]    [Photo 2 with overlays]             │
│  12kts / 35°                14kts / 38°                         │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  4. RAW DATA                                                    │
│  ───────────                                                    │
│                                                                  │
│  | Photo | Height | Camber | Draft Pos | Twist |                │
│  |-------|--------|--------|-----------|-------|                │
│  | #1    | 25%    | 14.2%  | 42%       | 0°    |                │
│  | #1    | 50%    | 13.1%  | 44%       | 3.2°  |                │
│  | ...   | ...    | ...    | ...       | ...   |                │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Generated by SailCloud                                         │
│  https://thesailcloud.com                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Tecnología de generación

```typescript
// Opciones para generación de PDF

// Opción 1: jsPDF + html2canvas (client-side)
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// Opción 2: Puppeteer en proceso Electron (más control)
// Genera desde HTML template

// Opción 3: React-PDF (renderiza React a PDF)
import { Document, Page, Text, Image } from '@react-pdf/renderer'
```

Recomendación: **React-PDF** para control total del layout sin depender de renderizado HTML.

### 8.3 API de generación

```typescript
interface ReportConfig {
  title: string
  photoIds: string[]
  sections: ReportSection[]
  style: 'basic' | 'detailed' | 'presentation'
  includeRawData: boolean
  includePhotos: boolean
  pageSize: 'A4' | 'letter'
}

type ReportSection =
  | { type: 'summary' }
  | { type: 'chart'; metric: MetricType; title: string }
  | { type: 'photos'; layout: 'grid' | 'list' }
  | { type: 'data-table'; metrics: MetricType[] }
  | { type: 'notes' }
  | { type: 'custom'; content: string }

async function generateReport(
  boatId: string,
  config: ReportConfig
): Promise<{ path: string; report: Report }>
```

## 9) Notas colaborativas

### 9.1 Funcionalidad

- Agregar notas a cualquier foto
- Notas pueden estar ancladas a un punto específico de la imagen
- Autor identificado por CrewMember
- Timestamps de creación/edición
- Formato markdown básico

### 9.2 UI

```
┌─────────────────────────────────────────────────────────────────┐
│ [Photo with note indicators]                                     │
│                                                                  │
│     ●──────────────────────────────────────┐                    │
│     │ "Notice the luff hook at 75% -       │                    │
│     │  needs halyard tension adjustment"   │                    │
│     │                        - John, Mar 15│                    │
│     └──────────────────────────────────────┘                    │
│                                                                  │
│           ●────────────────────┐                                │
│           │ "Good entry angle" │                                │
│           │         - Sarah    │                                │
│           └────────────────────┘                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 10) Criterios de aceptación

### Must Have
- [ ] Vista de comparación lado a lado (2+ fotos)
- [ ] Overlay de gráficas con múltiples series
- [ ] Tabla de diferencias entre fotos
- [ ] Generación de PDF básico con gráficas y datos
- [ ] Notas en fotos con autor

### Should Have
- [ ] Filtros por condiciones (TWS, TWA, fecha)
- [ ] Dashboard con resumen de métricas
- [ ] Heatmap de cobertura de condiciones
- [ ] Comparaciones guardadas
- [ ] Templates de reportes

### Nice to Have
- [ ] Timeline de evolución temporal
- [ ] Exportar comparación como imagen
- [ ] Notas ancladas a puntos específicos
- [ ] Colaboración en tiempo real (si hay backend)

## 11) Flujo de usuario

### 11.1 Crear comparación

1. Usuario va a "Compare" desde el detalle del barco
2. Selecciona 2-4 fotos
3. Aplica filtros opcionales (TWS, vela, etc.)
4. Sistema muestra comparación lado a lado
5. Usuario alterna entre vistas (photos, chart overlay, delta table)
6. Opcionalmente guarda la comparación

### 11.2 Generar reporte

1. Usuario va a "Reports" → "New Report"
2. Selecciona fotos o comparación existente
3. Configura secciones del reporte
4. Preview del PDF
5. Genera y descarga PDF
6. PDF se guarda en carpeta `reports/` del barco

## 12) Consideraciones técnicas

### 12.1 Performance
- Lazy load de fotos en grid de comparación
- Cachear renders de gráficas
- Generar PDFs en proceso separado (no bloquear UI)

### 12.2 Storage
- Reportes PDF en `{boatFolder}/reports/`
- Comparaciones guardadas en `boat.json`
- Thumbnails para previews

## 13) Dependencias

```json
{
  "dependencies": {
    "@react-pdf/renderer": "^3.x",    // Generación de PDF
    "recharts": "^2.x",                // Gráficas
    "date-fns": "^3.x"                 // Manejo de fechas
  }
}
```

## 14) Relación con otras fases

- **Requiere**: Fase 5 (métricas calculadas)
- **Complementa**: Fase 2 (condiciones de log)
- **Opcional**: Backend para colaboración real-time (fuera de scope MVP)
