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
| 2 | A | `feat: add catalog endpoints with error ratio and latency`: los 8 endpoints del catálogo | ✅ Listo |
| 3 | A | `feat: add continuous traffic generator`: script de tráfico y muestra `logs/sample-api.log` (50+ líneas) | ✅ Listo |
| 4 | B | `feat: add ELK stack with Filebeat`: `docker-compose.yml` y `filebeat.yml` | Pendiente |
| 5 | B | `feat: add Heartbeat monitor`: `heartbeat.yml` | Pendiente |
| 6 | B | `docs: add Kibana dashboard and Phase 3 report`: export del dashboard, captura e informe | Pendiente |

Todo corre **en local**; no se despliega nada nuevo en Render.

## Endpoints

Hay un endpoint por cada elemento del catálogo de la Fase 1. Están definidos en `api/catalog.mjs` (`CATALOG_ENDPOINTS`), con el mismo `id` que el catálogo de `public/app.js`. Una prueba verifica que ambos coincidan.

| Catálogo (Fase 1) | Tipo | Endpoint | Éxito | Latencia base | Errores 4xx posibles | Errores 5xx posibles |
|---|---|---|---|---|---|---|
| — | Salud | `GET /api/health` | 200 | inmediata | — | — |
| Activación de una nueva tienda | Solicitud | `POST /api/stores` | 201 | 120–450 ms | 400, 401, 409 `store_already_exists` | 500, 503, 502 `provisioning_failed` |
| Cambio en reglas de envío | Solicitud | `PUT /api/stores/:storeId/shipping-rules` | 200 | 80–250 ms | 400, 401, 404 `store_not_found` | 500, 503 |
| Actualización de configuración de productos | Solicitud | `PATCH /api/products/:sku` | 200 | 60–200 ms | 400, 401, 404 `product_not_found` | 500, 503 |
| Cambio de configuración operativa | Solicitud | `PUT /api/stores/:storeId/operational-config` | 200 | 70–220 ms | 400, 401, 404 `store_not_found` | 500, 503 |
| Pedido no procesado | Incidente | `POST /api/orders` | 201 | 150–600 ms | 400, 401, 409 `duplicate_order` | 500, 503, 502 `fulfillment_unavailable` |
| Inventario incorrecto | Incidente | `GET /api/inventory/:sku` | 200 | 20–120 ms | 400, 401, 404 `product_not_found` | 500, 503, 502 `inventory_feed_error` |
| Pago completado sin creación del pedido | Incidente | `POST /api/payments` | 201 | 200–800 ms | 400, 401, 409 `duplicate_payment` | 500, 503, 502 `payment_gateway_error` |
| Opción de envío no disponible | Incidente | `GET /api/shipping/options?zone=12` | 200 | 40–180 ms | 400, 401, 404 `zone_not_covered` | 500, 503, 502 `carrier_unavailable` |

Los 400 y 401 comunes son `validation_error` y `unauthorized`; los 500 y 503 comunes son `internal_error` y `service_unavailable`. Todas las respuestas son JSON; los errores tienen la forma `{"error":"<código>","message":"<texto>"}`.

Ejemplos:

```bash
curl -X POST http://127.0.0.1:4000/api/orders -H 'content-type: application/json' -d '{"items":[{"sku":"SKU-501","qty":2}]}'
curl http://127.0.0.1:4000/api/inventory/SKU-501
curl 'http://127.0.0.1:4000/api/shipping/options?zone=12'
```

Las rutas inexistentes responden `404` y un método no permitido responde `405` con encabezado `Allow`. Un cuerpo que no sea un objeto JSON válido responde siempre `400 invalid_json`; ese error es real, no simulado, y uno mayor de 64 KB responde `413`. Todos estos casos también se registran en el log.

## Simulación de errores y latencia

`api/simulation.mjs` decide, en cada petición a un endpoint del catálogo:

