# Bevstack Service Desk

Demo web de una mesa de servicio virtual para Bevstack, enfocada en la atención de las marcas por Account Management y de los consumidores por Customer Service.

## Ejecutar localmente

Necesitas Node.js 20 o posterior y pnpm.

1. Instala las dependencias desde la raíz del proyecto:

```powershell
pnpm install
```

2. Copia `.env.example` a `.env.local` y completa la URL y publishable key del proyecto Supabase. No uses una clave `service_role` en el navegador.
3. Inicia el servidor de desarrollo:

```powershell
pnpm dev
```

4. Abre la dirección que muestra Vite, normalmente [http://localhost:5173](http://localhost:5173).
5. Detén el servidor con `Ctrl+C`.

La configuración local vive en `.env.local`, que Git ignora. Las variables `VITE_` se incluyen en el JavaScript del navegador; usa solo la publishable key y configura RLS antes de habilitar usuarios.

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
