-- =====================================================================
-- 001  Roles, importaciones y datos de la empresa
-- =====================================================================

-- ---------------------------------------------------------------------
-- PROFILES: extiende auth.users con rol y empresa
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text,
  role       text not null default 'trabajador' check (role in ('admin', 'trabajador')),
  empresa    text not null default 'Mi Restaurante',
  created_at timestamptz not null default now()
);

-- Devuelve el rol del usuario autenticado.
-- SECURITY DEFINER evita la recursion infinita al usarla dentro de las
-- politicas de la propia tabla profiles.
create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Crea el perfil automaticamente cuando se registra un usuario nuevo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Perfil para los usuarios que ya existian antes de esta migracion.
insert into public.profiles (id, email, full_name)
select id, email, coalesce(raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- IMPORTS: una fila por archivo CSV o Excel cargado
-- ---------------------------------------------------------------------
create table if not exists public.imports (
  id           bigint generated always as identity primary key,
  archivo      text not null,
  empresa      text not null,
  es_propia    boolean not null default true,
  formato      text not null default 'csv' check (formato in ('csv', 'excel')),
  columnas     text[] not null default '{}',
  total_filas  integer not null default 0,
  tabla_fisica text,
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create index if not exists imports_user_id_idx    on public.imports (user_id);
create index if not exists imports_es_propia_idx  on public.imports (es_propia);
create index if not exists imports_created_at_idx on public.imports (created_at desc);

-- ---------------------------------------------------------------------
-- IMPORT_ROWS: el contenido crudo. data es JSONB porque cada archivo
-- trae columnas distintas y no se pueden conocer de antemano.
-- ---------------------------------------------------------------------
create table if not exists public.import_rows (
  id        bigint generated always as identity primary key,
  import_id bigint not null references public.imports(id) on delete cascade,
  fila      integer not null,
  data      jsonb not null
);

create index if not exists import_rows_import_id_idx on public.import_rows (import_id);
create index if not exists import_rows_data_idx      on public.import_rows using gin (data);

-- ---------------------------------------------------------------------
-- COLUMNAS_SUGERIDAS: bitacora de los cambios de estructura que hace
-- el trabajador desde el frontend (ALTER TABLE / CREATE TABLE)
-- ---------------------------------------------------------------------
create table if not exists public.cambios_estructura (
  id          bigint generated always as identity primary key,
  tabla       text not null,
  operacion   text not null check (operacion in ('add_column', 'create_table', 'drop_column')),
  detalle     jsonb not null default '{}',
  motivo      text,
  sql_aplicado text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists cambios_estructura_user_idx on public.cambios_estructura (user_id);

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.profiles           enable row level security;
alter table public.imports            enable row level security;
alter table public.import_rows        enable row level security;
alter table public.cambios_estructura enable row level security;

-- PROFILES: cada quien ve el suyo, el admin ve todos
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.app_role() = 'admin');

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.app_role());

-- IMPORTS: el trabajador maneja los suyos, el admin lee todos
drop policy if exists imports_select on public.imports;
create policy imports_select on public.imports
  for select to authenticated
  using (user_id = auth.uid() or public.app_role() = 'admin');

drop policy if exists imports_insert on public.imports;
create policy imports_insert on public.imports
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists imports_delete on public.imports;
create policy imports_delete on public.imports
  for delete to authenticated
  using (user_id = auth.uid() or public.app_role() = 'admin');

-- IMPORT_ROWS: heredan el permiso de su importacion
drop policy if exists import_rows_select on public.import_rows;
create policy import_rows_select on public.import_rows
  for select to authenticated
  using (exists (
    select 1 from public.imports i
    where i.id = import_rows.import_id
      and (i.user_id = auth.uid() or public.app_role() = 'admin')
  ));

drop policy if exists import_rows_insert on public.import_rows;
create policy import_rows_insert on public.import_rows
  for insert to authenticated
  with check (exists (
    select 1 from public.imports i
    where i.id = import_rows.import_id and i.user_id = auth.uid()
  ));

-- CAMBIOS_ESTRUCTURA: el trabajador ve los suyos, el admin ve todos
drop policy if exists cambios_select on public.cambios_estructura;
create policy cambios_select on public.cambios_estructura
  for select to authenticated
  using (user_id = auth.uid() or public.app_role() = 'admin');

drop policy if exists cambios_insert on public.cambios_estructura;
create policy cambios_insert on public.cambios_estructura
  for insert to authenticated
  with check (user_id = auth.uid());