1. **Latencia:** un valor aleatorio uniforme dentro del rango base del endpoint. Con probabilidad `SLOW_REQUEST_RATE` (5%) la petición es lenta y la latencia se multiplica ×4. El resultado se limita a `MAX_LATENCY_MS` (3000 ms) y se multiplica por `LATENCY_SCALE`. La API espera ese tiempo antes de responder, así que `event.duration` refleja la latencia real.
2. **Resultado:** con probabilidad `SERVER_ERROR_RATE` (5%) devuelve un 5xx; con probabilidad `CLIENT_ERROR_RATE` (15%), un 4xx; el resto (80%) es éxito. El código concreto se elige al azar entre los errores posibles del endpoint (tabla anterior).

**Proporción de errores configurada (documentar en el informe): 80% éxito · 15% errores 4xx · 5% errores 5xx.** Se cambia con variables de entorno, sin tocar código. La prueba `outcome picks follow the configured error proportions` verifica, sobre 20 000 decisiones, que la proporción real queda a menos de 1 punto de la configurada.

Prueba local con 400 peticiones (8 endpoints × 50) y la configuración por defecto: 331 éxitos (83%), 50 errores 4xx (12.5%) y 19 errores 5xx (4.75%). Promedios de latencia: inventario ~78 ms, opciones de envío ~132 ms, configuraciones y productos ~160–180 ms, tiendas ~327 ms, pedidos ~460 ms y pagos ~623 ms, con picos de hasta ~2 s.

`GET /api/health` responde `{"status":"up","service":...,"environment":...,"uptimeSeconds":...,"timestamp":...}`. Lo usará Heartbeat. Estas peticiones también se registran; en Kibana se pueden excluir con el filtro `NOT url.path : "/api/health"` si distorsionan el top de endpoints.

## Generador de tráfico

`scripts/traffic-generator.mjs` envía peticiones HTTP reales de forma **continua** a los 8 endpoints del catálogo, hasta que se detiene con `Ctrl+C`. Es el entregable "generador de tráfico" de la fase.

```bash
pnpm api                                   # terminal 1
pnpm traffic                               # terminal 2: ~5 req/s sin límite
pnpm traffic -- --rps 10 --duration 300    # 10 req/s durante 5 minutos
pnpm traffic -- --url http://api:4000      # otra URL (por ejemplo, dentro de Docker)
```

| Opción | Variable de entorno | Valor por defecto | Uso |
|---|---|---|---|
| `--url` | `TARGET_URL` | `http://127.0.0.1:4000` | URL base de la API. |
| `--rps` | `REQUESTS_PER_SECOND` | `5` | Ritmo promedio. Cada intervalo varía ±50% para que el tráfico tenga ráfagas y no sea una línea plana. `0` envía sin pausa. |
| `--duration` | `DURATION_SECONDS` | `0` (sin límite) | Segundos antes de detenerse. |
| `--max` | `MAX_REQUESTS` | `0` (sin límite) | Número de peticiones antes de detenerse. |
| `--concurrency` | `MAX_IN_FLIGHT` | `20` | Máximo de peticiones simultáneas sin respuesta. |

Funcionamiento:

- En cada ciclo elige un endpoint según un **peso** que imita una operación real: las consultas dominan y los cambios de configuración son raros. Pesos: inventario 25, opciones de envío 20, pedidos 15, pagos 12, productos 10, reglas de envío 6, configuración operativa 5, nueva tienda 4.
- Varía los parámetros (SKU, tienda, zona, marca, montos), así que `url.path` muestra rutas como `/api/inventory/SKU-618`.
- No llama a `/api/health`; eso lo hace Heartbeat.
- Cada 10 s imprime el progreso, y otra vez al terminar: respuestas, req/s y porcentaje de 2xx, 4xx y 5xx. Si la API no responde, cuenta las peticiones "sin respuesta" sin detenerse. Así se puede apagar la API para que Heartbeat marque *down* y el generador sigue corriendo.

