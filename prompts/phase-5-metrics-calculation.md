# Fase 5 — Cálculo de Métricas Náuticas

## 1) Objetivo

Convertir las polilíneas detectadas (manual o automáticamente) en métricas náuticas cuantificables: camber, draft position, twist, forestay sag, mast bend, heel y rake. Estas métricas se almacenan en la entidad `Measurement` y se visualizan gráficamente.

## 2) Contexto del dominio

Referencia: `docs/01-glossary.md`, `docs/03-scenes.md`

### Métricas por escena

| Escena | Métricas a calcular |
|--------|---------------------|
| ONBOARD_SAIL | Camber %, Draft Position %, Twist ° |
| CHASE_SAIL_UPWIND | Luff Curve, Leech Curve, Entry Angle, Exit Angle |
| CHASE_SAIL_DOWNWIND | Proyección, Depth % |
| MAST_BEND_FORE_AFT | Bend mm (longitudinal) vs height |
| MAST_BEND_LATERAL | Bend mm (lateral) vs height |
| HEEL | Heel angle ° |
| RAKE | Rake angle ° |

### Definiciones clave

- **Camber (Depth)**: Profundidad máxima de la curva de la sección, expresada como % de la cuerda
- **Draft Position**: Posición del punto de máxima profundidad, expresada como % desde el luff
- **Twist**: Diferencia de ángulo entre secciones a diferentes alturas
- **Entry Angle**: Ángulo del luff respecto al eje del barco
- **Exit Angle**: Ángulo del leech respecto al flujo de aire

## 3) Alcance

### Incluye
- Motor de cálculo de métricas desde polilíneas
- Cálculo por stripe/sección (usando heightPct de la vela)
- Referencia de longitud para métricas absolutas (mm, m)
- Almacenamiento en entidad Measurement
- Gráficas 2D: métrica vs altura
- Superposición visual sobre la foto
- Export de datos (CSV, JSON)

### No incluye
- Comparación entre fotos (Fase 6)
- Análisis temporal/tendencias
- Recomendaciones automáticas de trimado
- Integración con datos de logs (Fase 2)

## 4) Datos

### Entidad Measurement (existente, extendida)

```typescript
// De docs/02-data-model.md
interface Measurement {
  id: string
  photoId: string
  metric: MetricType
  heightPct: number              // Altura en la vela (0-100)
  value: number                  // Valor calculado
  unit: string                   // %, °, mm, m
  payload?: Record<string, any>  // Datos adicionales
  createdAt: string
  updatedAt: string
}

// Tipos de métrica
type MetricType =
  // Vela
  | 'CAMBER_PCT'           // Profundidad %
  | 'DRAFT_POS_PCT'        // Posición del draft %
  | 'TWIST_DEG'            // Torsión °
  | 'ENTRY_ANGLE_DEG'      // Ángulo de entrada °
  | 'EXIT_ANGLE_DEG'       // Ángulo de salida °
  | 'CHORD_LENGTH'         // Longitud de cuerda (con referencia)

  // Mástil
  | 'MAST_BEND_FORE_AFT'   // Flexión proa-popa mm
  | 'MAST_BEND_LATERAL'    // Flexión lateral mm

  // Barco
  | 'HEEL_DEG'             // Escora °
  | 'RAKE_DEG'             // Inclinación del mástil °

  // Curvas completas (payload contiene la polilínea)
  | 'LUFF_CURVE'           // Perfil del luff
  | 'LEECH_CURVE'          // Perfil del leech
  | 'FORESTAY_SAG'         // Catenaria del estay
```

### Extensión de PhotoAnalysis

```typescript
interface PhotoAnalysis {
  // ... existentes ...

  // NUEVO: Métricas calculadas
  measurements?: Measurement[]

  // Referencia de escala
  lengthReference?: {
    pixelDistance: number        // Distancia en píxeles
    realValue: number            // Valor real
    unit: 'mm' | 'm' | 'ft'      // Unidad
    points: [NormalizedPoint, NormalizedPoint]  // Los 2 puntos de referencia
  }

  // Cuerda de referencia (para camber)
  chordDefinition?: {
    luffPoint: NormalizedPoint   // Punto en el luff
    leechPoint: NormalizedPoint  // Punto en el leech
  }
}
```

