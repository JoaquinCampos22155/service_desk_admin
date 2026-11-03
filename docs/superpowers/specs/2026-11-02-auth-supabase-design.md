# Diseño propuesto: autenticación y datos compartidos con Supabase

**Estado:** aprobado por el usuario; detalle de alcance afinado tras revisar la app  
**Fecha:** 2026-11-02

## Intención

Permitir que el equipo Bevstack use el Service Desk desde distintos navegadores con una sola sesión protegida y un registro compartido de tickets y categorías personalizadas. La app estática actual guarda tickets y categorías en `localStorage`, por lo que los datos de cada navegador no están sincronizados.

## Objetivos

- Proteger toda la app detrás de un inicio de sesión con correo y contraseña.
- Permitir el acceso únicamente a cuentas creadas o invitadas por el equipo desde Supabase; no habilitar registro público ni una pantalla para administrar usuarios.
- Dar los mismos permisos a todas las cuentas autenticadas para las operaciones que ya ofrece la app: consultar, crear, editar, mover y comentar tickets; consultar y crear categorías personalizadas.
- Guardar tickets y categorías personalizadas en Supabase para que el equipo comparta los mismos datos entre dispositivos.
- Mantener el catálogo estándar de categorías en el código y usar la tabla compartida solo para categorías agregadas por el equipo.
- Dejar la base inicialmente sin tickets y sin importar los registros del navegador actual. Cada ticket creado después del cambio se guardará en la base compartida.
- Conservar el análisis de problemas y sus anotaciones manuales en el navegador en esta etapa. Los gráficos que se calculan a partir de tickets usarán el conjunto compartido de Supabase.
- Proporcionar estados claros de carga, sesión vencida, error de conexión y base vacía, sin simular un guardado exitoso cuando falle la escritura.

## No objetivos de esta etapa

- Importar tickets, categorías personalizadas o registros de análisis existentes desde `localStorage`.
- Implementar roles diferentes, permisos por marca, acceso de consumidores o un portal externo.
- Construir un panel para invitar o administrar usuarios; las cuentas se gestionan desde Supabase.
- Implementar el historial descargable de cambios. Queda como mejora posterior.
- Añadir nuevas acciones de eliminación de tickets o edición/eliminación de categorías; no existen actualmente en la app.
- Cambiar los estados, reglas de prioridad, diseño visual ni métricas de la operación.
- Desplegar por el usuario. La configuración final de Render y Supabase se documentará para que las credenciales del proyecto se configuren sin agregarlas al repositorio.

## Experiencia y comportamiento

1. Una persona no autenticada ve una página de inicio de sesión, no el tablero ni datos de la aplicación.
2. Una cuenta válida inicia sesión con correo y contraseña; la sesión persiste y se restaura al recargar. El usuario puede cerrar sesión desde la app y solicitar un correo de restablecimiento si olvida la contraseña.
3. Las cuentas nuevas se crean/invitan manualmente desde el panel de Supabase. El registro público se mantiene deshabilitado.
4. Al iniciar sesión, la app carga tickets y categorías personalizadas desde Supabase antes de mostrar el Service Desk. El primer inicio después de este cambio muestra una cola vacía, no la semilla de demostración local.
5. Crear, editar, cambiar estado y comentar un ticket escribe en Supabase. Las altas de categorías personalizadas también se comparten. La app actualiza la interfaz luego de una respuesta exitosa y muestra un error accionable si la operación falla.
6. Las páginas de resumen, colas y análisis leen el mismo conjunto de tickets compartidos. Las notas manuales del análisis de problemas siguen ligadas al almacenamiento local de cada navegador.

## Datos y seguridad

- Usar una tabla `tickets` con una fila por ticket y campos que correspondan al modelo actual; comentarios y datos auxiliares pueden permanecer en columnas JSONB si eso preserva el formato de la app sin bloquear su uso compartido.
- Usar una tabla `custom_categories` con una fila por categoría personalizada y campos de nombre, tipo, descripción, reportante y responsable. Las categorías estándar siguen definidas en el código.
- Crear una migración SQL reproducible bajo `supabase/migrations/` para tablas, restricciones, grants y políticas RLS.
- Activar RLS en todas las tablas expuestas y permitir solo las operaciones de la app al rol autenticado (lectura, alta y actualización de tickets; lectura y alta de categorías). No debe existir acceso de lectura o escritura para `anon`.
- Usar Supabase Auth para asociar cada petición con la cuenta activa. El cliente usa solo URL y publishable key; nunca se incluye `service_role` ni otra clave secreta en el navegador o en Git.
- Render seguirá sirviendo archivos estáticos. Se propone usar Vite para compilar y suministrar `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en tiempo de build; el archivo de variables locales no se sube al repositorio.
- Mantener un estado de datos único en Supabase, sin respaldo silencioso en `localStorage` para tickets, para evitar que dos navegadores diverjan.

## Criterios de aceptación

- Una visita sin sesión no puede acceder a ninguna vista del Service Desk ni leer datos desde la API de Supabase.
- Una cuenta autenticada puede ver la cola compartida y ejecutar el ciclo existente de trabajo de tickets.
- Un ticket y una categoría personalizada creados en un navegador aparecen después de recargar y en un segundo navegador autenticado.
- Un fallo de red o de autorización no se presenta como escritura exitosa ni descarta silenciosamente los cambios del formulario.
- La base recién configurada no contiene tickets de la demo ni importa el almacenamiento local anterior.
- No se publica ninguna clave secreta; RLS restringe las tablas a usuarios autenticados.
- Las pruebas existentes siguen pasando y se agregan pruebas de sesión, persistencia, permisos y estados de error.

## Decisiones pendientes del constructor

- Elegir el modelo SQL concreto para conservar los campos actuales y comentarios sin hacer una reescritura innecesaria.
- Elegir el mecanismo de sesión de Supabase que mejor se adapte al cliente Vite y las URLs locales/Render.
- Resolver la actualización visual en operaciones asíncronas y los conflictos de edición concurrente por ticket.
- Documentar la configuración en Supabase y Render sin requerir que se compartan secretos en el chat o repositorio.

## Decisión de diseño

- Incluir recuperación de contraseña por correo para cuentas existentes. Es una función estándar de Supabase Auth, evita bloquear a un compañero por olvidar su contraseña y no permite crear cuentas nuevas.

## Referencias técnicas

- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase: Auth](https://supabase.com/docs/guides/auth)
