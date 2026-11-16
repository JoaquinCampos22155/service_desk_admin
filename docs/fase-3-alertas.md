# Política de monitoreo y atención

La cola de Kibana propone qué revisar primero y quién debe actuar. El evaluador local `monitoring/observer.mjs` consulta Elasticsearch cada 10 s, calcula reglas sobre los últimos 5 minutos y publica su estado. No envía correos, no abre tickets y no modifica Supabase. Las prioridades son técnicas y provisionales para la simulación: Account Management debe confirmar marcas afectadas, alcance, urgencia y comunicación antes de asignar la prioridad comercial del incidente.

## Reglas de activación y recuperación

Los valores se editan en `monitoring/policy.json`. Reiniciar `observer` después de cambiarlos. El primer minuto es de estabilización del recolector.

| Señal | Activación | Prioridad propuesta | Responsable y primer paso |
|---|---|---|---|
| API caída | 2 chequeos distintos consecutivos down, ambos de los últimos 45 s | P1 | Tech verifica `/api/health`, contenedor y dependencias; restaura. AM valida impacto y comunicación. |
| 5xx generalizados | ≥30% de peticiones de catálogo con n≥100 en 5 min | P1 | Tech agrupa por ruta y `error.code`, revisa cambios y restaura; AM confirma alcance. |
| Heartbeat o logs atrasados | Última señal >45 s o ausente | P2 | Tech revisa recolector y Elasticsearch; confirma API directamente. Sin señal reciente no se afirma disponibilidad. |
| 5xx por ruta | ≥10%, n≥50 en 5 min | P2 | Tech revisa ruta, cambios y dependencia. Un 502 es un síntoma simulado; no prueba por sí solo una causa raíz. |
| Latencia por ruta | p95 de respuestas 2xx/3xx >objetivo, n exitosas≥50 en 5 min | P2 | Tech revisa ruta y dependencia; AM contrasta experiencia de la marca. |
| 4xx por ruta | ≥30%, n≥50 en 5 min | P3 | AM/Customer Success revisan datos y configuración; Tech analiza autenticación o regresiones. |
| Tráfico esperado ausente | >60 s sin petición de catálogo y logs recientes | P3 | Tech verifica generador; AM confirma demanda. `EXPECTED_TRAFFIC=false` desactiva esta regla para periodos sin demanda esperada. |

Excepto disponibilidad, se exigen 2 evaluaciones consecutivas para activar y 2 para recuperar. Un up aislado no resuelve la caída: hacen falta 2 chequeos up distintos y recientes. La recuperación exige 5xx globales <15%, 5xx por ruta <8%, 4xx por ruta <24% y latencia ≤80% del objetivo. Las bandas por ruta dejan margen sobre las tasas predeterminadas de la simulación. La zona entre activación y recuperación evita cambios repetidos de estado. Las evaluaciones de tasas usan ventanas superpuestas, no son muestras estadísticamente independientes.

La falta de datos o una muestra menor al mínimo conserva la alerta activa; no prueba recuperación. Una caída correlaciona las señales subordinadas, que quedan fuera de la cola activa pero conservan su estado interno. Los 5xx globales agrupan los 5xx de cada ruta. Al desaparecer el evento padre, una señal hija todavía activa vuelve a la cola.

| Ruta | Objetivo provisional p95 exitosas |
|---|---:|
| `/api/stores` | 1000 ms |
| `/api/stores/:storeId/shipping-rules` | 750 ms |
| `/api/products/:sku` | 750 ms |
| `/api/stores/:storeId/operational-config` | 750 ms |
| `/api/orders` | 1200 ms |
| `/api/inventory/:sku` | 350 ms |
| `/api/payments` | 1500 ms |
| `/api/shipping/options` | 500 ms |

Estos números no los prescribe ITIL. Deben ajustarse con una línea base y objetivos de experiencia acordados con las marcas. El 5% de errores 5xx y el 15% 4xx configurados para la simulación tampoco son metas aceptables de producción. El cumplimiento de atención del Service Desk en Fase 1 no equivale a disponibilidad de API; no se reutiliza ese porcentaje como SLA técnico.

## Interpretación del dashboard

Primero revisar fechas de Heartbeat, logs y evaluador. La cola vacía solo indica que no hay reglas activas visibles en la última evaluación; el evaluador puede haberse detenido. Si su fecha supera 45 s, verificar el servicio directamente y tratar la observabilidad como desconocida. El monitor no puede garantizar su propia vigilancia cuando Elasticsearch o el host completo están caídos; producción requeriría vigilancia externa.

Los gráficos siguen el selector temporal de Kibana; las reglas siempre usan 5 min. La cola tiene documentos actuales que se sobrescriben y no reconstruye un estado histórico al cambiar el selector. El historial de transiciones está en `bevstack-monitoring-events`, consultable en Discover. Las métricas de catálogo excluyen `/api/health`; el tráfico por Incidente/Solicitud describe categorías del catálogo, no tickets abiertos.

