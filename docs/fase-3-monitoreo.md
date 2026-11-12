# Fase 3 · Monitoreo con ELK

Guía técnica de la Fase 3 del curso CC3047 (UVG). Explica qué se construye, por qué y cómo funciona cada pieza. Se actualiza en cada commit de la fase.

## Qué pide la fase

- Una API cuyos logs se generan automáticamente desde el código, con los campos `@timestamp`, `http.request.method`, `http.response.status_code`, `event.duration`, `url.path`, `service.name` y `log.level`.
- Un stack ELK en `docker-compose.yml` (Elasticsearch, Kibana, Filebeat y Heartbeat) que lleve esos logs a Elasticsearch.
- Un `heartbeat.yml` que verifique que la API está arriba.
- Un dashboard de Kibana con: tráfico de peticiones, tiempo de respuesta promedio, estado up/down, distribución por códigos HTTP, error rate y top endpoints.
- Un script generador de tráfico continuo, una muestra `.log` de al menos 50 registros, la captura del dashboard y un informe técnico.

## Vía elegida: API simulada del servicio

El enunciado permite instrumentar una API propia o construir una API que simule el servicio de la Fase 1. Elegimos la **API simulada** porque:

- El servicio de la Fase 1 es la operación de e-commerce de Bevstack, con un catálogo de 8 elementos (ver [modelo-operativo.md](modelo-operativo.md)). El Service Desk web (Fase 2) es el canal de atención, no el servicio monitoreado.
- La API simulada expone un endpoint por elemento del catálogo y controla por configuración la proporción de errores y la latencia, tal como pide el enunciado.
- No modifica el Service Desk existente (frontend Vite + Supabase + Render), que sigue funcionando igual.

La API simulada **no usa Supabase ni otra base de datos**. Vive en `api/` y no tiene dependencias externas: usa solo `node:http`.

## Plan de trabajo (6 commits secuenciales)

| # | Responsable | Commit | Estado |
|---|---|---|---|
| 1 | A | `feat: add simulated service API with ECS logging`: servidor, logger ECS, `/api/health` y configuración | ✅ Listo |
| 2 | A | `feat: add catalog endpoints with error ratio and latency`: los 8 endpoints del catálogo | Pendiente |
| 3 | A | `feat: add continuous traffic generator`: script de tráfico y muestra `logs/sample-api.log` (50+ líneas) | Pendiente |
| 4 | B | `feat: add ELK stack with Filebeat`: `docker-compose.yml` y `filebeat.yml` | Pendiente |
| 5 | B | `feat: add Heartbeat monitor`: `heartbeat.yml` | Pendiente |
| 6 | B | `docs: add Kibana dashboard and Phase 3 report`: export del dashboard, captura e informe | Pendiente |

Todo corre **en local**; no se despliega nada nuevo en Render.

## Endpoints

| Catálogo (Fase 1) | Tipo | Endpoint | Estado |
|---|---|---|---|
| — | Salud | `GET /api/health` | ✅ |
| Activación de una nueva tienda | Solicitud | `POST /api/stores` | Commit 2 |
| Cambio en reglas de envío | Solicitud | `PUT /api/stores/:id/shipping-rules` | Commit 2 |
| Actualización de configuración de productos | Solicitud | `PATCH /api/products/:sku` | Commit 2 |
| Cambio de configuración operativa | Solicitud | `PUT /api/stores/:id/operational-config` | Commit 2 |
| Pedido no procesado | Incidente | `POST /api/orders` | Commit 2 |
| Inventario incorrecto | Incidente | `GET /api/inventory/:sku` | Commit 2 |
| Pago completado sin creación del pedido | Incidente | `POST /api/payments` | Commit 2 |
| Opción de envío no disponible | Incidente | `GET /api/shipping/options` | Commit 2 |

Las rutas inexistentes responden `404` y un método no permitido responde `405` con encabezado `Allow`. Ambos casos también se registran en el log.

`GET /api/health` responde `{"status":"up","service":...,"environment":...,"uptimeSeconds":...,"timestamp":...}`. Lo usará Heartbeat. Estas peticiones también se registran; en Kibana se pueden excluir con el filtro `NOT url.path : "/api/health"` si distorsionan el top de endpoints.

## Ejecutar la API

```bash
pnpm api            # escucha en http://127.0.0.1:4000
curl http://127.0.0.1:4000/api/health
```

Detén la API con `Ctrl+C`; cierra el servidor y el archivo de log de forma ordenada.

### Variables de entorno

