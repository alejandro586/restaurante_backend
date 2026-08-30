-- =====================================================================
-- 002  Operaciones de estructura ejecutables desde el frontend
--
-- El modulo del trabajador ya no pasa por el backend: el navegador llama
-- estas funciones directamente contra PostgREST.
--
-- Son SECURITY DEFINER, asi que corren con los permisos del dueno y pueden
-- hacer DDL. Lo que impide que cualquiera las use es que cada una empieza
-- verificando que quien llama tenga rol de trabajador, y que todo nombre
-- que llega desde el navegador pasa por validacion y por format('%I').
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guardas
-- ---------------------------------------------------------------------

create or replace function public.emp_exigir_trabajador()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id  uuid;
  v_rol text;
begin
  v_id := auth.uid();

  if v_id is null then
    raise exception 'Sesion no valida' using errcode = '42501';
  end if;

  select role into v_rol from public.profiles where id = v_id;

  if v_rol is distinct from 'trabajador' then
    raise exception 'Esta operacion es solo para trabajadores' using errcode = '42501';
  end if;

  return v_id;
end
$$;

-- Unica puerta para decidir sobre que tabla se puede operar. Sin esto, un
-- nombre enviado desde el navegador permitiria alterar auth.users.
create or replace function public.emp_validar_tabla(p_tabla text)
returns text
language plpgsql
immutable
as $$
declare
  v text;
begin
  v := lower(btrim(coalesce(p_tabla, '')));

  if v !~ '^[a-z][a-z0-9_]{0,58}$' then
    raise exception 'Nombre de tabla no valido: %', p_tabla using errcode = '22023';
  end if;

  if v <> 'empresa_datos' and v not like 'emp\_%' then
    raise exception 'Solo se permite operar sobre empresa_datos o tablas con prefijo emp_'
      using errcode = '42501';
  end if;

  return v;
end
$$;

create or replace function public.emp_validar_columna(p_columna text)
returns text
language plpgsql
immutable
as $$
declare
  v text;
begin
  v := lower(btrim(coalesce(p_columna, '')));

  if v !~ '^[a-z][a-z0-9_]{0,58}$' then
    raise exception 'La columna debe empezar con letra y usar solo letras, numeros y guion bajo'
      using errcode = '22023';
  end if;

  if v in ('id', 'import_id', 'fila', 'created_at') then
    raise exception '"%" es una columna reservada del sistema', v using errcode = '22023';
  end if;

  return v;
end
$$;

create or replace function public.emp_tipo_sql(p_tipo text)
returns text
language plpgsql
immutable
as $$
declare
  v text;
begin
  v := case lower(btrim(coalesce(p_tipo, '')))
         when 'texto'    then 'text'
         when 'numero'   then 'numeric'
         when 'entero'   then 'integer'
         when 'booleano' then 'boolean'
         when 'fecha'    then 'date'
         when 'moneda'   then 'numeric(12,2)'
       end;

  if v is null then
    raise exception 'Tipo no permitido. Use: texto, numero, entero, booleano, fecha, moneda'
      using errcode = '22023';
  end if;

  return v;
end
$$;

-- ---------------------------------------------------------------------
-- Conversores tolerantes. Un CSV trae texto en todas sus celdas; si una
-- no convierte, la fila entra con null en vez de abortar la importacion.
-- ---------------------------------------------------------------------

create or replace function public.emp_a_numero(p text)
returns numeric language plpgsql immutable as $$
begin
  return nullif(replace(btrim(coalesce(p, '')), ',', ''), '')::numeric;
exception when others then
  return null;
end $$;

create or replace function public.emp_a_entero(p text)
returns integer language plpgsql immutable as $$
begin
  return round(nullif(replace(btrim(coalesce(p, '')), ',', ''), '')::numeric)::integer;
exception when others then
  return null;
end $$;

create or replace function public.emp_a_booleano(p text)
returns boolean language plpgsql immutable as $$
declare v text;
begin
  v := lower(btrim(coalesce(p, '')));
  if v = '' then return null; end if;
  return v in ('si', 'sí', 'true', 't', '1', 'x', 'y', 'yes');
end $$;

create or replace function public.emp_a_fecha(p text)
returns date language plpgsql immutable as $$
begin
  return nullif(btrim(coalesce(p, '')), '')::date;
exception when others then
  return null;
end $$;