El promedio se conserva por el enunciado, acompañado por p50/p95 de exitosas y detalle por ruta con n total y n exitosas. Las latencias exitosas se separan para que los errores rápidos no mejoren artificialmente la experiencia aparente. Los percentiles de Elasticsearch son aproximados. No interpretar p95 por ruta con menos de 50 éxitos como base suficiente para alertar. Los huecos no se unen con interpolación lineal; tampoco se convierten en una mejora de latencia.

## Atención y seguimiento

Un evento es una observación de estado. Una alerta es una condición que requiere revisar la evidencia. Un incidente se registra o actualiza cuando soporte valida una interrupción o degradación. Una alerta no demuestra automáticamente un incidente comercial.

1. Tech verifica la frescura y reproduce el síntoma; consulta logs por `labels.route`, `error.code` y tiempo. Identifica cambio reciente, dependencia y opción de restauración.
2. Account Management confirma las marcas afectadas, si se bloquea venta o cobro, si existe alternativa y la urgencia. P1 tiene atención inmediata propuesta; P2 requiere atender degradación y riesgo; P3 se revisa sin interrumpir una restauración P1. No se inventan minutos de respuesta contractuales.
3. Soporte busca un incidente existente antes de crear otro y registra evidencia, inicio observado, impacto, responsable y próxima actualización. Las comunicaciones se hacen por el proceso acordado con AM.
4. Tras restaurar, comprobar disponibilidad y operación de los endpoints afectados; el up del ambiente no acredita éxito de pagos o pedidos. Validar con AM y documentar resolución antes de cerrar el incidente.
5. Una falla repetida motiva investigación de problema y causa raíz; registrar acción de mejora, responsable y resultado esperado. Los cambios pasan por evaluación y validación, no se aplican automáticamente desde el dashboard.

## Persistencia y alcance

`bevstack-monitoring-current` mantiene un documento por regla; `bevstack-monitoring-events` almacena únicamente transiciones visibles. El volumen `monitoring-state` conserva contadores y revisión por regla. Antes de publicar se guarda un lote pendiente en disco. Si falla la publicación, el guardado del estado o el proceso, se reproduce ese mismo lote antes de consultar datos nuevos. Los identificadores estables hacen idempotente el reintento. El estado se guarda en archivo temporal y se renombra después de un bulk exitoso; el pendiente se elimina al terminar. Si la consulta o escritura falla, no se adelanta el estado ni se declara recuperación. Se ejecuta una sola instancia de `observer`; no hay elección de líder ni deduplicación distribuida.

`docker compose down` preserva datos; `down -v` los borra y pierde el historial/estado. No borrar solo el volumen de estado conservando el índice de eventos: para una demostración limpia restablecer ambos juntos o conservar ambos. Configurar mantenimiento y demanda esperada antes de interpretar ausencia de tráfico. Los puertos y la seguridad deshabilitada son de un entorno local de curso; no se presenta esta configuración como despliegue de producción.

## Validación comercial de prioridad

Account Management confirma impacto y urgencia con la marca. Como propuesta de trabajo, impacto alto significa venta o cobro bloqueado con alcance amplio; medio, una operación o marca afectada con alcance limitado; bajo, una consulta o corrección sin interrupción de venta. Urgencia alta significa que se necesita restaurar ahora y no hay alternativa viable; media admite una alternativa temporal; baja puede programarse sin agravar la afectación. No se deducen ingresos perdidos ni marcas afectadas solo del código HTTP.

| Impacto / urgencia | Alta | Media | Baja |
|---|---|---|---|
| Alto | P1 | P2 | P2 |
| Medio | P2 | P2 | P3 |
| Bajo | P3 | P3 | P3 |

Es una matriz propuesta para validación del equipo, no una matriz impuesta por ITIL ni un cambio automático a los tickets existentes. El caso de seguridad, pérdida de datos u otra obligación especial requiere el proceso de escalamiento que acuerde la organización. Registrar la evidencia y el motivo de cualquier ajuste de prioridad.

## Fuentes

Aplicación del equipo basada en la práctica ITIL 4 de monitoreo y gestión de eventos de [PeopleCert](https://www.peoplecert.org/professionals/certifications/browse-certifications/it-governance-and-service-management/ITIL-1/itil4-practices-monitoring-and-event-management-3686), las recomendaciones de [Google SRE sobre monitoreo](https://sre.google/sre-book/monitoring-distributed-systems/) y [Lens 8.19 de Elastic](https://www.elastic.co/guide/en/kibana/8.19/lens.html). Son referencias de diseño; no una certificación de cumplimiento integral de ITIL.
