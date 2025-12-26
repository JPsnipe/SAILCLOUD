# Fase 4A — Integración OpenCV.js + AutoScan Real

## 1) Objetivo

Implementar detección automática de bordes en fotografías de velas usando OpenCV.js (WebAssembly), permitiendo que el usuario marque 2 puntos ancla y el sistema trace automáticamente el borde óptimo entre ellos. Esta fase reemplaza el demo actual de interpolación lineal con edge detection real.

## 2) Contexto del dominio

Referencia: `docs/01-glossary.md`

- **Draft stripes**: bandas horizontales en la vela que sirven como referencia visual para medir la forma
- **Luff (grátil)**: borde delantero de la vela, conectado al mástil o estay
- **Leech (baluma)**: borde de salida de la vela
- **Camber/Depth**: profundidad de la curva de la vela expresada como % de la cuerda
- **heightPct**: altura normalizada en la vela (0% = puño de amura, 100% = puño de driza)

El AutoScan debe detectar estos elementos en fotografías para extraer métricas cuantificables.

## 3) Alcance

### Incluye
- Integración de OpenCV.js (build WASM) en el proyecto Electron
- Módulo de edge detection usando algoritmo Canny
- Path finding (A* o Dijkstra) sobre mapa de bordes
- API interna para invocar AutoScan desde React
- Reemplazo del demo actual en `PhotoMeasurePage.tsx`
- Soporte para las 3 escenas principales:
  - `ONBOARD_SAIL`: detectar draft stripes
  - `CHASE_SAIL_*`: detectar luff y leech
  - `MAST_BEND_*`: detectar perfil del mástil

### No incluye
- Detección totalmente automática sin puntos ancla (FASE 4B)
- Machine Learning / redes neuronales (FASE 4B)
- Cálculo de métricas náuticas (FASE 5 - Métricas)
- Segmentación semántica de la vela

## 4) Datos

### Entidades afectadas
Referencia: `docs/02-data-model.md`

```typescript
// Extensión de PhotoLayer para almacenar resultado de AutoScan
interface PhotoLayer {
  id: string
  label: string
  tool: 'POINTS' | 'POLYLINE'
  points: NormalizedPoint[]

  // Campos AutoScan existentes
  autoScanEnabled?: boolean
  autoScanAnchors?: NormalizedPoint[]  // Los 2 puntos marcados por el usuario

  // NUEVO: Resultado del scan
  autoScanResult?: {
    success: boolean
    confidence: number           // 0-1, qué tan bueno fue el match
    algorithm: 'CANNY_ASTAR'     // Para trazabilidad
    parameters: CannyParameters  // Parámetros usados
    rawPoints: NormalizedPoint[] // Puntos antes de suavizado
    timestamp: string            // ISO8601
  }
}

interface CannyParameters {
  threshold1: number  // Umbral bajo (típico: 50-100)
  threshold2: number  // Umbral alto (típico: 150-200)
  apertureSize: 3 | 5 | 7
  L2gradient: boolean
}
```

### Validaciones
- `autoScanAnchors` debe tener exactamente 2 puntos cuando `autoScanEnabled` es true
- `confidence` debe estar en rango [0, 1]
- Coordenadas normalizadas (x, y) en rango [0, 1]

## 5) Arquitectura técnica

### 5.1 Estructura de archivos

```
apps/desktop/
├── src/
│   └── lib/
│       └── cv/
│           ├── index.ts              # Exportaciones públicas
│           ├── opencv-loader.ts      # Carga async de OpenCV.js
│           ├── edge-detector.ts      # Canny edge detection
│           ├── path-finder.ts        # A* sobre mapa de bordes
│           ├── autoscan.ts           # Orquestador principal
│           ├── image-utils.ts        # Helpers (resize, grayscale, etc.)
│           └── types.ts              # Tipos TypeScript
│
├── public/
│   └── opencv/
│       ├── opencv.js                 # Build WASM de OpenCV.js
│       └── opencv_js.wasm            # Binario WASM
│
└── electron/
    └── ipc.ts                        # Handler IPC para AutoScan
```

