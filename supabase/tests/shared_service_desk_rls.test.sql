begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

set local role anon;
select throws_ok(
  $$select id from public.tickets$$,
  '42501',
  null,
  'anon cannot read tickets'
);
select throws_ok(
  $$insert into public.custom_categories (id, name, type, description, reporter, owner)
    values ('anon-category', 'Anon category', 'Incidente', 'Test', 'Test', 'Customer Service')$$,
  '42501',
  null,
  'anon cannot create categories'
);

reset role;
set local role authenticated;

select results_eq(
  $$with inserted as (
      insert into public.tickets
        (subject, category_id, type, impact, urgency, priority, status, assignee,
         communication_owner, channel, brand, description, requester_type,
         requester_name, requester_email)
      values
        ('RLS ticket one', 'shipping-rules', 'Solicitud', 'Bajo', 'Baja', 'P3', 'Nuevo',
         'Account Management', 'Account Management', 'Portal de marca', 'Marca RLS',
         'Primer ticket de prueba', 'Marca', 'Equipo RLS', 'rls@example.test'),
        ('RLS ticket two', 'shipping-rules', 'Solicitud', 'Bajo', 'Baja', 'P3', 'Nuevo',
         'Account Management', 'Account Management', 'Portal de marca', 'Marca RLS',
         'Segundo ticket de prueba', 'Marca', 'Equipo RLS', 'rls@example.test')
      returning id
    )
    select count(distinct id)::bigint from inserted$$,
  array[2::bigint],
  'ticket IDs are unique when multiple tickets are inserted together'
);
select is(
  (select count(*)::bigint from public.tickets where brand = 'Marca RLS'),
  2::bigint,
  'authenticated users can read the shared tickets'
);
select lives_ok(
  $$update public.tickets set status = 'En progreso' where subject = 'RLS ticket one'$$,
  'authenticated users can update a ticket'
);
select throws_ok(
  $$delete from public.tickets where brand = 'Marca RLS'$$,
  '42501',
  null,
  'ticket deletion is not granted'
);
select lives_ok(
  $$insert into public.custom_categories (id, name, type, description, reporter, owner)
    values ('rls-category', 'RLS category', 'Incidente', 'Test', 'Equipo RLS', 'Customer Service')$$,
  'authenticated users can create shared categories'
);
select is(
  (select count(*)::bigint from public.custom_categories where id = 'rls-category'),
  1::bigint,
  'authenticated users can read shared categories'
);
select throws_ok(
  $$update public.custom_categories set name = 'Changed' where id = 'rls-category'$$,
  '42501',
  null,
  'category updates are not granted'
);
select throws_ok(
  $$insert into public.tickets
      (subject, category_id, type, impact, urgency, priority, status, assignee,
       communication_owner, channel, brand, description, requester_type,
       requester_name, requester_email)
    values ('Invalid status', 'shipping-rules', 'Solicitud', 'Bajo', 'Baja', 'P3', 'Triage',
       'Account Management', 'Account Management', 'Portal de marca', 'Marca RLS',
       'Invalid status test', 'Marca', 'Equipo RLS', 'rls@example.test')$$,
  '23514',
  null,
  'database rejects unsupported ticket states'
);

select * from finish();
rollback;
