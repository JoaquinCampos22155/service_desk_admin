# Bevstack Service Desk

Demo web de una mesa de servicio virtual para Bevstack, enfocada en la atención de las marcas por Account Management y de los consumidores por Customer Service.

## Ejecutar localmente

Desde la raíz del repositorio, inicia un servidor estático local:

```powershell
py -m http.server 8000
```

Luego abre `http://localhost:8000` en un navegador moderno. Los tickets de demostración y las modificaciones se guardan en el almacenamiento local de ese navegador.

## Pruebas

La aplicación es estática y no requiere Vite, React ni instalación de paquetes. Ejecuta la suite con Node.js:

```powershell
node --test tests/app.test.js
```

## Alcance de esta demo

- Las marcas ingresan solicitudes e incidentes por el portal.
- Customer Service registra los casos recibidos de consumidores.
- Incidentes y solicitudes comparten un único registro, pero tienen colas y métricas diferenciadas.
- El equipo de soporte puede priorizar, asignar, actualizar y comentar tickets.
- El tablero grafica tickets por categoría.
- La sección Análisis de problemas agrupa patrones recurrentes, enlaza incidentes relacionados y permite documentar investigación, workaround y acciones correctivas.

La demo no se conecta a Freshdesk ni a sistemas de pago, comercio electrónico o proveedores externos. Utiliza datos ficticios y almacenamiento local; no está destinada a producción.

Consulta [docs/modelo-operativo.md](docs/modelo-operativo.md) para el catálogo, matriz de prioridades, metas de servicio, OLAs, rutas de escalamiento y análisis de problemas. La trazabilidad de la rúbrica y los escenarios de demo están en [docs/criterios-de-aceptacion.md](docs/criterios-de-aceptacion.md).
