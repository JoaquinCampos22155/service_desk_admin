create sequence public.ticket_id_seq
  start with 1049
  increment by 1
  no cycle;

create table public.tickets (
  id text primary key default ('BV-' || nextval('public.ticket_id_seq')::text),
  subject text not null,
  category_id text not null,
  type text not null check (type in ('Incidente', 'Solicitud')),
  impact text not null check (impact in ('Alto', 'Medio', 'Bajo')),
  urgency text not null check (urgency in ('Alta', 'Media', 'Baja')),
  priority text not null check (priority in ('P1', 'P2', 'P3')),
  status text not null check (status in ('Nuevo', 'En progreso', 'En espera', 'Escalado', 'Resuelto', 'Cerrado')),
  assignee text not null check (assignee in ('Account Management', 'Customer Service', 'Team de Tech', 'Directora de Tech', 'Proveedor externo')),
  communication_owner text not null check (communication_owner in ('Account Management', 'Customer Service')),
  channel text not null,
  brand text not null,
  order_id text not null default '',
  description text not null,
  requester_type text not null check (requester_type in ('Marca', 'Consumidor')),
  requester_name text not null,
  requester_email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  comments jsonb not null default '[]'::jsonb check (jsonb_typeof(comments) = 'array'),
  first_response_at timestamptz,
  resolved_at timestamptz,
  reopened_count integer not null default 0 check (reopened_count >= 0),
  priority_changed_at timestamptz
);

create function public.set_ticket_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.clock_timestamp();
  return new;
end;
$$;

create trigger tickets_set_updated_at
  before update on public.tickets
  for each row execute function public.set_ticket_updated_at();

revoke all on function public.set_ticket_updated_at() from public, anon, authenticated;

create index tickets_created_at_idx on public.tickets (created_at desc);
create index tickets_status_priority_idx on public.tickets (status, priority);
create index tickets_category_id_idx on public.tickets (category_id);

create table public.custom_categories (
  id text primary key,
  name text not null check (length(trim(name)) > 0),
  type text not null check (type in ('Incidente', 'Solicitud')),
  description text not null check (length(trim(description)) > 0),
  reporter text not null check (length(trim(reporter)) > 0),
  owner text not null check (length(trim(owner)) > 0),
  created_at timestamptz not null default now()
);

create unique index custom_categories_type_name_idx
  on public.custom_categories (type, lower(name));

alter table public.tickets enable row level security;
alter table public.custom_categories enable row level security;

revoke all on table public.tickets from anon, authenticated;
revoke all on table public.custom_categories from anon, authenticated;
revoke all on sequence public.ticket_id_seq from anon, authenticated;

grant select, insert, update on table public.tickets to authenticated;
grant select, insert on table public.custom_categories to authenticated;
grant usage, select on sequence public.ticket_id_seq to authenticated;

create policy tickets_select_authenticated
  on public.tickets for select to authenticated
  using (true);

create policy tickets_insert_authenticated
  on public.tickets for insert to authenticated
  with check (true);

create policy tickets_update_authenticated
  on public.tickets for update to authenticated
  using (true)
  with check (true);

create policy custom_categories_select_authenticated
  on public.custom_categories for select to authenticated
  using (true);

create policy custom_categories_insert_authenticated
  on public.custom_categories for insert to authenticated
  with check (true);