## 5) Arquitectura técnica

### 5.1 Estructura de archivos

```
apps/desktop/
├── src/
│   └── lib/
│       └── metrics/
│           ├── index.ts                  # Exportaciones
│           ├── types.ts                  # Tipos de métricas
│           ├── calculator.ts             # Motor de cálculo
│           ├── camber.ts                 # Cálculo de camber/draft
│           ├── twist.ts                  # Cálculo de twist
│           ├── mast-bend.ts              # Cálculo de flexión
│           ├── angles.ts                 # Heel, rake, entry, exit
│           ├── scale.ts                  # Conversión px → unidades reales
│           └── geometry.ts               # Utilidades geométricas
│
│   └── components/
│       └── metrics/
│           ├── MetricsPanel.tsx          # Panel de resultados
│           ├── MetricChart.tsx           # Gráfica 2D
│           ├── MetricOverlay.tsx         # Superposición en foto
│           └── MetricExport.tsx          # Exportación
```

### 5.2 API de cálculo

```typescript
// === calculator.ts ===
export interface CalculationInput {
  photoId: string
  sceneType: SceneType
  layers: PhotoLayer[]
  lengthReference?: LengthReference
  sailDraftStripes?: number[]    // heightPct de las stripes definidas en Sail
}

export interface CalculationOutput {
  measurements: Measurement[]
  warnings: string[]             // Ej: "No length reference, values are relative"
  debugInfo?: {
    chordLines: Line[]
    maxDeflectionPoints: Point[]
  }
}

export function calculateMetrics(input: CalculationInput): CalculationOutput

// === camber.ts ===
export interface CamberResult {
  camberPct: number              // Profundidad como % de la cuerda
  draftPositionPct: number       // Posición del máximo (% desde luff)
  maxDeflectionPoint: NormalizedPoint
  chordLine: { start: NormalizedPoint; end: NormalizedPoint }
}

export function calculateCamber(
  stripePoints: NormalizedPoint[],
  chordStart: NormalizedPoint,   // Punto en el luff
  chordEnd: NormalizedPoint      // Punto en el leech
): CamberResult

// === twist.ts ===
export interface TwistResult {
  twistAngle: number             // Diferencia de ángulo en grados
  referenceAngle: number         // Ángulo de la stripe de referencia
  comparedAngle: number          // Ángulo de la stripe comparada
}

export function calculateTwist(
  referenceStripe: NormalizedPoint[],
  comparedStripe: NormalizedPoint[],
  measurePoint: 'entry' | 'exit' | 'max_depth'
): TwistResult

// === mast-bend.ts ===
export interface MastBendResult {
  bendProfile: Array<{
    heightPct: number
    deflectionMm: number         // Si hay referencia de longitud
    deflectionPx: number         // Siempre disponible
  }>
  maxBend: { heightPct: number; deflection: number }
}

export function calculateMastBend(
  mastPoints: NormalizedPoint[],
  referenceLinePoints: [NormalizedPoint, NormalizedPoint],
  lengthReference?: LengthReference
): MastBendResult
```

## 6) Algoritmos de cálculo

### 6.1 Camber (Profundidad)

```
Input: Polilínea de draft stripe + puntos de cuerda (luff, leech)

1. Definir línea de cuerda: recta desde punto luff a punto leech
2. Para cada punto de la polilínea:
   a. Calcular distancia perpendicular a la línea de cuerda
   b. Mantener el máximo
3. Camber % = (distancia_máxima / longitud_cuerda) × 100
4. Draft Position % = (posición_del_máximo / longitud_cuerda) × 100

Ejemplo:
- Cuerda = 100 unidades
- Máxima deflexión = 12 unidades a posición 40 desde luff
- Camber = 12%
- Draft Position = 40%
```

