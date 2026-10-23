-- Esquema del CRM de renovaciones. Se ejecuta una vez en Supabase → SQL Editor.
-- Todas las tablas tienen RLS activado y SIN políticas: solo la API (clave secreta, en el servidor) las lee y escribe.

-- Versión global: sube con cada cambio; el navegador pide "lo que cambió desde la versión N"
create sequence if not exists version_seq;

create table if not exists contactos (
  id           text primary key,
  nombre       text not null,
  email        text not null default '',
  wa           text,
  tel          text not null default '',
  tel_alt      text,
  pais         text not null default '',
  region       text not null default '',
  sede         text not null default '',
  hojas        text[] not null default '{}',
  fecha        date,
  -- valores que trae el Excel (se actualizan al reimportar)
  asignado     text not null default '',
  contacto     text not null default '',
  estado       text not null default 'pendiente',
  -- lo que el equipo cambia en el CRM (nunca lo toca una reimportación)
  asignado_crm text,
  contacto_crm text,
  estado_crm   text,
  motivo       text,
  no_contactar boolean,
  seguimiento  date,
  nuevo        boolean not null default false,  -- creado desde el CRM, no viene del Excel
  v            bigint not null default 0,       -- versión del último cambio en el CRM
  at           timestamptz,
  por          text
);
create index if not exists contactos_v_idx on contactos (v);

create table if not exists notas (
  id          bigint generated always as identity primary key,
  contacto_id text not null references contactos (id) on delete cascade,
  texto       text not null default '',
  fecha       text,        -- como viene del Excel (día) o ISO con hora
  hoja        text,
  por         text,
  estado      text,
  origen      text not null default 'excel' check (origen in ('excel', 'crm'))
);
create index if not exists notas_contacto_idx on notas (contacto_id, id);

create table if not exists actividad (
  v        bigint primary key,
  at       timestamptz not null default now(),
  por      text not null,
  id       text not null default '',
  nombre   text not null default '',
  texto    text not null,
  estado   text
);

create table if not exists usuarios (
  id            text primary key,
  nombre        text not null unique,
  alias         text[] not null default '{}',
  rol           text not null default 'usuario' check (rol in ('admin', 'usuario')),
  hash          text not null,
  activo        boolean not null default true,
  creado        timestamptz not null default now(),
  ultimo_acceso timestamptz
);

-- Una sola fila: plantillas de WhatsApp y meta
create table if not exists config (
  id         boolean primary key default true check (id),
  plantillas jsonb,
  meta       integer
);
-- cuándo y de dónde se importó la base (lo escribe scripts/subir-base.mjs)
alter table config add column if not exists base_generado text;
alter table config add column if not exists base_fuente text;
insert into config (id) values (true) on conflict do nothing;

alter table contactos enable row level security;
alter table notas     enable row level security;
alter table actividad enable row level security;
alter table usuarios  enable row level security;
alter table config    enable row level security;

-- Intentos fallidos de código por IP (frena a quien adivina códigos)
create table if not exists intentos (
  ip    text primary key,
  n     integer not null default 0,
  desde timestamptz not null default now()
);
alter table intentos enable row level security;

create or replace function intento_fallido(p_ip text) returns integer
language sql security definer set search_path = public as $$
  insert into intentos (ip, n, desde) values (p_ip, 1, now())
  on conflict (ip) do update set
    n = case when intentos.desde < now() - interval '10 minutes' then 1 else intentos.n + 1 end,
    desde = case when intentos.desde < now() - interval '10 minutes' then now() else intentos.desde end
  returning n
$$;

-- Id del cliente en el CRM del Club (su correo normalizado); lo llena la sincronización
alter table contactos add column if not exists ext_id text;

-- Avisos "este cliente renovó" que se envían al CRM del Club (api/_acceso.ts). El Club los aprueba a mano.
-- (La tabla anterior, solicitudes_acceso, ya no se usa: se puede borrar con "drop table solicitudes_acceso".)
create table if not exists solicitudes_renovacion (
  id           text primary key,  -- solicitud_id: se reenvía igual en cada reintento, así el Club no duplica
  contacto_id  text not null references contactos (id) on delete cascade,
  ext_id       text not null default '',
  renovado_por text not null default '',
  estado       text not null default 'pendiente' check (estado in ('pendiente', 'enviada', 'aprobada', 'fallida')),
  intentos     integer not null default 0,
  ultimo_error text,
  creada       timestamptz not null default now(),
  enviada      timestamptz
);
-- una sola solicitud abierta por contacto
create unique index if not exists solicitudes_abierta_idx on solicitudes_renovacion (contacto_id) where estado in ('pendiente', 'enviada');
alter table solicitudes_renovacion enable row level security;

