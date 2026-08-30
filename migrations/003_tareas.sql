-- =====================================================================
-- 003  Tareas que el administrador asigna a un trabajador
--
-- El admin convierte un insight de la comparacion en una orden concreta.
-- El trabajador la ve en su modulo y la ejecuta a mano; el sistema no
-- hace el trabajo por el. Lo unico automatico es el cierre: si la tarea
-- pedia una columna y esa columna termina existiendo, se marca sola.
-- =====================================================================

create table if not exists public.tareas (
  id               bigint generated always as identity primary key,
  titulo           text not null,
  mensaje          text not null,
  nivel            text not null default 'info' check (nivel in ('oportunidad', 'alerta', 'info')),

  -- Solo las tareas nacidas de un insight con accion traen estos tres.
  -- Son la referencia que lee el trabajador, no un formulario automatico.
  columna_sugerida text,
  tipo_sugerido    text,
  ejemplo          text,

  origen           text,
  tabla_destino    text not null default 'empresa_datos',

  estado           text not null default 'pendiente' check (estado in ('pendiente', 'completada')),
  asignada_a       uuid not null references auth.users(id) on delete cascade,
  asignada_por     uuid not null references auth.users(id) on delete cascade,
  created_at       timestamptz not null default now(),
  completada_at    timestamptz,
  cierre           text check (cierre in ('automatico', 'manual'))
);

create index if not exists tareas_asignada_a_idx on public.tareas (asignada_a, estado);
create index if not exists tareas_created_at_idx on public.tareas (created_at desc);

alter table public.tareas enable row level security;

-- El trabajador ve las suyas. El admin ve todas.
drop policy if exists tareas_select on public.tareas;
create policy tareas_select on public.tareas
  for select to authenticated
  using (asignada_a = auth.uid() or public.app_role() = 'admin');

-- Solo el admin asigna, y siempre en su nombre.
drop policy if exists tareas_insert on public.tareas;
create policy tareas_insert on public.tareas
  for insert to authenticated
  with check (public.app_role() = 'admin' and asignada_por = auth.uid());

-- El trabajador solo puede cerrar las suyas, nunca reasignarlas.
drop policy if exists tareas_update on public.tareas;
create policy tareas_update on public.tareas
  for update to authenticated
  using (asignada_a = auth.uid())
  with check (asignada_a = auth.uid());

drop policy if exists tareas_delete on public.tareas;
create policy tareas_delete on public.tareas
  for delete to authenticated
  using (public.app_role() = 'admin');

-- ---------------------------------------------------------------------
-- Cierre automatico
--
-- Se engancha dentro de empresa_agregar_columna en vez de en el frontend,
-- para que la tarea se cierre sin importar como se creo la columna.
-- ---------------------------------------------------------------------
create or replace function public.empresa_agregar_columna(
  p_tabla   text,
  p_columna text,
  p_tipo    text,
  p_defecto text default null,
  p_motivo  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tabla    text;
  v_columna  text;
  v_tipo     text;
  v_sufijo   text := '';
  v_sql      text;
  v_cerradas integer := 0;
begin
  perform public.emp_exigir_trabajador();

  v_tabla   := public.emp_validar_tabla(p_tabla);
  v_columna := public.emp_validar_columna(p_columna);
  v_tipo    := public.emp_tipo_sql(p_tipo);

  if to_regclass(format('public.%I', v_tabla)) is null then
    raise exception 'La tabla % todavia no existe', v_tabla using errcode = '42P01';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = v_tabla and column_name = v_columna
  ) then
    raise exception 'La columna "%" ya existe en %', v_columna, v_tabla using errcode = '42701';
  end if;

  if nullif(btrim(coalesce(p_defecto, '')), '') is not null then
    v_sufijo := case lower(p_tipo)
      when 'entero'   then format(' default %s', coalesce(public.emp_a_entero(p_defecto)::text, 'null'))
      when 'numero'   then format(' default %s', coalesce(public.emp_a_numero(p_defecto)::text, 'null'))
      when 'moneda'   then format(' default %s', coalesce(public.emp_a_numero(p_defecto)::text, 'null'))
      when 'booleano' then format(' default %s', coalesce(public.emp_a_booleano(p_defecto)::text, 'null'))
      when 'fecha'    then format(' default %L', public.emp_a_fecha(p_defecto))
      else                 format(' default %L', btrim(p_defecto))
    end;
  end if;

  v_sql := format('alter table public.%I add column %I %s%s', v_tabla, v_columna, v_tipo, v_sufijo);
  execute v_sql;

  perform public.emp_registrar(
    v_tabla, 'add_column',
    jsonb_build_object('columna', v_columna, 'tipo', lower(p_tipo), 'valorDefecto', p_defecto),
    p_motivo, v_sql
  );

  -- Si habia una tarea pendiente pidiendo justo esta columna, se cierra.
  update public.tareas
     set estado = 'completada', completada_at = now(), cierre = 'automatico'
   where asignada_a = auth.uid()
     and estado = 'pendiente'
     and columna_sugerida = v_columna
     and tabla_destino = v_tabla;

  get diagnostics v_cerradas = row_count;

  return jsonb_build_object(
    'tabla', v_tabla,
    'columna', v_columna,
    'tipo', lower(p_tipo),
    'tareasCerradas', v_cerradas
  );
end
$$;

revoke all on function public.empresa_agregar_columna(text, text, text, text, text) from public, anon;
grant execute on function public.empresa_agregar_columna(text, text, text, text, text) to authenticated;