| Variable | Valor por defecto | Uso |
|---|---|---|
| `HOST` | `127.0.0.1` | Interfaz de escucha. En Docker debe ser `0.0.0.0`. |
| `PORT` | `4000` | Puerto HTTP. |
| `SERVICE_NAME` | `bevstack-ecommerce-api` | Valor de `service.name` en los logs. |
| `SERVICE_ENVIRONMENT` | `local` | Valor de `service.environment`. |
| `LOG_FILE` | `logs/api.log` | Archivo NDJSON que leerá Filebeat. La carpeta se crea sola. |
| `LOG_TO_STDOUT` | `true` | Si es `false`, solo escribe en el archivo. |
| `CLIENT_ERROR_RATE` | `0.15` | Proporción de respuestas 4xx simuladas (se usa desde el commit 2). |
| `SERVER_ERROR_RATE` | `0.05` | Proporción de respuestas 5xx simuladas (se usa desde el commit 2). |
| `LATENCY_SCALE` | `1` | Multiplicador (0–1) de la latencia simulada (se usa desde el commit 2). |
| `SLOW_REQUEST_RATE` | `0.05` | Proporción de peticiones con pico de latencia (se usa desde el commit 2). |
| `MAX_LATENCY_MS` | `3000` | Tope de latencia simulada (se usa desde el commit 2). |

La configuración se valida al arrancar: las tasas deben estar entre 0 y 1, y `CLIENT_ERROR_RATE + SERVER_ERROR_RATE` no puede superar 1.

## Formato de los logs

Cada petición HTTP produce **una línea JSON** (NDJSON) en `logs/api.log`, y también en stdout. Los nombres de los campos siguen [Elastic Common Schema (ECS)](https://www.elastic.co/guide/en/ecs/current/index.html) como **objetos anidados**, de modo que `http.request.method` en Kibana corresponde a `{"http":{"request":{"method":...}}}`.

```json
{"@timestamp":"2026-11-12T02:53:43.481Z","log":{"level":"warn","logger":"http"},"message":"GET /nope 404 not_found","ecs":{"version":"8.11.0"},"service":{"name":"bevstack-ecommerce-api","environment":"local"},"event":{"kind":"event","category":["web"],"type":["access"],"outcome":"failure","duration":250167},"http":{"request":{"method":"GET"},"response":{"status_code":404}},"url":{"path":"/nope"}}
```

| Campo | Significado |
|---|---|
| `@timestamp` | Momento en que llegó la petición (ISO 8601, UTC). |
| `http.request.method` | Método HTTP en mayúsculas. |
| `http.response.status_code` | Código HTTP devuelto (número). |
| `event.duration` | Duración de la petición en **nanosegundos**, como define ECS. Para mostrar milisegundos en Kibana, divide entre 1 000 000 o usa el formato *Duration* con entrada en nanosegundos. |
| `url.path` | Ruta real sin query string (por ejemplo `/api/inventory/SKU-12`). |
| `service.name` | Nombre del servicio (`SERVICE_NAME`). |
| `log.level` | `info` para 1xx–3xx, `warn` para 4xx y `error` para 5xx. |
| `event.outcome` | `success` si el código es menor que 400; si no, `failure`. Sirve para calcular el error rate. |
| `message` | Resumen legible: método, ruta, código y, en errores, el código interno. |

Notas para quien configure Filebeat (commit 4):

- Usar el input `filestream` con el parser `ndjson` y `target: ""`, para que los campos queden en la raíz del documento y no bajo `json.*`.
- Mapear `event.duration` como `long`, `http.response.status_code` como `long` o `short` y `url.path` como `keyword`, para que funcionen el promedio, la distribución por código y el top de endpoints.
- `@timestamp` ya viene en el log y debe conservarse (no sustituirlo por la hora de ingesta).

## Estructura del código

| Archivo | Responsabilidad |
|---|---|
| `api/config.mjs` | Lee y valida las variables de entorno (`loadConfig`). |
| `api/logger.mjs` | `buildRequestLog` arma el documento ECS; `createLogger` escribe NDJSON en el archivo y stdout; `levelForStatus` decide el nivel. |
| `api/app.mjs` | Router con parámetros (`/api/stores/:id`), respuestas JSON, `HttpError` para 4xx/5xx controlados, ruta `/api/health` y el registro automático de cada petición en un bloque `finally`, de modo que también se registran los errores y las excepciones. |
| `api/server.mjs` | Punto de entrada: crea el servidor HTTP y cierra ordenadamente con `SIGINT`/`SIGTERM`. |
| `tests/api.test.mjs` | Pruebas con `node:test`: configuración, formato del log, salud, 404, 405, parámetros y errores. |

Para agregar un endpoint, se pasa a `createApp({ routes })` un objeto `{ method, path, handler }`. El handler recibe `{ request, params, path, method }` y devuelve `{ status, body, headers? }`, o lanza `new HttpError(status, code, message)`. El registro del log no requiere código adicional.

## Pruebas

```bash
pnpm test                          # toda la suite, incluida la API
node --test tests/api.test.mjs     # solo la API
```