-- Expresion SQL que convierte una clave del JSONB al tipo destino.
create or replace function public.emp_expresion(p_original text, p_tipo text)
returns text
language plpgsql
immutable
as $$
begin
  return case lower(p_tipo)
    when 'entero'   then format('public.emp_a_entero(r.data->>%L)', p_original)
    when 'numero'   then format('public.emp_a_numero(r.data->>%L)', p_original)
    when 'moneda'   then format('public.emp_a_numero(r.data->>%L)', p_original)
    when 'booleano' then format('public.emp_a_booleano(r.data->>%L)', p_original)
    when 'fecha'    then format('public.emp_a_fecha(r.data->>%L)', p_original)
    else                 format('nullif(btrim(r.data->>%L), '''')', p_original)
  end;
end
$$;

create or replace function public.emp_registrar(
  p_tabla text, p_operacion text, p_detalle jsonb, p_motivo text, p_sql text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.cambios_estructura (tabla, operacion, detalle, motivo, sql_aplicado, user_id)
  values (p_tabla, p_operacion, coalesce(p_detalle, '{}'::jsonb), nullif(btrim(coalesce(p_motivo, '')), ''), p_sql, auth.uid())
$$;

-- =====================================================================
-- Funciones que llama el frontend
-- =====================================================================

-- Tablas que el trabajador puede administrar.
create or replace function public.empresa_tablas()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform public.emp_exigir_trabajador();

  select coalesce(jsonb_agg(jsonb_build_object('tabla', c.relname, 'filas', coalesce(s.n_live_tup, 0))
                            order by c.relname), '[]'::jsonb)
    into v
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_stat_user_tables s on s.relid = c.oid
  where n.nspname = 'public'
    and c.relkind = 'r'
    and (c.relname = 'empresa_datos' or c.relname like 'emp\_%');

  return v;
end
$$;

-- Filas y columnas de una tabla administrada.
create or replace function public.empresa_leer(
  p_tabla text default 'empresa_datos',
  p_limite integer default 25,
  p_desde integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tabla  text;
  v_limite integer;
  v_desde  integer;
  v_filas  jsonb;
  v_total  integer;
begin
  perform public.emp_exigir_trabajador();

  v_tabla  := public.emp_validar_tabla(p_tabla);
  v_limite := least(greatest(coalesce(p_limite, 25), 1), 500);
  v_desde  := greatest(coalesce(p_desde, 0), 0);

  if to_regclass(format('public.%I', v_tabla)) is null then
    return jsonb_build_object('existe', false, 'tabla', v_tabla);
  end if;

  execute format(
    'select coalesce(jsonb_agg(t order by t.id), ''[]''::jsonb)
       from (select * from public.%I order by id limit %s offset %s) t',
    v_tabla, v_limite, v_desde
  ) into v_filas;

  execute format('select count(*)::int from public.%I', v_tabla) into v_total;

  return jsonb_build_object(
    'existe', true,
    'tabla', v_tabla,
    'total', v_total,
    'filas', v_filas,
    'columnas', (
      select coalesce(jsonb_agg(jsonb_build_object('columna', column_name, 'tipo', data_type)
                                order by ordinal_position), '[]'::jsonb)
      from information_schema.columns
      where table_schema = 'public' and table_name = v_tabla
    )
  );
end
$$;

-- ALTER TABLE ... ADD COLUMN
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
  v_tabla   text;
  v_columna text;
  v_tipo    text;
  v_sufijo  text := '';
  v_sql     text;
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

  return jsonb_build_object('tabla', v_tabla, 'columna', v_columna, 'tipo', lower(p_tipo));
end
$$;

-- CREATE TABLE emp_...
-- p_columnas: [{"nombre": "puntos", "tipo": "entero"}, ...]
create or replace function public.empresa_crear_tabla(
  p_nombre   text,
  p_columnas jsonb,
  p_motivo   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tabla   text;
  v_cuerpo  text := '';
  v_sql     text;
  v_columna text;
  v_vistas  text[] := '{}';
  r         jsonb;
begin
  perform public.emp_exigir_trabajador();

  v_tabla := lower(btrim(coalesce(p_nombre, '')));
  if v_tabla <> 'empresa_datos' and v_tabla not like 'emp\_%' then
    v_tabla := 'emp_' || v_tabla;
  end if;
  v_tabla := public.emp_validar_tabla(v_tabla);

  if to_regclass(format('public.%I', v_tabla)) is not null then
    raise exception 'La tabla "%" ya existe', v_tabla using errcode = '42P07';
  end if;

  if p_columnas is null or jsonb_typeof(p_columnas) <> 'array' or jsonb_array_length(p_columnas) = 0 then
    raise exception 'Define al menos una columna' using errcode = '22023';
  end if;

  for r in select * from jsonb_array_elements(p_columnas) loop
    v_columna := public.emp_validar_columna(r->>'nombre');

    if v_columna = any (v_vistas) then
      raise exception 'La columna "%" esta repetida', v_columna using errcode = '42701';
    end if;

    v_vistas := v_vistas || v_columna;
    v_cuerpo := v_cuerpo || format(', %I %s', v_columna, public.emp_tipo_sql(r->>'tipo'));
  end loop;

  v_sql := format(
    'create table public.%I (id bigint generated always as identity primary key%s, created_at timestamptz not null default now())',
    v_tabla, v_cuerpo
  );
  execute v_sql;

  execute format('alter table public.%I enable row level security', v_tabla);
  execute format(
    'create policy %I on public.%I for all to authenticated using (true) with check (true)',
    v_tabla || '_todo', v_tabla
  );

  perform public.emp_registrar(v_tabla, 'create_table', jsonb_build_object('columnas', p_columnas), p_motivo, v_sql);

  return jsonb_build_object('tabla', v_tabla, 'columnas', jsonb_array_length(p_columnas));
end
$$;

-- ALTER TABLE ... DROP COLUMN
create or replace function public.empresa_eliminar_columna(
  p_tabla   text,
  p_columna text,
  p_motivo  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tabla   text;
  v_columna text;
  v_sql     text;
begin
  perform public.emp_exigir_trabajador();

  v_tabla   := public.emp_validar_tabla(p_tabla);
  v_columna := public.emp_validar_columna(p_columna);

  v_sql := format('alter table public.%I drop column %I', v_tabla, v_columna);
  execute v_sql;

  perform public.emp_registrar(v_tabla, 'drop_column', jsonb_build_object('columna', v_columna), p_motivo, v_sql);

  return jsonb_build_object('tabla', v_tabla, 'columna', v_columna);
end
$$;

-- UPDATE de una celda, para completar una columna recien creada.
create or replace function public.empresa_actualizar_celda(
  p_tabla   text,
  p_id      bigint,
  p_columna text,
  p_valor   text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tabla   text;
  v_columna text;
  v_tipo    text;
  v_expr    text;
begin
  perform public.emp_exigir_trabajador();

  v_tabla   := public.emp_validar_tabla(p_tabla);
  v_columna := public.emp_validar_columna(p_columna);

  if p_id is null or p_id <= 0 then
    raise exception 'Identificador de fila no valido' using errcode = '22023';
  end if;

  select data_type into v_tipo
  from information_schema.columns
  where table_schema = 'public' and table_name = v_tabla and column_name = v_columna;

  if v_tipo is null then
    raise exception 'La columna "%" no existe en %', v_columna, v_tabla using errcode = '42703';
  end if;

  if nullif(btrim(coalesce(p_valor, '')), '') is null then
    v_expr := 'null';
  elsif v_tipo = 'boolean' then
    v_expr := coalesce(public.emp_a_booleano(p_valor)::text, 'null');
  elsif v_tipo in ('integer', 'bigint', 'smallint') then
    if public.emp_a_entero(p_valor) is null then
      raise exception '"%" no es un numero entero valido', p_valor using errcode = '22023';
    end if;
    v_expr := public.emp_a_entero(p_valor)::text;
  elsif v_tipo in ('numeric', 'double precision', 'real') then
    if public.emp_a_numero(p_valor) is null then
      raise exception '"%" no es un numero valido', p_valor using errcode = '22023';
    end if;
    v_expr := public.emp_a_numero(p_valor)::text;
  elsif v_tipo = 'date' then
    if public.emp_a_fecha(p_valor) is null then
      raise exception '"%" no es una fecha valida', p_valor using errcode = '22023';
    end if;
    v_expr := quote_literal(public.emp_a_fecha(p_valor));
  else
    v_expr := quote_literal(btrim(p_valor));
  end if;

  execute format('update public.%I set %I = %s where id = %s', v_tabla, v_columna, v_expr, p_id);

  return jsonb_build_object('tabla', v_tabla, 'id', p_id, 'columna', v_columna);
end
$$;

-- Vuelca una importacion propia en empresa_datos. Si la tabla existe no la
-- recrea: agrega las columnas que falten y anexa las filas, para no perder
-- las columnas que el trabajador haya sumado antes.
--
-- p_estructura: [{"original": "Precio S/.", "columna": "precio_s", "tipo": "numero"}, ...]
create or replace function public.empresa_materializar(
  p_import_id  bigint,
  p_estructura jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tabla    text := 'empresa_datos';
  v_creada   boolean := false;
  v_cuerpo   text := '';
  v_destinos text := '';
  v_origenes text := '';
  v_columna  text;
  v_filas    integer;
  r          jsonb;
begin
  perform public.emp_exigir_trabajador();

  if not exists (select 1 from public.imports where id = p_import_id) then
    raise exception 'La importacion % no existe', p_import_id using errcode = '42P01';
  end if;

  if p_estructura is null or jsonb_typeof(p_estructura) <> 'array' or jsonb_array_length(p_estructura) = 0 then
    raise exception 'La estructura del archivo llego vacia' using errcode = '22023';
  end if;

  for r in select * from jsonb_array_elements(p_estructura) loop
    v_columna  := public.emp_validar_columna(r->>'columna');
    v_cuerpo   := v_cuerpo || format(', %I %s', v_columna, public.emp_tipo_sql(r->>'tipo'));
    v_destinos := v_destinos || format(', %I', v_columna);
    v_origenes := v_origenes || ', ' || public.emp_expresion(r->>'original', r->>'tipo');
  end loop;

  if to_regclass(format('public.%I', v_tabla)) is null then
    execute format(
      'create table public.%I (id bigint generated always as identity primary key,
         import_id bigint, fila integer%s, created_at timestamptz not null default now())',
      v_tabla, v_cuerpo
    );
    execute format('alter table public.%I enable row level security', v_tabla);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      v_tabla || '_todo', v_tabla
    );
    v_creada := true;
  else
    for r in select * from jsonb_array_elements(p_estructura) loop
      v_columna := public.emp_validar_columna(r->>'columna');
      execute format('alter table public.%I add column if not exists %I %s',
                     v_tabla, v_columna, public.emp_tipo_sql(r->>'tipo'));
    end loop;
  end if;

  execute format(
    'insert into public.%I (import_id, fila%s) select r.import_id, r.fila%s
       from public.import_rows r where r.import_id = %s order by r.fila',
    v_tabla, v_destinos, v_origenes, p_import_id
  );

  get diagnostics v_filas = row_count;

  perform public.emp_registrar(
    v_tabla,
    case when v_creada then 'create_table' else 'add_column' end,
    jsonb_build_object('importId', p_import_id, 'filas', v_filas, 'columnas', p_estructura),
    case when v_creada then 'Creada al importar el primer archivo de la empresa'
         else 'Ampliada al importar un archivo nuevo de la empresa' end,
    format('-- materializar import %s en %s', p_import_id, v_tabla)
  );

  update public.imports set tabla_fisica = v_tabla where id = p_import_id;

  return jsonb_build_object('tabla', v_tabla, 'creada', v_creada, 'filas', v_filas,
                            'columnas', jsonb_array_length(p_estructura));
end
$$;

-- =====================================================================
-- Permisos: solo un usuario autenticado puede invocar las funciones
-- publicas, y los ayudantes no se exponen por PostgREST.
-- =====================================================================

revoke all on function
  public.emp_exigir_trabajador(), public.emp_validar_tabla(text), public.emp_validar_columna(text),
  public.emp_tipo_sql(text), public.emp_a_numero(text), public.emp_a_entero(text),
  public.emp_a_booleano(text), public.emp_a_fecha(text), public.emp_expresion(text, text),
  public.emp_registrar(text, text, jsonb, text, text)
from public, anon, authenticated;

revoke all on function
  public.empresa_tablas(), public.empresa_leer(text, integer, integer),
  public.empresa_agregar_columna(text, text, text, text, text),
  public.empresa_crear_tabla(text, jsonb, text),
  public.empresa_eliminar_columna(text, text, text),
  public.empresa_actualizar_celda(text, bigint, text, text),
  public.empresa_materializar(bigint, jsonb)
from public, anon;

grant execute on function
  public.empresa_tablas(), public.empresa_leer(text, integer, integer),
  public.empresa_agregar_columna(text, text, text, text, text),
  public.empresa_crear_tabla(text, jsonb, text),
  public.empresa_eliminar_columna(text, text, text),
  public.empresa_actualizar_celda(text, bigint, text, text),
  public.empresa_materializar(bigint, jsonb)
to authenticated;
