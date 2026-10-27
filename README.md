# Bevstack Service Desk

Demo web de una mesa de servicio virtual para Bevstack, enfocada en la atención de las marcas por Account Management y de los consumidores por Customer Service.

## Ejecutar localmente

La demo es una página estática: no necesita instalar dependencias, configurar una base de datos ni tener Vite/React. Solo necesitas Python 3 para levantar el servidor local y un navegador moderno.

1. Clona o descarga el repositorio y abre una terminal en la carpeta del proyecto, donde está `index.html`.
2. En Windows, abre PowerShell desde esa carpeta y ejecuta:

```powershell
py -m http.server 8000
```

Si el comando `py` no está disponible, prueba `python -m http.server 8000`.

3. Mientras la terminal siga abierta, visita [http://localhost:8000](http://localhost:8000) en el navegador. Si el navegador muestra un listado de archivos, verifica que la terminal esté ubicada en la raíz del proyecto y abre la dirección otra vez.
4. Para detener el servidor, vuelve a la terminal y presiona `Ctrl+C`.

Si el puerto 8000 ya está ocupado, inicia el servidor con otro puerto —por ejemplo, `py -m http.server 8080`— y visita `http://localhost:8080`.

Los tickets de demostración y las modificaciones se guardan en el almacenamiento local del navegador. Por eso, los cambios solo aparecen en ese navegador y equipo; no se comparten con los demás integrantes ni se conservan como datos de producción.

## Pruebas

Opcionalmente, con Node.js instalado, ejecuta la suite desde la raíz del repositorio:

```powershell
node --test tests/app.test.js
```

## Alcance de esta demo

- Las marcas ingresan solicitudes e incidentes por el portal.
- Customer Service registra los casos recibidos de consumidores.
- Incidentes y solicitudes comparten un único registro, pero tienen colas y métricas diferenciadas.
- El equipo de soporte puede priorizar, asignar, actualizar y comentar tickets.
- El tablero muestra la entrada diaria de incidentes/solicitudes, p50/p95 de primera respuesta hábil por prioridad frente al SLO y antigüedad de la cola activa. Incluye conteos compactos de origen y prioridad; Análisis de problemas agrupa todos los tickets por categoría y conserva el mapa de investigación para incidentes.
- La vista Todos los tickets resume estados activos, resueltos y cerrados, con una distinción visual y operativa entre Resuelto y Cerrado.
- Niveles de servicio detalla SLI/SLO, fórmulas, metas, cobertura de datos y brechas de medición; no atribuye resultados reales a los datos ficticios.
- La sección Análisis de problemas agrupa patrones recurrentes, enlaza incidentes relacionados y permite documentar investigación, workaround y acciones correctivas.

La demo no se conecta a Freshdesk ni a sistemas de pago, comercio electrónico o proveedores externos. Utiliza datos ficticios y almacenamiento local; no está destinada a producción.

Consulta [docs/modelo-operativo.md](docs/modelo-operativo.md) para el catálogo, matriz de prioridades, metas de servicio, OLAs, rutas de escalamiento y análisis de problemas. La trazabilidad de la rúbrica y los escenarios de demo están en [docs/criterios-de-aceptacion.md](docs/criterios-de-aceptacion.md).
