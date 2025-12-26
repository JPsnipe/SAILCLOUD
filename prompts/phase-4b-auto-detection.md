# Fase 4B — Detección Totalmente Automática

## 1) Objetivo

Implementar detección automática de elementos de vela sin intervención del usuario, usando segmentación semántica y ML ligero (TensorFlow.js). El sistema detectará automáticamente la vela, sus bordes (luff/leech), y las draft stripes visibles.

## 2) Contexto del dominio

Referencia: `docs/01-glossary.md`

Esta fase extiende la Fase 4A (semi-automática) para eliminar la necesidad de puntos ancla. El sistema debe:
- Identificar la región de la vela en la imagen
- Detectar automáticamente draft stripes por contraste de color
- Extraer luff y leech sin intervención manual

## 3) Alcance

### Incluye
- Integración de TensorFlow.js (WASM/WebGL backend)
- Modelo de segmentación ligero para detectar región de vela
- Detección de draft stripes por análisis de color/contraste
- Detección automática de luff/leech por geometría
- Fallback a modo semi-automático si confianza < 70%
- Clasificación automática de tipo de escena

### No incluye
- Entrenamiento de modelos custom (usar transfer learning o modelos pre-entrenados)
- Detección de múltiples velas en una imagen
- Tracking de vela en video
- OCR de números de vela

## 4) Datos

### Entidades afectadas

```typescript
// Extensión de PhotoAnalysis
interface PhotoAnalysis {
  sceneType: SceneType
  sailId?: string
  mastId?: string
  layers: PhotoLayer[]

  // NUEVO: Resultado de auto-detección
  autoDetection?: {
    timestamp: string
    modelVersion: string

    // Región de la vela detectada
    sailMask?: {
      boundingBox: { x: number; y: number; width: number; height: number }
      confidence: number
      polygonPoints: NormalizedPoint[]  // Contorno de la vela
    }

    // Draft stripes detectadas automáticamente
    detectedStripes?: Array<{
      estimatedHeightPct: number        // Altura estimada en la vela
      points: NormalizedPoint[]         // Polilínea de la stripe
      confidence: number
      colorSignature: string            // Para matching con stripes definidas
    }>

    // Bordes detectados
    detectedEdges?: {
      luff?: { points: NormalizedPoint[]; confidence: number }
      leech?: { points: NormalizedPoint[]; confidence: number }
      foot?: { points: NormalizedPoint[]; confidence: number }
    }

    // Escena inferida
    inferredSceneType?: {
      type: SceneType
      confidence: number
      alternatives: Array<{ type: SceneType; confidence: number }>
    }
  }
}
```

## 5) Arquitectura técnica

### 5.1 Estructura de archivos

```
apps/desktop/
├── src/
│   └── lib/
│       └── cv/
│           ├── ... (existentes de Fase 4A)
│           │
│           └── ml/
│               ├── index.ts              # Exportaciones
│               ├── tfjs-loader.ts        # Carga TensorFlow.js
│               ├── sail-segmenter.ts     # Segmentación de vela
│               ├── stripe-detector.ts    # Detección de stripes
│               ├── scene-classifier.ts   # Clasificación de escena
│               └── models/
│                   └── README.md         # Instrucciones para modelos
│
├── public/
│   └── models/
│       ├── sail-seg/                     # Modelo de segmentación
│       │   ├── model.json
│       │   └── weights.bin
│       └── scene-classifier/             # Modelo de clasificación
│           ├── model.json
│           └── weights.bin
```

### 5.2 Pipeline de detección

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTO-DETECTION PIPELINE                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. SCENE CLASSIFICATION                                         │
│    ────────────────────                                         │
│    Input: imagen completa                                       │
│    Output: ONBOARD_SAIL | CHASE_SAIL | MAST_BEND | UNKNOWN      │
│    Modelo: MobileNet fine-tuned (ligero)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. SAIL SEGMENTATION                                            │
│    ──────────────────                                           │
│    Input: imagen + tipo de escena                               │
│    Output: máscara binaria de la vela                           │
│    Modelo: U-Net lite o DeepLab Mobile                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. EDGE EXTRACTION                                              │
│    ────────────────                                             │
│    Input: máscara de vela                                       │
│    Output: luff, leech, foot (polilíneas)                       │
│    Algoritmo: Contour detection + clasificación geométrica      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. STRIPE DETECTION                                             │
│    ────────────────                                             │
│    Input: región de vela + imagen original                      │
│    Output: draft stripes detectadas                             │
│    Algoritmo: Color clustering + line detection (Hough)         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. CONFIDENCE CHECK                                             │
│    ────────────────                                             │
│    Si confidence < 70%:                                         │
│      → Fallback a semi-automático (Fase 4A)                     │
│      → Mostrar warning al usuario                               │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 API

