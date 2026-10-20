# Modelo operativo del Service Desk Bevstack

## Propósito y alcance

La demo representa una mesa virtual como punto único de contacto y registro para la operación de e-commerce de las marcas en Bevstack.

- Las marcas ingresan solicitudes e incidentes desde el portal y reciben atención inicial de Account Management.
- Los consumidores contactan los canales de atención de la marca; Customer Service registra sus casos en el Service Desk y coordina el seguimiento.
- Account Management mantiene informadas a las marcas y Customer Service a los consumidores. Tech conserva la responsabilidad del diagnóstico técnico, aunque tenga la asignación operativa.
- Integraciones, proveedores, developers externos, fulfillment y retailers permanecen como dependencias o escalaciones del servicio. No son módulos separados de la demo.
- Freshdesk aparece en el diseño de Fase 1 como herramienta elegida para la operación real. Esta aplicación propia es la demo web académica y no se conecta a Freshdesk.

El punto de entrada es uno a nivel de registro, aunque existan dos recorridos de captura. Todas las vías deben crear o actualizar el mismo historial del caso.

## Solicitud o incidente

| Tipo | Señal para clasificarlo | Objetivo de atención | Cola |
|---|---|---|---|
| Incidente | El servicio está interrumpido o funciona con calidad reducida sin planificación. | Restaurar el servicio y reducir el impacto. | Incidentes |
| Solicitud de servicio | El servicio funciona; el usuario pide una acción prevista, autorizada y repetible. | Cumplir la petición dentro del plazo acordado. | Solicitudes |

Ambos tipos se guardan en el registro común de tickets, pero se separan en las colas y en la medición para que solicitudes repetibles no desplacen incidentes y para que los indicadores representen trabajos comparables.

## Catálogo

| Categoría | Tipo | Descripción | Quién puede reportar | Atención inicial |
|---|---|---|---|---|
| Activación de una nueva tienda | Solicitud | Incorporar una tienda y dejarla lista para operar pedidos. | Responsable de e-commerce u operaciones de la marca. | Account Management |
| Cambio en reglas de envío | Solicitud | Modificar cobertura, tarifas o condiciones de envío. | Responsable de e-commerce u operaciones de la marca. | Account Management |
| Actualización de configuración de productos | Solicitud | Modificar información operativa que afecta venta o cumplimiento. | Responsable de e-commerce u operaciones de la marca. | Account Management |
| Cambio de configuración operativa | Solicitud | Ajustar parámetros de la tienda para su operación diaria. | Responsable autorizado de la marca. | Account Management |
| Pedido no procesado | Incidente | Una compra no avanzó correctamente al procesamiento. | Operaciones, e-commerce o consumidor atendido por Customer Service. | Account Management o Customer Service |
| Inventario incorrecto | Incidente | Disponibilidad mostrada no coincide con el inventario esperado. | Operaciones, e-commerce o consumidor atendido por Customer Service. | Account Management o Customer Service |
| Pago completado sin creación del pedido | Incidente | El cobro se registró, pero la orden no aparece en la operación. | Operaciones, e-commerce o consumidor atendido por Customer Service. | Customer Service y Team de Tech |
| Opción de envío no disponible | Incidente | No aparece una opción de envío que debería habilitarse para el pedido. | Operaciones, e-commerce o consumidor atendido por Customer Service. | Account Management o Customer Service |

La clasificación se hace por el comportamiento esperado: si algo que debía funcionar dejó de hacerlo, es incidente; si se pide una acción planificada y normal, es solicitud. No se decide por el canal ni por quién abrió el ticket.

## Impacto, urgencia y prioridad

El impacto mide cuántas marcas, pedidos, consumidores o procesos están afectados. La urgencia mide cuánto se deteriora la operación si no se actúa ahora.

| Impacto \ Urgencia | Alta | Media | Baja |
|---|---:|---:|---:|
| Alto | P1 | P1 | P2 |
| Medio | P1 | P2 | P3 |
| Bajo | P2 | P3 | P3 |

- Impacto alto: dos o más marcas afectadas, imposibilidad general de procesar pedidos, pagos afectados o riesgo de pérdida de ventas.
- Impacto medio: una marca o función importante afectada, con workaround que permite continuar parcialmente.
- Impacto bajo: caso individual o función secundaria sin impedir nuevas ventas ni procesar pedidos.
- Urgencia alta: la afectación está ocurriendo y esperar puede causar pedidos fallidos, cobros incorrectos o pérdida de ventas.
- Urgencia media: la operación continúa temporalmente, pero se necesita resolver durante el día hábil.
- Urgencia baja: puede programarse sin riesgo inmediato.

La prioridad se calcula por impacto y urgencia, no se fija por categoría. Ejemplos: pagos bloqueados para varias marcas deben entrar como P1; un cambio programado de configuración suele ser P3.

## Metas de servicio y medición

| Prioridad | Objetivo de primera respuesta | Objetivo de resolución/restauración o cumplimiento |
|---|---:|---:|
| P1 | 15 minutos | 4 horas |
| P2 | 1 hora | 24 horas |
| P3 | 4 horas | 3 días hábiles |

