# Entrega de monitoreo de la Fase 3

La entrega corresponde a la validación local del 15 de noviembre de 2026. Incluye los informes en Word y PDF y el paquete completo con configuraciones, API simulada, generador, dashboard, 500 logs de muestra y capturas originales.

- [Informe en PDF](Informe-tecnico-Fase-3-Bevstack.pdf)
- [Informe editable en Word](Informe-tecnico-Fase-3-Bevstack.docx)
- [Paquete completo de entrega](Entrega-Fase-3-Bevstack.zip)
- [Resultados y evidencia de la corrida](evidencias.json)
- [Captura del dashboard completo](../img/dashboard-kibana.png)
- [Política de alertas y prioridades](../fase-3-alertas.md)

Desde la raíz del repositorio, ejecutar `docker compose up -d` y abrir http://localhost:5601/app/dashboards#/view/bevstack-api-monitoring. También se puede extraer el paquete y ejecutar el mismo comando dentro de la carpeta extraída. Detener con `docker compose down`.

Los resultados incluyen una caída provocada, pérdida de señal de Heartbeat y un periodo con 60% de probabilidad de errores 5xx. El snapshot final conserva una P2 dentro de su banda de recuperación, explicada en el informe. Las prioridades son propuestas técnicas; Account Management valida impacto y urgencia. Las alertas se registran localmente en Elasticsearch y Kibana.

Validación: 109 pruebas del repositorio, 56 del paquete aislado y build del frontend aprobados. El informe mantiene título principal centrado, los demás encabezados a la izquierda, párrafos justificados y contenido en escala de grises.