### 5.2 Flujo de datos

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ React Component │───▶│ IPC Bridge      │───▶│ OpenCV.js       │
│ (PhotoMeasure)  │    │ (Renderer→Main) │    │ (WASM in Main)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                      │                      │
        │ 1. Imagen + Anchors  │                      │
        │─────────────────────▶│                      │
        │                      │ 2. Leer imagen       │
        │                      │─────────────────────▶│
        │                      │                      │
        │                      │ 3. Canny + A*        │
        │                      │◀─────────────────────│
        │                      │                      │
        │ 4. Polilínea result  │                      │
        │◀─────────────────────│                      │
```

### 5.3 API Interna

```typescript
// === opencv-loader.ts ===
export async function loadOpenCV(): Promise<void>
export function isOpenCVReady(): boolean

// === autoscan.ts ===
export interface AutoScanInput {
  imagePath: string              // Ruta absoluta a la imagen
  startPoint: NormalizedPoint    // Punto ancla 1 (normalizado)
  endPoint: NormalizedPoint      // Punto ancla 2 (normalizado)
  parameters?: Partial<CannyParameters>
}

export interface AutoScanOutput {
  success: boolean
  points: NormalizedPoint[]      // Polilínea detectada
  confidence: number             // 0-1
  error?: string                 // Si success=false
  debugInfo?: {
    edgeMapBase64?: string       // Para visualización de debug
    pathCost: number
    pointCount: number
  }
}

export async function runAutoScan(input: AutoScanInput): Promise<AutoScanOutput>

// === edge-detector.ts ===
export interface EdgeMap {
  width: number
  height: number
  data: Uint8Array               // 0=no edge, 255=edge
}

export function detectEdges(
  imageData: ImageData,
  params: CannyParameters
): EdgeMap

