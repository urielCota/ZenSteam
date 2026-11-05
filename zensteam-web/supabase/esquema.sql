-- ZenSteam · Esquema de base de datos para Supabase
-- Ejecútalo una sola vez en Supabase → SQL Editor → New query → Run.
-- Se puede volver a ejecutar sin perder datos (usa "if not exists" / "or replace").

-- ============================================================
-- 1) Perfiles y roles
--    admin    → todo, incluida la pestaña Monitoreo
--    operador → registra y edita servicios, autos, reglas y siniestros
--    lectura  → solo consulta
-- ============================================================
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nombre     text,
  role       text not null default 'lectura' check (role in ('admin', 'operador', 'lectura')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Cada usuario nuevo recibe un perfil de solo lectura; un administrador le sube el rol.
create or replace function public.zs_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, nombre) values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', new.email))
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists zs_on_auth_user_created on auth.users;
create trigger zs_on_auth_user_created after insert on auth.users
  for each row execute function public.zs_new_user();

-- Rol del usuario que hace la consulta (null si no tiene perfil).
create or replace function public.zs_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where user_id = auth.uid()
$$;
revoke execute on function public.zs_role() from public, anon;
grant execute on function public.zs_role() to authenticated;

drop policy if exists "perfil propio o admin" on public.profiles;
create policy "perfil propio o admin" on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.zs_role() = 'admin');

-- ============================================================
-- 2) Datos de la app: un documento JSON por fila (igual que en el artefacto)
-- ============================================================
create or replace function public.zs_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['cars', 'services', 'incidents', 'config'] loop
    execute format('create table if not exists public.%I (
      id         text primary key,
      data       jsonb not null default ''{}''::jsonb,
      updated_at timestamptz not null default now(),
      updated_by uuid
    )', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    execute format('drop trigger if exists zs_touch on public.%I', t);
    execute format('create trigger zs_touch before insert or update on public.%I for each row execute function public.zs_touch()', t);

    execute format('drop policy if exists "leer con perfil" on public.%I', t);
    execute format('create policy "leer con perfil" on public.%I for select to authenticated using (public.zs_role() is not null)', t);
    execute format('drop policy if exists "escribir admin u operador" on public.%I', t);
    execute format('create policy "escribir admin u operador" on public.%I for all to authenticated
      using (public.zs_role() in (''admin'', ''operador''))
      with check (public.zs_role() in (''admin'', ''operador''))', t);
  end loop;
end $$;

-- Índice para consultar servicios por fecha (reportes y crecimiento futuro).
create index if not exists services_fecha_idx on public.services ((data ->> 'fecha'));

-- Actualización parcial atómica: mezcla solo los campos enviados (evita pisar cambios de otros usuarios).
create or replace function public.doc_update(t text, doc_id text, patch jsonb) returns integer
language plpgsql security invoker set search_path = public as $$
declare n integer;
begin
  if t not in ('cars', 'services', 'incidents', 'config') then
    raise exception 'Colección no permitida: %', t using errcode = '22023';
  end if;
  execute format('update public.%I set data = data || $1 where id = $2', t) using patch, doc_id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.doc_update(text, text, jsonb) from public, anon;
grant execute on function public.doc_update(text, text, jsonb) to authenticated;

-- ============================================================
-- 3) Tiempo real (Tablero y Monitoreo se actualizan solos)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['cars', 'services', 'incidents', 'config'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ============================================================
-- 4) Vista para reportes (Table Editor, SQL o Excel)
-- ============================================================
create or replace view public.v_servicios with (security_invoker = true) as
select
  s.id,
  case when s.data ->> 'fecha' ~ '^\d{4}-\d{2}-\d{2}$' then (s.data ->> 'fecha')::date end as fecha,
  nullif(s.data ->> 'hora', '')              as hora,
  s.data ->> 'cliente'                       as cliente,
  s.data ->> 'telefono'                      as telefono,
  s.data ->> 'direccion'                     as direccion,
  case when s.data ->> 'monto' ~ '^-?\d+(\.\d+)?$' then (s.data ->> 'monto')::numeric end as monto,
  s.data ->> 'status'                        as estado,
  s.data ->> 'carId'                         as auto_id,
  c.data ->> 'nombre'                        as auto,
  nullif(s.data ->> 'order', '')::int        as parada,
  nullif(s.data ->> 'lat', '')::float8       as lat,
  nullif(s.data ->> 'lng', '')::float8       as lng,
  s.updated_at
from public.services s
left join public.cars c on c.id = s.data ->> 'carId';
grant select on public.v_servicios to authenticated;
