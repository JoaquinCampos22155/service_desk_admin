-- Datos ficticios para poblar el Service Desk por primera vez.
-- Ejecuta este archivo una vez desde Supabase > SQL Editor.
-- Los IDs DEMO hacen que se pueda volver a ejecutar sin duplicar registros.
-- No son tickets reales y no incluyen datos personales reales.

with demo_tickets (
  id, subject, category_id, type, impact, urgency, priority, status,
  assignee, communication_owner, channel, brand, order_id, description,
  requester_type, requester_name, requester_email, age_hours, public_update
) as (
  values
    ('DEMO-001', '[DEMO] Pago confirmado, pedido no creado', 'payment-without-order', 'Incidente', 'Alto', 'Alta', 'P1', 'Escalado', 'Team de Tech', 'Customer Service', 'Correo de Customer Service', 'Nébula Spirits', 'DEMO-ORD-001', 'Caso ficticio: el cobro se confirmó, pero la orden no aparece en el panel operativo.', 'Consumidor', 'Consumidor de demostración', 'demo@example.com', 6, 'Caso de demostración: Customer Service confirmó el cobro y escaló la revisión de sincronización.'),
    ('DEMO-002', '[DEMO] Pedidos detenidos en preparación', 'unprocessed-order', 'Incidente', 'Alto', 'Media', 'P1', 'En progreso', 'Team de Tech', 'Account Management', 'Portal de marca', 'Casa Nómada', 'DEMO-ORD-002', 'Caso ficticio: varias órdenes no avanzan al siguiente paso del flujo de procesamiento.', 'Marca', 'Equipo de operaciones (demo)', 'operaciones@casa-nomada.example', 10, 'Caso de demostración: Account Management mantiene informada a la marca mientras Tech revisa la cola.'),
    ('DEMO-003', '[DEMO] Diferencia de inventario en producto destacado', 'incorrect-inventory', 'Incidente', 'Medio', 'Alta', 'P1', 'En espera', 'Team de Tech', 'Account Management', 'Portal de marca', 'Altura Gin', 'DEMO-ORD-003', 'Caso ficticio: la tienda muestra unidades disponibles que no coinciden con el inventario reportado.', 'Marca', 'Equipo de operaciones (demo)', 'operaciones@altura-gin.example', 18, 'Caso de demostración: se solicitó una nueva lectura del feed de inventario.'),
    ('DEMO-004', '[DEMO] Envío express no aparece en checkout', 'shipping-unavailable', 'Incidente', 'Medio', 'Alta', 'P1', 'Nuevo', 'Customer Service', 'Customer Service', 'WhatsApp de Customer Service', 'Fuego Norte', 'DEMO-ORD-004', 'Caso ficticio: una persona consumidora no puede elegir envío express dentro de la cobertura esperada.', 'Consumidor', 'Consumidor de demostración', 'demo@example.com', 25, null),
    ('DEMO-005', '[DEMO] Activación de tienda para nueva marca', 'new-store', 'Solicitud', 'Medio', 'Media', 'P2', 'En progreso', 'Account Management', 'Account Management', 'Portal de marca', 'Fuego Norte', '', 'Caso ficticio: preparar una nueva tienda y validar catálogo, cobertura y operación antes de lanzamiento.', 'Marca', 'Equipo de operaciones (demo)', 'operaciones@fuego-norte.example', 31, 'Caso de demostración: checklist iniciado; se revisan datos de catálogo y configuración.'),
    ('DEMO-006', '[DEMO] Ajuste de tarifa para cobertura regional', 'shipping-rules', 'Solicitud', 'Bajo', 'Alta', 'P2', 'Nuevo', 'Account Management', 'Account Management', 'Portal de marca', 'Nébula Spirits', '', 'Caso ficticio: actualizar la tarifa de envío para una zona regional a partir de una fecha acordada.', 'Marca', 'Equipo de operaciones (demo)', 'operaciones@nebula.example', 37, null),
    ('DEMO-007', '[DEMO] Doble cargo reportado en una compra', 'payment-without-order', 'Incidente', 'Alto', 'Alta', 'P1', 'En progreso', 'Team de Tech', 'Customer Service', 'Correo de Customer Service', 'Casa Nómada', 'DEMO-ORD-007', 'Caso ficticio: el comprobante muestra dos cargos asociados a una sola compra.', 'Consumidor', 'Consumidor de demostración', 'demo@example.com', 43, 'Caso de demostración: Customer Service solicitó comprobantes y Tech revisa los eventos de pago.'),
    ('DEMO-008', '[DEMO] Reglas de envío no aplican para una zona', 'shipping-unavailable', 'Incidente', 'Medio', 'Media', 'P2', 'Resuelto', 'Team de Tech', 'Account Management', 'Portal de marca', 'Altura Gin', 'DEMO-ORD-008', 'Caso ficticio: la zona está habilitada en la configuración, pero no aparece como opción al comprar.', 'Marca', 'Equipo de operaciones (demo)', 'operaciones@altura-gin.example', 51, 'Caso de demostración: configuración corregida y validada con un pedido de prueba.'),
    ('DEMO-009', '[DEMO] Actualizar ficha de productos', 'product-config', 'Solicitud', 'Bajo', 'Media', 'P3', 'En espera', 'Account Management', 'Account Management', 'Portal de marca', 'Casa Nómada', '', 'Caso ficticio: actualizar descripciones y atributos de dos productos antes de publicarlos.', 'Marca', 'Equipo de operaciones (demo)', 'operaciones@casa-nomada.example', 56, 'Caso de demostración: falta confirmación de los textos finales por parte de la marca.'),
    ('DEMO-010', '[DEMO] Órdenes de la mañana sin procesar', 'unprocessed-order', 'Incidente', 'Alto', 'Alta', 'P1', 'Escalado', 'Proveedor externo', 'Account Management', 'Portal de marca', 'Nébula Spirits', 'DEMO-ORD-010', 'Caso ficticio: un grupo de órdenes sigue pendiente luego de una interrupción del conector.', 'Marca', 'Equipo de operaciones (demo)', 'operaciones@nebula.example', 62, 'Caso de demostración: Account Management compartió el impacto con la marca y escaló al proveedor.'),
    ('DEMO-011', '[DEMO] Existencias agotadas siguen visibles', 'incorrect-inventory', 'Incidente', 'Medio', 'Media', 'P2', 'Cerrado', 'Customer Service', 'Customer Service', 'Correo de Customer Service', 'Fuego Norte', 'DEMO-ORD-011', 'Caso ficticio: un consumidor pudo comprar un artículo que ya no tenía existencias disponibles.', 'Consumidor', 'Consumidor de demostración', 'demo@example.com', 68, 'Caso de demostración: se confirmó el ajuste de inventario y se notificó el cierre.'),
    ('DEMO-012', '[DEMO] Preparación de tienda para campaña', 'new-store', 'Solicitud', 'Bajo', 'Baja', 'P3', 'Cerrado', 'Account Management', 'Account Management', 'Portal de marca', 'Altura Gin', '', 'Caso ficticio: habilitar una tienda de demostración antes de una campaña comercial.', 'Marca', 'Equipo de operaciones (demo)', 'operaciones@altura-gin.example', 74, 'Caso de demostración: lista de verificación completada y aprobada.'),
    ('DEMO-013', '[DEMO] Pago recibido sin reflejar la compra', 'payment-without-order', 'Incidente', 'Alto', 'Media', 'P1', 'En progreso', 'Team de Tech', 'Customer Service', 'WhatsApp de Customer Service', 'Nébula Spirits', 'DEMO-ORD-013', 'Caso ficticio: la persona consumidora presenta confirmación de pago, pero no recibe confirmación de orden.', 'Consumidor', 'Consumidor de demostración', 'demo@example.com', 81, 'Caso de demostración: Customer Service confirmó recepción y Tech revisa la conciliación.'),
    ('DEMO-014', '[DEMO] Activar cobertura de fin de semana', 'shipping-rules', 'Solicitud', 'Medio', 'Baja', 'P3', 'En espera', 'Account Management', 'Account Management', 'Portal de marca', 'Fuego Norte', '', 'Caso ficticio: solicitar una regla de envío de fin de semana para una zona existente.', 'Marca', 'Equipo de operaciones (demo)', 'operaciones@fuego-norte.example', 87, 'Caso de demostración: pendiente de validación de cobertura y fecha de vigencia.'),
    ('DEMO-015', '[DEMO] Inventario no sincroniza después de reposición', 'incorrect-inventory', 'Incidente', 'Alto', 'Media', 'P1', 'En progreso', 'Team de Tech', 'Account Management', 'Portal de marca', 'Casa Nómada', 'DEMO-ORD-015', 'Caso ficticio: el inventario actualizado no se refleja en la tienda después de una reposición.', 'Marca', 'Equipo de operaciones (demo)', 'operaciones@casa-nomada.example', 94, 'Caso de demostración: Tech revisa la frecuencia de sincronización; AM mantiene la comunicación.'),
    ('DEMO-016', '[DEMO] Ajuste de horario de corte de órdenes', 'operational-config', 'Solicitud', 'Medio', 'Media', 'P2', 'Resuelto', 'Account Management', 'Account Management', 'Portal de marca', 'Nébula Spirits', '', 'Caso ficticio: cambiar el horario de corte de lunes a viernes para alinearlo con la operación.', 'Marca', 'Equipo de operaciones (demo)', 'operaciones@nebula.example', 101, 'Caso de demostración: el nuevo horario quedó configurado y validado.'),
    ('DEMO-017', '[DEMO] Opción de entrega local no disponible', 'shipping-unavailable', 'Incidente', 'Bajo', 'Alta', 'P2', 'Nuevo', 'Customer Service', 'Customer Service', 'Correo de Customer Service', 'Altura Gin', 'DEMO-ORD-017', 'Caso ficticio: la opción de entrega local no está disponible para una dirección dentro de la zona.', 'Consumidor', 'Consumidor de demostración', 'demo@example.com', 110, null),
    ('DEMO-018', '[DEMO] Varias órdenes permanecen en cola', 'unprocessed-order', 'Incidente', 'Medio', 'Alta', 'P1', 'Resuelto', 'Team de Tech', 'Account Management', 'Portal de marca', 'Fuego Norte', 'DEMO-ORD-018', 'Caso ficticio: varias órdenes retrasaron su transición desde recibida hacia preparación.', 'Marca', 'Equipo de operaciones (demo)', 'operaciones@fuego-norte.example', 119, 'Caso de demostración: la cola fue procesada y Account Management confirmó el resultado.'),
    ('DEMO-019', '[DEMO] Cambio de atributos en productos publicados', 'product-config', 'Solicitud', 'Bajo', 'Baja', 'P3', 'En progreso', 'Account Management', 'Account Management', 'Portal de marca', 'Nébula Spirits', '', 'Caso ficticio: actualizar atributos visibles de productos en la tienda.', 'Marca', 'Equipo de operaciones (demo)', 'operaciones@nebula.example', 128, 'Caso de demostración: cambios en revisión antes de publicar.'),
    ('DEMO-020', '[DEMO] Consulta por artículo comprado sin confirmación', 'payment-without-order', 'Incidente', 'Medio', 'Media', 'P2', 'Cerrado', 'Customer Service', 'Customer Service', 'WhatsApp de Customer Service', 'Casa Nómada', 'DEMO-ORD-020', 'Caso ficticio: consumidor solicita apoyo porque el pago aparece aprobado y la confirmación no llegó.', 'Consumidor', 'Consumidor de demostración', 'demo@example.com', 137, 'Caso de demostración: se localizó la orden y Customer Service confirmó la resolución.'),
    ('DEMO-021', '[DEMO] Tarifa de envío requiere revisión', 'shipping-rules', 'Solicitud', 'Bajo', 'Media', 'P3', 'Cerrado', 'Account Management', 'Account Management', 'Portal de marca', 'Casa Nómada', '', 'Caso ficticio: revisar una tarifa de envío programada y dejar registro de la aprobación.', 'Marca', 'Equipo de operaciones (demo)', 'operaciones@casa-nomada.example', 143, 'Caso de demostración: cambio aplicado y comunicado a la marca.'),
    ('DEMO-022', '[DEMO] Diferencia de existencias en varios SKU', 'incorrect-inventory', 'Incidente', 'Medio', 'Alta', 'P1', 'En espera', 'Proveedor externo', 'Account Management', 'Portal de marca', 'Fuego Norte', 'DEMO-ORD-022', 'Caso ficticio: varios SKU muestran cantidades desactualizadas después de una sincronización.', 'Marca', 'Equipo de operaciones (demo)', 'operaciones@fuego-norte.example', 151, 'Caso de demostración: se espera evidencia del proveedor para completar la conciliación.'),
    ('DEMO-023', '[DEMO] Pedido consumidor no pasa a preparación', 'unprocessed-order', 'Incidente', 'Medio', 'Media', 'P2', 'Nuevo', 'Customer Service', 'Customer Service', 'Correo de Customer Service', 'Altura Gin', 'DEMO-ORD-023', 'Caso ficticio: la orden aparece confirmada, pero no muestra avance hacia preparación.', 'Consumidor', 'Consumidor de demostración', 'demo@example.com', 158, null),
    ('DEMO-024', '[DEMO] Actualizar reglas para temporada alta', 'shipping-rules', 'Solicitud', 'Bajo', 'Baja', 'P3', 'Cerrado', 'Account Management', 'Account Management', 'Portal de marca', 'Nébula Spirits', '', 'Caso ficticio: ajuste planificado de condiciones de envío para una temporada de alta demanda.', 'Marca', 'Equipo de operaciones (demo)', 'operaciones@nebula.example', 165, 'Caso de demostración: actualización programada aplicada y revisada con la marca.')
)
insert into public.tickets (
  id, subject, category_id, type, impact, urgency, priority, status,
  assignee, communication_owner, channel, brand, order_id, description,
  requester_type, requester_name, requester_email, created_at, updated_at,
  comments, first_response_at, resolved_at, reopened_count, priority_changed_at
)
select
  id, subject, category_id, type, impact, urgency, priority, status,
  assignee, communication_owner, channel, brand, order_id, description,
  requester_type, requester_name, requester_email,
  now() - make_interval(hours => age_hours),
  now() - make_interval(hours => age_hours) + interval '2 hours',
  case
    when public_update is null then '[]'::jsonb
    else jsonb_build_array(jsonb_build_object(
      'id', id || '-C1',
      'author', communication_owner,
      'body', public_update,
      'visibility', 'Público',
      'createdAt', now() - make_interval(hours => age_hours) + interval '15 minutes'
    ))
  end,
  case when status = 'Nuevo' then null else now() - make_interval(hours => age_hours) + interval '10 minutes' end,
  case when status in ('Resuelto', 'Cerrado') then now() - make_interval(hours => age_hours) + interval '1 hour' else null end,
  0,
  null
from demo_tickets
on conflict (id) do nothing
returning id;

-- Para retirar únicamente estos datos de demostración desde SQL Editor:
-- delete from public.tickets where id like 'DEMO-%';
