# Escenas de medición (motor)

Las **Escenas** determinan qué herramientas se muestran, qué referencias se piden y qué métricas se generan.

## 1) Onboard Sail (foto desde el barco)
**Objetivo**: camber, draft position y twist por altura (draft stripes).

**Entradas típicas**:
- Foto mirando hacia arriba (vela izada).
- Draft stripes definidas para esa vela (ej. 25/50/75).
- (Opcional) referencia de longitud (para pasar de % a unidades absolutas en algún cálculo).

**Salidas**:
- `CAMBER_PCT` por `heightPct`
- `DRAFT_POS_PCT` por `heightPct`
- `TWIST_DEG` (por pares de alturas o como perfil vs altura)

## 2) Chase Sail (foto desde lancha)
**Objetivo**: curvas de grátil/baluma y flecha del estay.

**Entradas típicas**:
- Foto lateral (vela completa visible).
- Referencia de longitud (recomendada) para métricas absolutas.

**Salidas**:
- `LUFF_CURVE` (curva normalizada o polilínea)
- `LEECH_CURVE` (curva normalizada o polilínea)
- `FORESTAY_SAG` (valor y/o curva)

## 3) Mast Bend (curvatura del mástil)
**Objetivo**: separar flexión longitudinal vs lateral.

**Entradas típicas**:
- Foto alineada con el plano del barco (para longitudinal) o vista frontal (para lateral).
- Línea de referencia del mástil (puntos manuales o auto-scan).

**Salidas**:
- `MAST_BEND_LONG` (perfil vs altura)
- `MAST_BEND_LAT` (perfil vs altura)

## 4) Rake y Heel (ángulos respecto al horizonte)
**Objetivo**: medir caída del mástil y escora del barco.

**Entradas típicas**:
- Foto con horizonte visible.
- Detección manual/auto del horizonte y/o líneas verticales (mástil).

**Salidas**:
- `HEEL_DEG`
- `RAKE_DEG`

