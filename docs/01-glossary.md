# Glosario y convenciones

## Viento y navegación
- **TWS**: *True Wind Speed* (velocidad real del viento).
- **TWA**: *True Wind Angle* (ángulo real del viento relativo a la proa).
- **Timestamp**: instante de medición; conviene normalizar a **UTC** en almacenamiento y conservar `timezone` para mostrarlo correctamente.

## Vela (geometría)
- **Draft stripes (bandas de forma)**: líneas horizontales de referencia en la vela, expresadas como **% de altura** (ej. 25/50/75). Son el eje Y común para medir y graficar.
- **`heightPct` (altura en %)**: por convención, `0%` = **puño de amura** (tack) y `100%` = **puño de driza** (head), medido a lo largo del grátil (o la altura definida para esa vela).
- **Camber / Depth**: profundidad de la vela (normalmente como % de la cuerda en una altura dada).
- **Draft position**: posición del máximo camber (ej. % desde el grátil a lo largo de la cuerda).
- **Twist**: variación del ángulo de la sección con la altura (diferencia de orientación entre bandas).
- **Luff (grátil)**: borde delantero de la vela.
- **Leech (baluma)**: borde de salida de la vela.

## Aparejo y mástil
- **Rig height (altura de aparejo)**: referencia para expresar herrajes como % de altura.
- **`rigHeightPct` (altura en % del aparejo)**: por convención, `0%` = **cubierta/arraigo del mástil** y `100%` = **tope de mástil**.
- **Spreaders (crucetas)**: elementos transversales del mástil; registrar su altura como % del aparejo.
- **Hounds**: herrajes/puntos de anclaje del estay/obenques; registrar como % del aparejo.
- **Mast bend (curvatura del mástil)**:
  - **Longitudinal (proa-popa)**: flexión en el plano del barco.
  - **Lateral**: flexión hacia babor/estribor.
- **Rake**: caída del mástil (inclinación proa-popa) respecto a vertical.
- **Heel**: escora del barco (inclinación lateral) respecto al horizonte.

## Fotos e imágenes
- **EXIF DateTimeOriginal**: timestamp embebido en la foto (si existe).
- **Horizon line**: referencia clave para heel/rake y corrección de perspectiva.
- **Referencia de longitud**: medida conocida en la escena para convertir píxeles a metros (o a escala absoluta).

## Convención clave
Todo lo que se mida sobre velas se indexa por **altura en %** (las draft stripes son el “sistema de coordenadas” vertical).