-- Los cambios que modifican contactos se guardan con un candado: así la versión (v) sube en el mismo
-- orden en que se confirman y ningún navegador se salta un cambio al pedir "lo nuevo desde la versión N".

create or replace function crm_actividad(p_por text, p_texto text, p_id text default '', p_nombre text default '', p_estado text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_v bigint;
begin
  perform pg_advisory_xact_lock(7001);
  v_v := nextval('version_seq');
  insert into actividad (v, at, por, id, nombre, texto, estado) values (v_v, now(), p_por, p_id, p_nombre, p_texto, p_estado);
  return v_v;
end $$;

-- Edita uno o varios contactos. p_ed: {estado, asignado, contacto, seguimiento, motivo, noContactar, nota} (solo lo presente cambia)
create or replace function crm_editar(p_ids text[], p_ed jsonb, p_por text, p_texto text, p_nombre text, p_estado text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_v bigint; v_at timestamptz := now();
begin
  perform pg_advisory_xact_lock(7001);
  v_v := nextval('version_seq');
  update contactos set
    estado_crm   = case when p_ed ? 'estado' then p_ed->>'estado' else estado_crm end,
    asignado_crm = case when p_ed ? 'asignado' then p_ed->>'asignado' else asignado_crm end,
    contacto_crm = case when p_ed ? 'contacto' then p_ed->>'contacto' else contacto_crm end,
    seguimiento  = case when p_ed ? 'seguimiento' then (p_ed->>'seguimiento')::date else seguimiento end,
    motivo       = case when p_ed ? 'motivo' then p_ed->>'motivo' else motivo end,
    no_contactar = case when p_ed ? 'noContactar' then (p_ed->>'noContactar')::boolean else no_contactar end,
    v = v_v, at = v_at, por = p_por
  where id = any(p_ids);
  -- la línea de tiempo registra notas y cambios de estado (nota vacía = solo el cambio de estado)
  if p_ed ? 'nota' or p_ed ? 'estado' then
    insert into notas (contacto_id, texto, fecha, por, estado, origen)
    select id, coalesce(p_ed->>'nota', ''), v_at::text, p_por, p_ed->>'estado', 'crm'
    from contactos where id = any(p_ids);
  end if;
  insert into actividad (v, at, por, id, nombre, texto, estado)
  values (v_v, v_at, p_por, case when cardinality(p_ids) = 1 then p_ids[1] else '' end, p_nombre, p_texto, p_estado);
  return v_v;
end $$;

-- Agrega a alguien que no venía en el Excel
create or replace function crm_nuevo(p_c jsonb, p_nota text, p_por text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_v bigint; v_at timestamptz := now();
begin
  perform pg_advisory_xact_lock(7001);
  v_v := nextval('version_seq');
  insert into contactos (id, nombre, email, wa, tel, pais, region, sede, hojas, fecha, asignado, nuevo, v, at, por)
  values (p_c->>'id', p_c->>'nombre', p_c->>'email', p_c->>'wa', p_c->>'tel', p_c->>'pais', p_c->>'region',
          p_c->>'sede', array['Agregado en el CRM'], v_at::date, p_c->>'asignado', true, v_v, v_at, p_por);
  if coalesce(p_nota, '') <> '' then
    insert into notas (contacto_id, texto, fecha, por, origen) values (p_c->>'id', p_nota, v_at::text, p_por, 'crm');
  end if;
  insert into actividad (v, at, por, id, nombre, texto)
  values (v_v, v_at, p_por, p_c->>'id', p_c->>'nombre', 'agregó un contacto nuevo');
  return v_v;
end $$;

revoke all on function intento_fallido(text), crm_actividad(text, text, text, text, text),
  crm_editar(text[], jsonb, text, text, text, text), crm_nuevo(jsonb, text, text) from public, anon, authenticated;