Prueba local (API real, `--rps 8 --duration 25`): 198/198 respuestas a 7.9 req/s, con 77.8% 2xx, 18.7% 4xx y 3.5% 5xx; la API escribió exactamente una línea de log por petición.

### Muestra de logs entregable

`logs/sample-api.log` es la muestra de logs que pide la fase (al menos 50 registros). Se regenera con:

```bash
pnpm logs:sample                            # 200 peticiones a ~20 req/s
pnpm logs:sample -- --requests 500 --rps 25
```

El script levanta la API real dentro del mismo proceso, en un puerto libre y con la configuración por defecto, la recorre con el generador y llama a `/api/health` cada 2 s como haría Heartbeat. Las líneas las escribe la propia API; no se fabrican a mano. La muestra actual tiene **205 registros**: 175 `info`, 17 `warn` y 13 `error`, con todos los campos obligatorios, todos los endpoints del catálogo y `/api/health`. Es el único archivo de `logs/` que se versiona.

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
| `CLIENT_ERROR_RATE` | `0.15` | Proporción de respuestas 4xx simuladas. |
| `SERVER_ERROR_RATE` | `0.05` | Proporción de respuestas 5xx simuladas. |
| `LATENCY_SCALE` | `1` | Multiplicador (0–1) de la latencia simulada; `0` responde sin espera. |
| `SLOW_REQUEST_RATE` | `0.05` | Proporción de peticiones con pico de latencia (×4). |
| `MAX_LATENCY_MS` | `3000` | Tope de latencia simulada en milisegundos. |

Ejemplo, para simular un incidente con muchos errores de servidor: `SERVER_ERROR_RATE=0.4 pnpm api`.

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
| `api/simulation.mjs` | `createSimulator`: latencia variable, picos lentos y elección de éxito, 4xx o 5xx según la configuración. `seededRandom` da secuencias reproducibles para las pruebas. |
| `api/catalog.mjs` | `CATALOG_ENDPOINTS` (los 8 endpoints, con latencia, errores posibles y respuesta de éxito) y `createCatalogRoutes`, que los convierte en rutas. También lee el cuerpo JSON (`readJsonBody`). |
| `api/server.mjs` | Punto de entrada: arma configuración, logger, simulador y rutas; cierra ordenadamente con `SIGINT`/`SIGTERM`. |
| `tests/api.test.mjs` | Pruebas con `node:test`: configuración, formato del log, salud, 404, 405, parámetros y errores. |
| `tests/api-catalog.test.mjs` | Pruebas del catálogo: correspondencia con la Fase 1, proporción de errores, latencia, éxitos, 4xx y 5xx forzados, y JSON inválido. |
| `scripts/traffic-generator.mjs` | Generador de tráfico continuo (`pnpm traffic`). Exporta `buildRequest`, `runTraffic`, `parseCliOptions` y `formatStats` para las pruebas. |
| `scripts/generate-sample-log.mjs` | Regenera `logs/sample-api.log` (`pnpm logs:sample`). |
| `tests/traffic-generator.test.mjs` | Pruebas del generador: cobertura de los 8 endpoints, métodos, tráfico contra la API real con una línea de log por petición, API caída, detención y opciones. |

Para agregar un endpoint del catálogo, se agrega un objeto a `CATALOG_ENDPOINTS` con `id`, `name`, `type`, `method`, `path`, `latency`, `clientErrors`, `serverErrors` y `success`. Para una ruta fuera del catálogo, se pasa a `createApp({ routes })` un objeto `{ method, path, handler }`. El handler recibe `{ request, params, path, method }` y devuelve `{ status, body, headers? }`, o lanza `new HttpError(status, code, message)`. En ambos casos el registro del log es automático.

## Pruebas

```bash
pnpm test                          # toda la suite, incluida la API
node --test tests/api.test.mjs     # solo la API
```