```typescript
// === sail-segmenter.ts ===
export interface SegmentationResult {
  mask: ImageData                    // Máscara binaria
  boundingBox: BoundingBox
  contour: NormalizedPoint[]
  confidence: number
}

export async function segmentSail(
  imageData: ImageData
): Promise<SegmentationResult | null>

// === stripe-detector.ts ===
export interface DetectedStripe {
  points: NormalizedPoint[]
  estimatedHeightPct: number
  dominantColor: { h: number; s: number; l: number }
  confidence: number
}

export async function detectStripes(
  imageData: ImageData,
  sailMask: ImageData
): Promise<DetectedStripe[]>

// === scene-classifier.ts ===
export interface ClassificationResult {
  sceneType: SceneType
  confidence: number
  probabilities: Record<SceneType, number>
}

export async function classifyScene(
  imageData: ImageData
): Promise<ClassificationResult>

// === Orquestador principal ===
export interface AutoDetectionInput {
  imagePath: string
  hints?: {
    expectedSceneType?: SceneType
    sailColors?: string[]          // Colores conocidos de las stripes
  }
}

export interface AutoDetectionOutput {
  success: boolean
  sceneType: SceneType
  sailRegion?: SegmentationResult
  edges?: {
    luff?: NormalizedPoint[]
    leech?: NormalizedPoint[]
  }
  stripes?: DetectedStripe[]
  overallConfidence: number
  needsManualReview: boolean
}

export async function runAutoDetection(
  input: AutoDetectionInput
): Promise<AutoDetectionOutput>
```

## 6) Algoritmos específicos

### 6.1 Detección de Draft Stripes

Las draft stripes suelen tener colores distintivos (rojo, azul, negro sobre vela blanca).

```
1. Convertir imagen a HSL dentro de la máscara de vela
2. Aplicar K-means clustering (k=5) para encontrar colores dominantes
3. Filtrar clusters por saturación (stripes suelen ser saturadas)
4. Para cada cluster de color "stripe":
   a. Crear máscara binaria del color
   b. Aplicar Hough Line Transform
   c. Agrupar líneas paralelas cercanas
   d. Extraer polilínea central
5. Ordenar stripes por posición Y (altura en la vela)
6. Estimar heightPct basándose en posición relativa
```

### 6.2 Clasificación de Bordes (Luff vs Leech)

```
1. Extraer contorno de la máscara de vela
2. Encontrar los 3 vértices principales (tack, head, clew)
3. Clasificar por geometría:
   - Luff: borde más vertical (conecta tack→head)
   - Leech: borde posterior (conecta head→clew)
   - Foot: borde inferior (conecta tack→clew)
4. Para ONBOARD_SAIL: luff está cerca del mástil (izquierda típicamente)
5. Para CHASE_SAIL: luff es el borde de barlovento
```

### 6.3 Modelo de Segmentación

Opciones (ordenadas por preferencia):

1. **DeepLab v3 MobileNet** (recomendado)
   - Tamaño: ~8MB
   - Velocidad: ~100ms en WebGL
   - Pre-entrenado en COCO, fine-tune con dataset de velas

2. **U-Net Lite**
   - Tamaño: ~5MB
   - Más simple de entrenar
   - Requiere dataset custom

3. **BodyPix modificado**
   - Ya disponible en TensorFlow.js
   - Requiere adaptación para velas

## 7) Flujo de usuario

### 7.1 Modo automático

1. Usuario importa foto
2. Sistema ejecuta auto-detección en background
3. Al abrir la foto:
   - Si confianza > 70%: muestra resultados automáticos
   - Si confianza < 70%: muestra warning + sugiere modo semi-automático
