# Bevstack Service Desk

Demo web de una mesa de servicio virtual para Bevstack, enfocada en la atención de las marcas por Account Management y de los consumidores por Customer Service.

## Ejecutar localmente

Necesitas Node.js 22.12 o posterior y pnpm.

1. Instala las dependencias desde la raíz del proyecto:

```powershell
pnpm install
```

2. Configura Supabase siguiendo la sección siguiente.
3. Inicia el servidor de desarrollo:

```powershell
pnpm dev
```

4. Abre la dirección que muestra Vite, normalmente [http://localhost:5173](http://localhost:5173).
5. Detén el servidor con `Ctrl+C`.

La configuración local vive en `.env.local`, que Git ignora. Las variables `VITE_` se incluyen en el JavaScript del navegador; usa solo la publishable key y aplica la migración con RLS antes de habilitar usuarios.

## Configurar Supabase

La aplicación requiere un proyecto Supabase. La base comienza vacía: no se importan los tickets ni las categorías guardados anteriormente en el navegador.

1. Crea un proyecto en Supabase.
2. En **SQL Editor**, abre una consulta nueva, copia el contenido de [`supabase/migrations/202611020001_shared_service_desk.sql`](supabase/migrations/202611020001_shared_service_desk.sql) y ejecútalo. La migración crea las tablas compartidas, restricciones, índices, permisos y políticas RLS.
3. En **Authentication → Settings** (o configuración de proveedores), desactiva **Allow new users to sign up**. Mantén habilitado el proveedor de correo y contraseña.
4. En la configuración de URL de Auth, establece como **Site URL** el origen principal que usarás. Agrega estos destinos permitidos:
   - `http://localhost:5173/**`
   - `https://bevstack-service-desk.onrender.com/**`
5. En **Authentication → Users**, invita o crea las cuentas del equipo. No hay registro público ni roles distintos dentro de la aplicación.
6. En **Project Settings → API Keys** o en el diálogo **Connect**, copia la Project URL y la publishable key. Pégalas en `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

La publishable key queda visible en la app web; las políticas RLS limitan las operaciones a sesiones autenticadas. Nunca uses una secret key o `service_role` en las variables `VITE_`.

Para recuperación de contraseña, Auth envía un enlace al correo y regresa al origen actual. El equipo puede cambiar su contraseña desde ese enlace.

## Configurar el sitio en Render

En el Static Site `bevstack-service-desk`, abre **Environment** y agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` con los mismos valores de `.env.local`. Vite incorpora estas variables durante el build; después de guardarlas, inicia un deploy manual desde Render para que el sitio use la configuración nueva. No agregues claves secretas o `service_role` al frontend.

## Datos que se comparten

- Tickets y comentarios se leen y guardan en la tabla compartida `tickets`.
- Las categorías personalizadas se leen y guardan en `custom_categories`; el catálogo estándar sigue definido en la aplicación.
- Los tickets reciben su identificador desde la base de datos para evitar colisiones entre personas.
- El análisis manual de problemas sigue guardado en el navegador de cada usuario; los gráficos del análisis se calculan con los tickets compartidos.
- La app no presenta un guardado exitoso cuando Supabase rechaza una escritura o no está disponible.
- El historial descargable de actividad no forma parte de esta etapa.

### Poblar el tablero con tickets de demostración

Si quieres que el resumen y las gráficas tengan datos iniciales, abre [`supabase/seeds/demo_tickets.sql`](supabase/seeds/demo_tickets.sql), copia su contenido en **Supabase → SQL Editor → New query** y ejecútalo. Inserta 24 tickets ficticios fechados dentro de los últimos siete días, con marcas y consumidores de demostración, sin información personal real. Los IDs `DEMO-` evitan duplicados si vuelves a ejecutar el script. Estos registros quedan en la base compartida y cuentan en las métricas; para retirarlos, el archivo incluye una consulta de limpieza comentada que puedes ejecutar por separado.

## Pruebas

Opcionalmente, con Node.js instalado, ejecuta la suite desde la raíz del repositorio:

```powershell
pnpm test
pnpm build
```

La prueba de políticas PostgreSQL usa pgTAP y el Supabase local, por lo que requiere Docker Desktop activo:

```powershell
pnpm supabase start
pnpm test:db
pnpm supabase stop
```

## Alcance de esta demo

- Las marcas ingresan solicitudes e incidentes por el portal.
- Customer Service registra los casos recibidos de consumidores.
- Incidentes y solicitudes comparten un único registro, pero tienen colas y métricas diferenciadas.
- El equipo de soporte puede priorizar, asignar, actualizar y comentar tickets.
- El tablero muestra la entrada diaria de incidentes/solicitudes, p50/p95 de primera respuesta hábil por prioridad frente al SLO y antigüedad de la cola activa. Incluye conteos compactos de origen y prioridad; Análisis de problemas agrupa todos los tickets por categoría y conserva el mapa de investigación para incidentes.
- La vista Todos los tickets resume estados activos, resueltos y cerrados, con una distinción visual y operativa entre Resuelto y Cerrado.
- Niveles de servicio detalla SLI/SLO, fórmulas, metas, cobertura de datos y brechas de medición; distingue la cobertura registrada del cumplimiento real.
- La sección Análisis de problemas agrupa patrones recurrentes, enlaza incidentes relacionados y permite documentar investigación, workaround y acciones correctivas.

La demo no se conecta a Freshdesk ni a sistemas de pago, comercio electrónico o proveedores externos. Con Supabase configurado, tickets y categorías son compartidos; las notas de análisis manual permanecen locales.

Consulta [docs/modelo-operativo.md](docs/modelo-operativo.md) para el catálogo, matriz de prioridades, metas de servicio, OLAs, rutas de escalamiento y análisis de problemas. La trazabilidad de la rúbrica y los escenarios de demo están en [docs/criterios-de-aceptacion.md](docs/criterios-de-aceptacion.md).