```typescript
function calculateCamber(stripe: Point[], luff: Point, leech: Point): CamberResult {
  const chord = { start: luff, end: leech }
  const chordLength = distance(luff, leech)

  let maxDeflection = 0
  let maxPoint = stripe[0]
  let maxT = 0  // Parámetro a lo largo de la cuerda

  for (const point of stripe) {
    const { distance: d, t } = perpendicularDistanceToLine(point, chord)
    if (d > maxDeflection) {
      maxDeflection = d
      maxPoint = point
      maxT = t
    }
  }

  return {
    camberPct: (maxDeflection / chordLength) * 100,
    draftPositionPct: maxT * 100,
    maxDeflectionPoint: maxPoint,
    chordLine: chord
  }
}
```

### 6.2 Twist

```
Input: Dos draft stripes a diferentes alturas

1. Para cada stripe, calcular el ángulo de la tangente en un punto específico:
   - Entry angle: tangente cerca del luff
   - Exit angle: tangente cerca del leech
   - Max depth angle: tangente en el punto de máxima profundidad

2. Twist = ángulo_stripe_superior - ángulo_stripe_inferior

Ejemplo (twist de salida):
- Stripe 25%: exit angle = 15°
- Stripe 75%: exit angle = 22°
- Twist (entre 25% y 75%) = 7°
```

### 6.3 Mast Bend

```
Input: Polilínea del mástil + línea de referencia (recta ideal)

1. Definir línea de referencia: recta desde base hasta tope del mástil
2. Para cada punto de la polilínea del mástil:
   a. Calcular distancia perpendicular a la línea de referencia
   b. Convertir a heightPct (0% = base, 100% = tope)
3. Si hay referencia de longitud: convertir px → mm

Output: perfil de bend [{heightPct, deflectionMm}, ...]
```

### 6.4 Heel y Rake

```
Heel (escora):
- Input: línea del horizonte o cubierta
- Cálculo: ángulo respecto a la horizontal
- Positivo = escora a estribor

Rake (inclinación del mástil):
- Input: línea del mástil + referencia vertical
- Cálculo: ángulo respecto a la vertical
- Positivo = mástil inclinado hacia popa
```

## 7) Flujo de usuario

### 7.1 Calcular métricas

1. Usuario ha trazado las capas necesarias (stripes, referencias)
2. Pulsa botón "Calculate Metrics"
3. Sistema valida que hay suficientes datos:
   - Al menos 1 stripe para camber
   - Al menos 2 stripes para twist
   - Length reference para valores absolutos
4. Sistema calcula métricas
5. Resultados aparecen en panel lateral
6. Gráfica muestra métrica vs altura
7. Overlay opcional muestra anotaciones sobre la foto

### 7.2 UI de resultados