4. Usuario revisa y ajusta si es necesario
5. Guarda análisis

### 7.2 UI Indicators

```
┌─────────────────────────────────────────────────────────────────┐
│ [📷 Photo Name]                                                  │
│                                                                  │
│ ┌─────────────────────────────────────────┐ ┌─────────────────┐ │
│ │                                         │ │ AUTO-DETECTION  │ │
│ │                                         │ │ ────────────────│ │
│ │          [Photo with overlays]          │ │ Scene: ONBOARD  │ │
│ │                                         │ │ Confidence: 89% │ │
│ │     ~~~~ Detected stripe 1 ~~~~         │ │                 │ │
│ │                                         │ │ ✓ Sail detected │ │
│ │     ~~~~ Detected stripe 2 ~~~~         │ │ ✓ 3 stripes     │ │
│ │                                         │ │ ✓ Luff found    │ │
│ │     ~~~~ Detected stripe 3 ~~~~         │ │ ⚠ Leech unclear │ │
│ │                                         │ │                 │ │
│ └─────────────────────────────────────────┘ │ [Use Results]   │ │
│                                             │ [Manual Mode]   │ │
│                                             └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 8) Consideraciones de rendimiento

### 8.1 Carga de modelos
- Modelos se cargan lazy (primera vez que se usa auto-detection)
- Cachear en IndexedDB para cargas posteriores
- Mostrar progreso de descarga

### 8.2 Inferencia
- Usar WebGL backend cuando esté disponible
- Fallback a WASM si WebGL no funciona
- Procesar en web worker para no bloquear UI
- Target: < 2 segundos para pipeline completo

### 8.3 Tamaño de modelos
- Total de modelos: < 20MB
- Compresión con quantization (int8)

## 9) Criterios de aceptación

### Must Have
- [ ] TensorFlow.js carga correctamente en Electron
- [ ] Clasificación de escena funciona con >80% accuracy en fotos típicas
- [ ] Segmentación detecta la vela en >70% de los casos
- [ ] Fallback a semi-automático cuando confianza es baja
- [ ] Funciona offline después de primera carga de modelos

### Should Have
- [ ] Detección de draft stripes por color
- [ ] Clasificación automática de luff/leech
- [ ] Indicador de confianza por cada elemento detectado
- [ ] Procesamiento en background al importar fotos

### Nice to Have
- [ ] Mejora continua: reentrenar con correcciones del usuario
- [ ] Detección de múltiples velas (ej. génova + mayor)
- [ ] Sugerencia automática de sail ID basada en tipo detectado

## 10) Dataset y entrenamiento

### 10.1 Dataset necesario
Para fine-tuning se necesitan ~500-1000 imágenes anotadas:
- Fotos ONBOARD_SAIL con máscaras de vela
- Fotos CHASE_SAIL con máscaras de vela
- Anotaciones de luff/leech/stripes

### 10.2 Opciones de obtención
1. Anotar manualmente con herramienta como LabelMe
2. Usar datos generados por usuarios (con consentimiento)
3. Generar sintéticamente (3D render de velas)
4. Colaborar con veleros/equipos que compartan datos

### 10.3 Entrenamiento
- Usar Google Colab o similar para entrenar
- Exportar modelo a TensorFlow.js format
- Incluir script de conversión en el repo

## 11) Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| No hay dataset suficiente | Alta | Alto | Empezar con modelo genérico, mejorar con uso |
| Modelos demasiado grandes | Media | Medio | Quantization, pruning, modelos mobile |
| Baja accuracy en fotos reales | Media | Alto | Fallback obligatorio a semi-automático |
| WebGL no disponible | Baja | Medio | Fallback a WASM (más lento pero funciona) |

## 12) Dependencias

```json
{
  "dependencies": {
    "@tensorflow/tfjs": "^4.x",
    "@tensorflow/tfjs-backend-wasm": "^4.x",
    "@tensorflow/tfjs-backend-webgl": "^4.x"
  }
}
```

## 13) Relación con otras fases

- **Requiere**: Fase 4A (usa edge detection como fallback)
- **Habilita**: Fase 5 (métricas automáticas sin intervención)
- **Mejora**: Fase 6 (comparaciones más rápidas con auto-detection)
