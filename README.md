# SailCloud (inspirado en The Sail Cloud)

Repositorio para desarrollar una app de análisis de velas y aparejo a partir de fotos + logs de instrumentación, con enfoque *Vibecoding* (iteración guiada por especificaciones y prompts).

## Objetivo
- Organizar todo por **barco** (inventario, fotos, logs, mediciones, reportes).
- Asociar **fotos ↔ condiciones de viento** (sincronización temporal con logs).
- Medir mediante **Escenas** (onboard/chase/mast bend/rake-heel) con herramientas manuales y auto-scan.
- Visualizar resultados (gráficas + superposición sobre foto), colaboración (notas) y exportación (PDF).

## Documentación
- `docs/01-glossary.md`: glosario y convenciones.
- `docs/02-data-model.md`: entidades y relaciones mínimas.
- `docs/03-scenes.md`: definición de escenas, entradas y salidas.
- `docs/04-vibecoding-template.md`: plantilla para escribir prompts consistentes.

## Prompts de Vibecoding
Usa los prompts en `prompts/` como punto de partida para iterar fase por fase.

## Desktop (MVP)
Proyecto Electron + React en `apps/desktop`.

```bash
cd apps/desktop
npm install
npm run dev
```

Para probar un build “tipo app” (sin servidor dev):

```bash
cd apps/desktop
npm run proto
```

Nota: en esta máquina existe `ELECTRON_RUN_AS_NODE=1` (hace que `electron .` se ejecute como Node y no abra ventana). Los scripts `npm run start/dev/proto` ya lo eliminan automáticamente.