Las metas de Fase 1 se revisan mensualmente: al menos 95% de casos respondidos dentro del objetivo, al menos 95% resueltos/restaurados o cumplidos dentro del objetivo, y al menos 95% registrados, priorizados y asignados dentro del tiempo interno. Para incidentes, resolución significa restaurar; para solicitudes, significa completar la acción prevista. Los indicadores deben analizarse por marca, categoría y tipo de demanda para que un promedio global no esconda una experiencia deficiente.

### Vocabulario de compromisos

- **SLI:** indicador medible, como tiempo de primera respuesta o proporción de solicitudes cumplidas en plazo.
- **SLO:** valor objetivo interno asociado a un indicador y su ventana de medición.
- **SLA:** compromiso formal con la marca; debe especificar indicador, umbral, ventana, método de medición y consecuencia de incumplir.
- **OLA:** acuerdo entre equipos internos que sostiene un compromiso hacia la marca.
- **UC:** compromiso contractual equivalente al OLA cuando la dependencia es un proveedor externo.

Fase 1 denomina SLA a las metas del 95%. Como no especifica una consecuencia contractual por incumplir, esta demo las identifica como SLO internos. Antes de presentarlas como SLA formal, Bevstack y cada marca tendrían que acordar la consecuencia. La demo tampoco afirma que los compromisos de proveedores estén contratados; deben validarse como UC.

### Acuerdos operativos internos de Fase 1

| Equipo | Meta interna |
|---|---|
| Account Management / Customer Service | Registrar, priorizar y asignar P1 en 10 min, P2 en 30 min y P3 en 1 h. |
| Team de Tech | Iniciar revisión de P1 en 15 min, P2 en 1 h y P3 en 4 h; resolver o escalar con margen para cumplir el objetivo de resolución. |
| Directora de Tech | Revisar escalaciones críticas que necesitan decisión en un máximo de 30 min. |
| Developers externos | Confirmar recepción de escalaciones críticas en un máximo de 2 h cuando aplique; el compromiso externo debe confirmarse. |

La suma de tiempos de los equipos internos y de proveedores en el camino crítico debe caber dentro del objetivo hacia la marca, con margen para los traspasos.

## Niveles y escalamientos

| Nivel | Responsable | Responsabilidad |
|---|---|---|
| N1 | Account Management y Customer Service | Recibir, registrar, clasificar, priorizar, resolver lo documentado y mantener la comunicación. |
| N2 | Team de Tech | Diagnosticar y resolver routing, pedidos, inventario, integraciones y configuración. |
| N3 | Developers externos o proveedor | Atender causas bajo su responsabilidad o desarrollo externo; Tech conserva seguimiento. |

- **Escalamiento funcional:** mover el trabajo hacia quien tiene más conocimiento o capacidad técnica. Por ejemplo, N1 a Tech o Tech al proveedor.
- **Escalamiento jerárquico:** pedir una decisión, recursos, prioridad o autorización a la directora de Tech, al CEO o al responsable comercial según el caso.
- **Ambos a la vez:** Tech investiga mientras dirección autoriza recursos o negocia con un tercero.
- **Ninguno:** el nivel que recibió el caso tiene conocimiento y autoridad para resolverlo; el caso debe permanecer allí.

La atención regular opera de lunes a viernes, de 9:00 a. m. a 6:00 p. m., hora del Este de EE. UU. Los casos críticos que impiden procesar pedidos o afectan de forma general una tienda se escalan fuera de horario a la directora de Tech & Onboarding.

## Mejora continua

En la revisión mensual se contrastan indicadores con la experiencia de cada marca. Si una meta falla, se registran causa, tickets afectados, acción correctiva, responsable y fecha. Dos periodos consecutivos de incumplimiento abren un registro de problema. También se revisan resolución en primer contacto, satisfacción al cierre y reaperturas; cerrar tickets rápidamente no basta si el mismo problema regresa.

### Gestión y mapa de problemas en la demo

Un incidente describe una interrupción y busca restaurar el servicio; un problema investiga la causa subyacente de uno o varios incidentes para evitar que se repitan. La sección **Análisis de problemas** agrupa incidentes por categoría del catálogo y enlaza cada patrón con sus tickets. Esa agrupación sirve para detectar señales, pero no demuestra por sí sola que todos los tickets compartan una causa raíz.

Como todavía no existe una regla oficial de Bevstack para priorizar problemas, la demo usa una heurística provisional, en este orden: prioridad del patrón, cantidad de marcas afectadas, reaperturas y cantidad de incidentes. También marca como candidato a investigación un patrón con dos o más incidentes o con al menos un P1. Estos umbrales son configurables como criterio de trabajo académico y deben validarse con Bevstack antes de tratarlos como política operativa.

Cada análisis puede documentar estado (investigando, error conocido, mitigado o resuelto), responsable, causa raíz o hipótesis, workaround para N1 y acción o solución permanente. La causa queda “por determinar” hasta contar con evidencia de Tech; el gráfico muestra el volumen por categoría y el conteo P1, no una causa inferida automáticamente. Al resolver, se valida que la acción evite recurrencia y se actualiza el registro relacionado.

La asignación de investigación y la comunicación al usuario son responsabilidades distintas. Una actualización pública siempre aparece emitida por Account Management para una marca o Customer Service para un consumidor, incluso si la investigación está asignada a Tech o al proveedor. Las notas internas quedan atribuidas al equipo de soporte.