// === path-finder.ts ===
export function findPath(
  edgeMap: EdgeMap,
  start: { x: number; y: number },  // Coordenadas en píxeles
  end: { x: number; y: number },
  options?: {
    maxIterations?: number
    smoothing?: boolean
    simplifyTolerance?: number
  }
): { x: number; y: number }[]
```

### 5.4 Handler IPC (Electron)

```typescript
// electron/ipc.ts - Nuevo handler
ipcMain.handle('autoscan:run', async (_event, input: AutoScanInput) => {
  try {
    // 1. Cargar OpenCV si no está listo
    if (!isOpenCVReady()) {
      await loadOpenCV()
    }

    // 2. Ejecutar AutoScan
    const result = await runAutoScan(input)

    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
```

### 5.5 Integración en preload.ts

```typescript
// Añadir a SailcloudApi
type SailcloudApi = {
  // ... existentes ...

  // NUEVO
  runAutoScan(input: AutoScanInput): Promise<AutoScanOutput>
}

// En preload.ts
runAutoScan: (input) => ipcRenderer.invoke('autoscan:run', input)
```

## 6) Algoritmo de AutoScan

### 6.1 Edge Detection (Canny)

```
1. Cargar imagen desde disco
2. Convertir a grayscale
3. Aplicar Gaussian blur (reduce ruido)
4. Canny edge detection:
   - threshold1: 50 (umbral bajo)
   - threshold2: 150 (umbral alto)
   - apertureSize: 3
5. Resultado: mapa binario de bordes (EdgeMap)
```

### 6.2 Path Finding (A*)

```
1. Convertir puntos ancla normalizados → coordenadas píxel
2. Crear grafo de costes desde EdgeMap:
   - Coste bajo (1) si el píxel es borde (255)
   - Coste alto (100) si el píxel NO es borde
3. Ejecutar A* desde punto inicial a punto final
4. El camino resultante sigue los bordes detectados
5. Aplicar simplificación (Douglas-Peucker) para reducir puntos
6. Normalizar coordenadas de vuelta a [0,1]
```

### 6.3 Cálculo de confianza

```typescript
function calculateConfidence(path: Point[], edgeMap: EdgeMap): number {
  let edgePixels = 0
  for (const point of path) {
    if (edgeMap.data[point.y * edgeMap.width + point.x] > 128) {
      edgePixels++
    }
  }
  return edgePixels / path.length  // % de puntos sobre bordes reales
}
```

## 7) Flujo de usuario

### 7.1 Activar AutoScan en una capa

1. Usuario está en `PhotoMeasurePage` con una foto abierta
2. Selecciona una capa (ej. "Stripe 1 (25%)")
3. Activa modo "AutoScan" (toggle existente)
4. Hace click en 2 puntos de la imagen (inicio y fin del borde)
5. Pulsa botón "RUN SCANNER"
6. **NUEVO**: Sistema ejecuta edge detection + path finding
7. La polilínea resultante aparece en la capa
8. Usuario puede ajustar manualmente si el resultado no es perfecto
9. Guarda el análisis

### 7.2 Estados de UI

| Estado | Indicador visual |
|--------|------------------|
| OpenCV cargando | Spinner + "Loading CV engine..." |
| Listo para scan | Botón "RUN SCANNER" habilitado |
| Procesando | Spinner + "Detecting edges..." |
| Éxito (alta confianza) | Polilínea verde + badge "95% match" |
| Éxito (baja confianza) | Polilínea amarilla + warning "Review manually" |
| Error | Toast rojo + mensaje de error |

### 7.3 Parámetros ajustables (opcional/avanzado)

Si la detección falla, el usuario puede ajustar:
- **Sensibilidad**: slider que modifica threshold1/threshold2
- **Suavizado**: toggle para aplicar más/menos smoothing

## 8) Consideraciones de rendimiento

### 8.1 Carga de OpenCV.js
- El build WASM de OpenCV.js pesa ~8MB
- Carga lazy: solo se descarga cuando el usuario accede a AutoScan por primera vez
- Cachear en memoria después de la primera carga

### 8.2 Procesamiento de imágenes
- Redimensionar imágenes grandes antes de procesar (max 2048px en el lado mayor)
- El procesamiento ocurre en el proceso principal de Electron (no bloquea UI)
- Timeout de 30 segundos para evitar bloqueos

### 8.3 Memoria
- Liberar matrices OpenCV después de cada operación (`mat.delete()`)
- No mantener EdgeMaps en memoria entre operaciones

## 9) Criterios de aceptación

### Must Have
- [ ] OpenCV.js se carga correctamente en Electron (sin errores de WASM)
- [ ] Al marcar 2 puntos y ejecutar AutoScan, se obtiene una polilínea (no una línea recta)
- [ ] La polilínea sigue visualmente el borde de la vela/mástil en la foto
- [ ] El resultado se guarda correctamente en `PhotoLayer.points`
- [ ] El usuario puede editar manualmente la polilínea después del AutoScan
- [ ] Funciona offline (sin conexión a internet)

### Should Have
- [ ] Indicador de confianza visible (% match)
- [ ] Warning cuando la confianza es baja (<70%)
- [ ] Parámetros ajustables (sensibilidad) para casos difíciles
- [ ] Timeout y manejo de errores si OpenCV falla

### Nice to Have
- [ ] Visualización del mapa de bordes (debug mode)
- [ ] Presets de parámetros por tipo de escena
- [ ] Historial de parámetros usados por foto

## 10) Pruebas

### 10.1 Unitarias
- `edge-detector.ts`: test con imagen sintética (líneas conocidas)
- `path-finder.ts`: test con mapa de bordes simple (grid)
- Validación de coordenadas normalizadas

### 10.2 Integración
- Carga de OpenCV.js en entorno Electron
- Flujo completo: imagen real → AutoScan → polilínea guardada
- Rendimiento: procesar imagen 4000x3000 en <5 segundos

### 10.3 Imágenes de prueba sugeridas
- Foto ONBOARD_SAIL con draft stripes claros
- Foto CHASE_SAIL con luff/leech definidos
- Foto con bajo contraste (caso límite)
- Foto con mucho ruido (caso límite)

## 11) Dependencias

### NPM
```json
{
  "devDependencies": {
    "@anthropic-ai/claude-code": "^1.0.0"
  }
}
```

### OpenCV.js Build
- Descargar build WASM desde: https://docs.opencv.org/4.x/opencv.js
- O compilar custom build con solo módulos necesarios (imgproc, core)

## 12) Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| OpenCV.js no carga en Electron | Media | Alto | Test temprano, fallback a Worker |
| Edge detection pobre en fotos reales | Media | Alto | Parámetros ajustables, modo manual como fallback |
| Rendimiento lento en imágenes grandes | Baja | Medio | Redimensionar antes de procesar |
| WASM no soportado en algún sistema | Baja | Alto | Requerir Chrome/Electron reciente |

## 13) Siguiente fase (4B)

Una vez completada esta fase, la siguiente (4B) añadirá:
- Detección totalmente automática sin puntos ancla
- Segmentación de la vela usando TensorFlow.js
- Detección automática de draft stripes por color/contraste
