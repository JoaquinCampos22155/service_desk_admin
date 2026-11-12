# Guía para agentes de IA

Contexto del repositorio para asistentes de código (Claude Code, Codex, Cursor, Copilot, etc.). Léelo antes de cambiar algo.

## Qué es este proyecto

Proyecto del curso **CC3047 · Administración y Mantenimiento de Sistemas (UVG)**, desarrollado por fases en grupo:

- **Fase 1:** definición del servicio de e-commerce de Bevstack y su catálogo de 8 elementos ([docs/modelo-operativo.md](docs/modelo-operativo.md)).
- **Fase 2:** Service Desk web (canal de atención). Frontend Vite con JavaScript vanilla en `public/` y `src/`, autenticación y datos en Supabase (`supabase/`), y despliegue como Static Site en Render (`render.yaml`, branch `main`).
- **Fase 3 (en curso):** monitoreo con ELK. Hay una API simulada del servicio en `api/`, que genera logs ECS para Filebeat, Elasticsearch y Kibana, y Heartbeat. **Detalles, plan de commits y estado actual: [docs/fase-3-monitoreo.md](docs/fase-3-monitoreo.md).**

## Reglas

- Idioma: los textos de la UI, la documentación y los mensajes al usuario van en **español**; el código y los nombres de commits, en inglés.
- La API de la Fase 3 (`api/`) es independiente del Service Desk: no importa nada de `public/` ni de `src/` y no usa Supabase. No acoples ambas partes.
- Los logs de la API son NDJSON con campos ECS anidados. `event.duration` va en **nanosegundos**. No cambies el formato sin actualizar [docs/fase-3-monitoreo.md](docs/fase-3-monitoreo.md) ni la configuración de Filebeat y Kibana.
- `logs/*.log` está en `.gitignore`; solo se versiona `logs/sample-api.log` (la muestra entregable).
- `*.pdf` y `*.zip` están en `.gitignore`: en la raíz hay entregas del curso y documentos con credenciales. Nunca los fuerces al repo (`git add -f`).
- Para el "top de endpoints" usa `labels.route` (ruta agrupada) en lugar de `url.path`; para separar incidentes y solicitudes, `labels.catalog_type`.
- Un push a `main` despliega el frontend en Render. No rompas `pnpm build`.
- No pongas claves secretas ni `service_role` de Supabase en variables `VITE_` ni en el repo.
- Al terminar un paso de la Fase 3, actualiza la tabla de estado en [docs/fase-3-monitoreo.md](docs/fase-3-monitoreo.md).

## Comandos

```bash
pnpm install        # dependencias (Node >= 22.12, pnpm)
pnpm dev            # frontend Service Desk (Vite)
pnpm api            # API simulada en http://127.0.0.1:4000, logs en logs/api.log
pnpm traffic        # generador de tráfico continuo contra la API (Ctrl+C para detener)
pnpm logs:sample    # regenera logs/sample-api.log (muestra entregable)
pnpm test           # todas las pruebas (node:test)
pnpm build          # build del frontend
```
