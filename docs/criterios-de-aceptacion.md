# Criterios de aceptación y trazabilidad de la rúbrica

## Cobertura de la evaluación

La rúbrica de Fase 2 distribuye su ponderación así:

| Ponderación | Criterio | Evidencia en el producto |
|---:|---|---|
| 25% | Sistema de Service Desk configurado con los requerimientos. | Formulario de ingreso, colas de seguimiento, detalle e historial de comentarios, edición por soporte y gráfica por categoría. |
| 50% | Identificación y categorización de servicios y problemas conforme a Fase 1. | Catálogo de ocho elementos, tipo solicitud/incidente, responsables AM/CS, prioridad por impacto/urgencia y mapa de patrones con análisis documentable. |
| 25% | Demo y presentación. | Recorrido de marca y consumidor; mostrar registro, cola, detalle, actualización, prioridades, gráficas de tickets y análisis de problemas. |

Las casillas indican cobertura implementada y revisada en código/documentación; la lógica de análisis, comunicación y filtros se valida con `node --test tests/app.test.js`, y `node --check app.js` valida sintaxis. Queda pendiente el ensayo interactivo completo de la demo en el navegador antes de presentar.

## Requisitos funcionales de Fase 2

- [x] Un representante de marca puede registrar una solicitud o un incidente en la web.
- [x] Customer Service puede registrar un caso recibido de un consumidor por los canales de atención existentes.
- [x] Los tickets comparten un registro único y conservan tipo, marca, canal, categoría, impacto, urgencia, prioridad y responsable.
- [x] Incidentes y solicitudes se ven en colas separadas aunque formen parte del mismo Service Desk.
- [x] La cola permite localizar, filtrar y ordenar tickets por prioridad, estado, tipo o marca.
- [x] Abrir un ticket muestra su descripción, datos de operación e historial de comentarios.
- [x] Soporte puede editar categoría, prioridad, estado, responsable, impacto y urgencia.
- [x] Soporte puede agregar comentarios visibles para el usuario y notas internas.
- [x] Los comentarios públicos salen desde Account Management para marcas y Customer Service para consumidores, independientemente de quién investigue el caso.
- [x] El gráfico agrupa todos los tickets guardados por categoría y distingue visualmente incidentes de solicitudes.
- [x] Los cambios y los tickets creados persisten al recargar la página en el mismo navegador.
- [x] La sección Análisis de problemas agrupa incidentes por categoría, enlaza los tickets relacionados y grafica volumen y P1.
- [x] Se puede documentar el estado, responsable, causa/hipótesis, workaround y acción permanente sin presentar una hipótesis como causa confirmada.

## Alineación de servicio y clasificación

- [x] Están las cuatro solicitudes de servicio de Fase 1: nueva tienda, reglas de envío, configuración de productos y configuración operativa.
- [x] Están los cuatro incidentes de Fase 1: pedido no procesado, inventario incorrecto, pago sin pedido y opción de envío no disponible.
- [x] Los casos de marca entran por Account Management; Customer Service registra en nombre del consumidor los casos recibidos por sus canales.
- [x] Incidente significa interrupción o reducción no planificada de calidad; solicitud significa acción prevista y repetible.
- [x] La matriz Alto/Medio/Bajo por urgencia Alta/Media/Baja produce P1/P2/P3 conforme al modelo operativo.
- [x] Las solicitudes no desplazan los incidentes: cada tipo conserva su cola y el objetivo de medición apropiado.
- [x] Los escalamientos funcionales a Tech/proveedor y jerárquicos a dirección aparecen como rutas diferentes.
- [x] Incidentes y problemas se distinguen: el primero busca restaurar; el segundo investiga causas y evita recurrencia.

## Escenarios para la demostración en clase

1. Una marca registra un incidente de pago que afecta varias marcas; se calcula P1 y aparece primero en la cola de incidentes.
2. Customer Service registra un caso de consumidor con número de pedido; el caso muestra la marca, canal y seguimiento correspondiente.
3. El equipo abre un ticket, registra una nota interna y una actualización visible, cambia responsable/estado y consulta el historial.
4. La demo muestra una solicitud planificada en su cola independiente y explica que su objetivo es cumplirla, no restaurar una falla.
5. El gráfico cuenta tickets por categoría y diferencia los volúmenes de incidentes y solicitudes.
6. El presentador explica impacto, urgencia, prioridad, tiempos objetivo, SLO/OLA y la ruta de escalamiento aplicable.
7. La sección de problemas ordena patrones con la heurística provisional, abre los tickets relacionados y documenta una investigación sin asumir una causa no comprobada.

## Límites de esta demo

La aplicación usa datos ficticios y almacenamiento local del navegador. No autentica usuarios, no conecta Freshdesk, no envía correos y no integra plataformas de e-commerce, pagos, fulfillment o proveedores. La demo ilustra el flujo requerido por el curso; una operación real necesitaría backend, permisos y persistencia compartida.