```
┌─────────────────────────────────────────────────────────────────┐
│ METRICS RESULTS                                         [Export]│
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Height    Camber    Draft Pos    Twist                         │
│  ──────    ──────    ─────────    ─────                         │
│   25%      14.2%       42%         0° (ref)                     │
│   50%      12.8%       45%        +3.2°                         │
│   75%      10.1%       48%        +7.5°                         │
│                                                                  │
│  ┌──────────────────────────────────────┐                       │
│  │         Camber vs Height             │                       │
│  │  15% ┤    ●                          │                       │
│  │      │      ●                        │                       │
│  │  10% ┤        ●                      │                       │
│  │      │                               │                       │
│  │   5% ┤                               │                       │
│  │      └───────────────────────────    │                       │
│  │       25%     50%      75%  Height   │                       │
│  └──────────────────────────────────────┘                       │
│                                                                  │
│  ⚠️ No length reference - values are relative                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Overlay en foto

- Mostrar líneas de cuerda punteadas
- Marcar puntos de máxima profundidad con círculo
- Mostrar valor de camber junto a cada stripe
- Ángulos de twist como arcos

## 8) Visualización (Gráficas)

### 8.1 Tipos de gráfica

| Gráfica | Eje X | Eje Y | Uso |
|---------|-------|-------|-----|
| Camber Profile | Height % | Camber % | Ver distribución de profundidad |
| Draft Position | Height % | Draft Pos % | Ver movimiento del draft |
| Twist Profile | Height % | Angle ° | Ver torsión de la vela |
| Mast Bend | Height % | Deflection mm | Ver curvatura del mástil |

### 8.2 Componente de gráfica

```typescript
interface MetricChartProps {
  data: Array<{ x: number; y: number; label?: string }>
  xLabel: string
  yLabel: string
  xRange?: [number, number]
  yRange?: [number, number]
  referenceLines?: Array<{ value: number; label: string; axis: 'x' | 'y' }>
  highlightPoints?: number[]     // Índices a destacar
}
```

### 8.3 Librería recomendada

- **Recharts** (ya común en React, ligera)
- O **Chart.js** con react-chartjs-2
- O SVG custom para control total

## 9) Exportación

### 9.1 Formatos

```typescript
interface ExportOptions {
  format: 'csv' | 'json' | 'clipboard'
  includeMetadata: boolean       // Foto, barco, fecha, etc.
  includeRawPoints: boolean      // Polilíneas originales
}
```

### 9.2 CSV Example

```csv
photo_id,photo_name,height_pct,camber_pct,draft_pos_pct,twist_deg
abc123,Main_upwind_01,25,14.2,42,0
abc123,Main_upwind_01,50,12.8,45,3.2
abc123,Main_upwind_01,75,10.1,48,7.5
```

### 9.3 JSON Example

```json
{
  "photo": {
    "id": "abc123",
    "name": "Main_upwind_01",
    "takenAt": "2024-03-15T14:30:00Z"
  },
  "sail": {
    "id": "sail456",
    "name": "Main",
    "draftStripesPct": [25, 50, 75]
  },
  "measurements": [
    {
      "heightPct": 25,
      "camberPct": 14.2,
      "draftPositionPct": 42,
      "twistDeg": 0
    }
  ]
}
```

## 10) Criterios de aceptación

### Must Have
- [ ] Camber se calcula correctamente desde polilínea + cuerda
- [ ] Draft position se muestra como % desde el luff
- [ ] Twist se calcula entre 2+ stripes
- [ ] Resultados se guardan en Measurement
- [ ] Gráfica básica de métrica vs altura
- [ ] Export a CSV funciona

### Should Have
- [ ] Overlay visual sobre la foto
- [ ] Mast bend con perfil completo
- [ ] Heel y rake desde horizonte
- [ ] Warnings cuando faltan datos
- [ ] Referencia de longitud para valores absolutos

### Nice to Have
- [ ] Múltiples gráficas simultáneas
- [ ] Comparación con valores "target"
- [ ] Animación del cálculo
- [ ] Undo de cálculo

## 11) Pruebas

### 11.1 Unitarias

```typescript
// camber.test.ts
describe('calculateCamber', () => {
  it('returns 10% camber for semicircle on chord', () => {
    // Semicírculo con radio 10% de la cuerda
    const stripe = generateSemicirclePoints(100, 10)
    const result = calculateCamber(stripe, {x:0,y:0}, {x:1,y:0})
    expect(result.camberPct).toBeCloseTo(10, 1)
  })

  it('returns draft position at 50% for symmetric curve', () => {
    const stripe = generateSymmetricCurve()
    const result = calculateCamber(stripe, luff, leech)
    expect(result.draftPositionPct).toBeCloseTo(50, 1)
  })
})
```

### 11.2 Integración
- Calcular métricas de foto real y verificar valores razonables
- Guardar y recuperar measurements de storage
- Export CSV y verificar formato

## 12) Dependencias

```json
{
  "dependencies": {
    "recharts": "^2.x"           // Para gráficas
  }
}
```

## 13) Relación con otras fases

- **Requiere**: Fase 3 (escenas), Fase 4A/4B (polilíneas)
- **Habilita**: Fase 6 (comparación de métricas entre fotos)
- **Complementa**: Fase 2 (correlación con datos de log)
