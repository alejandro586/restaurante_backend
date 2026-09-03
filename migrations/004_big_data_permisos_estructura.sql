begin;


/* ==========================================================
   COMPROBAR PERMISO DE MODULO
   ========================================================== */

/*
 * Esta funcion sera la equivalencia en Supabase
 * de requireModulePermission() del backend.
 *
 * ADMIN:
 * siempre tiene permiso.
 *
 * USUARIO:
 * necesita:
 * - curso activo
 * - curso asignado
 * - modulo activo
 * - modulo asignado
 */
create or replace function public.app_tiene_modulo(
  p_clave text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      (
        select p.role = 'admin'
        from public.profiles p
        where p.id = auth.uid()
      ),
      false
    )

    or

    exists (
      select 1

      from public.usuario_modulos um

      join public.curso_modulos cm
        on cm.id = um.modulo_id

      join public.cursos c
        on c.id = cm.curso_id

      join public.usuario_cursos uc
        on uc.user_id = um.user_id
       and uc.curso_id = c.id

      where um.user_id = auth.uid()

        and um.activo = true
        and uc.activo = true
        and cm.activo = true
        and c.activo = true

        and cm.clave = p_clave
    )
$$;


revoke all
on function public.app_tiene_modulo(text)
from public, anon;

grant execute
on function public.app_tiene_modulo(text)
to authenticated;


/* ==========================================================
   EXIGIR PERMISO
   ========================================================== */

create or replace function public.emp_exigir_modulo(
  p_clave text
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin

  v_id := auth.uid();


  if v_id is null then

    raise exception
      'Sesion no valida'
      using errcode = '42501';

  end if;


  if not public.app_tiene_modulo(
    p_clave
  ) then

    raise exception
      'No tienes permiso para utilizar este modulo'
      using errcode = '42501';

  end if;


  return v_id;

end
$$;


revoke all
on function public.emp_exigir_modulo(text)
from public, anon, authenticated;


/* ==========================================================
   TABLAS DISPONIBLES
   ========================================================== */

create or replace function public.empresa_tablas()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin

  perform public.emp_exigir_modulo(
    'big_data.estructura'
  );


  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'tabla',
        c.relname,
        'filas',
        coalesce(
          s.n_live_tup,
          0
        )
      )
      order by c.relname
    ),
    '[]'::jsonb
  )
  into v

  from pg_class c

  join pg_namespace n
    on n.oid = c.relnamespace

  left join pg_stat_user_tables s
    on s.relid = c.oid

  where n.nspname = 'public'
    and c.relkind = 'r'

    and (
      c.relname = 'empresa_datos'
      or
      c.relname like 'emp\_%'
    );


  return v;

end
$$;


/* ==========================================================
   LEER ESTRUCTURA Y FILAS
   ========================================================== */

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
  v_tabla text;
  v_limite integer;
  v_desde integer;

  v_filas jsonb;
  v_total integer;
begin

  perform public.emp_exigir_modulo(
    'big_data.estructura'
  );


  v_tabla :=
    public.emp_validar_tabla(
      p_tabla
    );


  v_limite :=
    least(
      greatest(
        coalesce(
          p_limite,
          25
        ),
        1
      ),
      500
    );


  v_desde :=
    greatest(
      coalesce(
        p_desde,
        0
      ),
      0
    );


  if to_regclass(
    format(
      'public.%I',
      v_tabla
    )
  ) is null then

    return jsonb_build_object(
      'existe',
      false,

      'tabla',
      v_tabla
    );

  end if;


  execute format(
    '
      select coalesce(
        jsonb_agg(
          t order by t.id
        ),
        ''[]''::jsonb
      )

      from (
        select *
        from public.%I
        order by id
        limit %s
        offset %s
      ) t
    ',
    v_tabla,
    v_limite,
    v_desde
  )
  into v_filas;


  execute format(
    'select count(*)::int from public.%I',
    v_tabla
  )
  into v_total;


  return jsonb_build_object(

    'existe',
    true,

    'tabla',
    v_tabla,

    'total',
    v_total,

    'filas',
    v_filas,

    'columnas',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'columna',
            column_name,

            'tipo',
            data_type
          )
          order by ordinal_position
        ),
        '[]'::jsonb
      )

      from information_schema.columns

      where table_schema = 'public'
        and table_name = v_tabla
    )
  );

end
$$;


/* ==========================================================
   AGREGAR COLUMNA
   ========================================================== */

create or replace function public.empresa_agregar_columna(
  p_tabla text,
  p_columna text,
  p_tipo text,
  p_defecto text default null,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tabla text;
  v_columna text;
  v_tipo text;

  v_sufijo text := '';
  v_sql text;

  v_cerradas integer := 0;
begin

  perform public.emp_exigir_modulo(
    'big_data.estructura'
  );


  v_tabla :=
    public.emp_validar_tabla(
      p_tabla
    );


  v_columna :=
    public.emp_validar_columna(
      p_columna
    );


  v_tipo :=
    public.emp_tipo_sql(
      p_tipo
    );


  if to_regclass(
    format(
      'public.%I',
      v_tabla
    )
  ) is null then

    raise exception
      'La tabla % todavia no existe',
      v_tabla
      using errcode = '42P01';

  end if;


  if exists (
    select 1

    from information_schema.columns

    where table_schema = 'public'
      and table_name = v_tabla
      and column_name = v_columna
  ) then

    raise exception
      'La columna "%" ya existe en %',
      v_columna,
      v_tabla
      using errcode = '42701';

  end if;


  if nullif(
    btrim(
      coalesce(
        p_defecto,
        ''
      )
    ),
    ''
  ) is not null then

    v_sufijo :=
      case lower(p_tipo)

        when 'entero'
        then format(
          ' default %s',
          coalesce(
            public.emp_a_entero(
              p_defecto
            )::text,
            'null'
          )
        )

        when 'numero'
        then format(
          ' default %s',
          coalesce(
            public.emp_a_numero(
              p_defecto
            )::text,
            'null'
          )
        )

        when 'moneda'
        then format(
          ' default %s',
          coalesce(
            public.emp_a_numero(
              p_defecto
            )::text,
            'null'
          )
        )

        when 'booleano'
        then format(
          ' default %s',
          coalesce(
            public.emp_a_booleano(
              p_defecto
            )::text,
            'null'
          )
        )

        when 'fecha'
        then format(
          ' default %L',
          public.emp_a_fecha(
            p_defecto
          )
        )

        else
          format(
            ' default %L',
            btrim(
              p_defecto
            )
          )

      end;

  end if;


  v_sql :=
    format(
      'alter table public.%I add column %I %s%s',
      v_tabla,
      v_columna,
      v_tipo,
      v_sufijo
    );


  execute v_sql;


  perform public.emp_registrar(
    v_tabla,

    'add_column',

    jsonb_build_object(
      'columna',
      v_columna,

      'tipo',
      lower(
        p_tipo
      ),

      'valorDefecto',
      p_defecto
    ),

    p_motivo,

    v_sql
  );


  /*
   * Si existia una tarea solicitando
   * exactamente esta columna,
   * queda completada.
   */
  update public.tareas

  set
    estado = 'completada',
    completada_at = now(),
    cierre = 'automatico'

  where asignada_a = auth.uid()
    and estado = 'pendiente'
    and columna_sugerida = v_columna
    and tabla_destino = v_tabla;


  get diagnostics
    v_cerradas = row_count;


  return jsonb_build_object(

    'tabla',
    v_tabla,

    'columna',
    v_columna,

    'tipo',
    lower(
      p_tipo
    ),

    'tareasCerradas',
    v_cerradas
  );

end
$$;


/* ==========================================================
   CREAR TABLA
   ========================================================== */

create or replace function public.empresa_crear_tabla(
  p_nombre text,
  p_columnas jsonb,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tabla text;
  v_cuerpo text := '';
  v_sql text;

  v_columna text;

  v_vistas text[] := '{}';

  r jsonb;
begin

  perform public.emp_exigir_modulo(
    'big_data.estructura'
  );


  v_tabla :=
    lower(
      btrim(
        coalesce(
          p_nombre,
          ''
        )
      )
    );


  if
    v_tabla <> 'empresa_datos'
    and
    v_tabla not like 'emp\_%'
  then

    v_tabla :=
      'emp_' ||
      v_tabla;

  end if;


  v_tabla :=
    public.emp_validar_tabla(
      v_tabla
    );


  if to_regclass(
    format(
      'public.%I',
      v_tabla
    )
  ) is not null then

    raise exception
      'La tabla "%" ya existe',
      v_tabla
      using errcode = '42P07';

  end if;


  if
    p_columnas is null
    or
    jsonb_typeof(
      p_columnas
    ) <> 'array'
    or
    jsonb_array_length(
      p_columnas
    ) = 0
  then

    raise exception
      'Define al menos una columna'
      using errcode = '22023';

  end if;


  for r in
    select *
    from jsonb_array_elements(
      p_columnas
    )
  loop

    v_columna :=
      public.emp_validar_columna(
        r ->> 'nombre'
      );


    if
      v_columna =
      any(
        v_vistas
      )
    then

      raise exception
        'La columna "%" esta repetida',
        v_columna
        using errcode = '42701';

    end if;


    v_vistas :=
      v_vistas ||
      v_columna;


    v_cuerpo :=
      v_cuerpo ||
      format(
        ', %I %s',
        v_columna,
        public.emp_tipo_sql(
          r ->> 'tipo'
        )
      );

  end loop;


  v_sql :=
    format(
      '
        create table public.%I (
          id bigint
            generated always as identity
            primary key
          %s,
          created_at timestamptz
            not null
            default now()
        )
      ',
      v_tabla,
      v_cuerpo
    );


  execute v_sql;


  /*
   * La tabla NO queda abierta directamente
   * a todos los usuarios autenticados.
   *
   * Solo se trabaja mediante los RPC.
   */
  execute format(
    'alter table public.%I enable row level security',
    v_tabla
  );


  execute format(
    'revoke all on table public.%I from anon, authenticated',
    v_tabla
  );


  perform public.emp_registrar(
    v_tabla,

    'create_table',

    jsonb_build_object(
      'columnas',
      p_columnas
    ),

    p_motivo,

    v_sql
  );


  return jsonb_build_object(

    'tabla',
    v_tabla,

    'columnas',
    jsonb_array_length(
      p_columnas
    )
  );

end
$$;


/* ==========================================================
   ELIMINAR COLUMNA
   ========================================================== */

create or replace function public.empresa_eliminar_columna(
  p_tabla text,
  p_columna text,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tabla text;
  v_columna text;
  v_sql text;
begin

  perform public.emp_exigir_modulo(
    'big_data.estructura'
  );


  v_tabla :=
    public.emp_validar_tabla(
      p_tabla
    );


  v_columna :=
    public.emp_validar_columna(
      p_columna
    );


  v_sql :=
    format(
      'alter table public.%I drop column %I',
      v_tabla,
      v_columna
    );


  execute v_sql;


  perform public.emp_registrar(

    v_tabla,

    'drop_column',

    jsonb_build_object(
      'columna',
      v_columna
    ),

    p_motivo,

    v_sql
  );


  return jsonb_build_object(

    'tabla',
    v_tabla,

    'columna',
    v_columna
  );

end
$$;


/* ==========================================================
   ACTUALIZAR CELDA
   ========================================================== */

create or replace function public.empresa_actualizar_celda(
  p_tabla text,
  p_id bigint,
  p_columna text,
  p_valor text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tabla text;
  v_columna text;

  v_tipo text;
  v_expr text;
begin

  perform public.emp_exigir_modulo(
    'big_data.estructura'
  );


  v_tabla :=
    public.emp_validar_tabla(
      p_tabla
    );


  v_columna :=
    public.emp_validar_columna(
      p_columna
    );


  if
    p_id is null
    or
    p_id <= 0
  then

    raise exception
      'Identificador de fila no valido'
      using errcode = '22023';

  end if;


  select data_type
  into v_tipo

  from information_schema.columns

  where table_schema = 'public'
    and table_name = v_tabla
    and column_name = v_columna;


  if v_tipo is null then

    raise exception
      'La columna "%" no existe en %',
      v_columna,
      v_tabla
      using errcode = '42703';

  end if;


  if nullif(
    btrim(
      coalesce(
        p_valor,
        ''
      )
    ),
    ''
  ) is null then

    v_expr := 'null';


  elsif v_tipo = 'boolean' then

    v_expr :=
      coalesce(
        public.emp_a_booleano(
          p_valor
        )::text,
        'null'
      );


  elsif v_tipo in (
    'integer',
    'bigint',
    'smallint'
  ) then

    if public.emp_a_entero(
      p_valor
    ) is null then

      raise exception
        '"%" no es un numero entero valido',
        p_valor
        using errcode = '22023';

    end if;


    v_expr :=
      public.emp_a_entero(
        p_valor
      )::text;


  elsif v_tipo in (
    'numeric',
    'double precision',
    'real'
  ) then

    if public.emp_a_numero(
      p_valor
    ) is null then

      raise exception
        '"%" no es un numero valido',
        p_valor
        using errcode = '22023';

    end if;


    v_expr :=
      public.emp_a_numero(
        p_valor
      )::text;


  elsif v_tipo = 'date' then

    if public.emp_a_fecha(
      p_valor
    ) is null then

      raise exception
        '"%" no es una fecha valida',
        p_valor
        using errcode = '22023';

    end if;


    v_expr :=
      quote_literal(
        public.emp_a_fecha(
          p_valor
        )
      );


  else

    v_expr :=
      quote_literal(
        btrim(
          p_valor
        )
      );

  end if;


  execute format(
    'update public.%I set %I = %s where id = %s',
    v_tabla,
    v_columna,
    v_expr,
    p_id
  );


  return jsonb_build_object(

    'tabla',
    v_tabla,

    'id',
    p_id,

    'columna',
    v_columna
  );

end
$$;


/* ==========================================================
   MATERIALIZAR CSV DE LA EMPRESA
   ========================================================== */

/*
 * IMPORTANTE:
 *
 * esta funcion NO pertenece al permiso
 * big_data.estructura.
 *
 * Se ejecuta cuando se importa un CSV propio,
 * por eso exige:
 *
 * big_data.importar
 */
create or replace function public.empresa_materializar(
  p_import_id bigint,
  p_estructura jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tabla text :=
    'empresa_datos';

  v_creada boolean :=
    false;

  v_cuerpo text :=
    '';

  v_destinos text :=
    '';

  v_origenes text :=
    '';

  v_columna text;

  v_filas integer;

  r jsonb;
begin

  perform public.emp_exigir_modulo(
    'big_data.importar'
  );


  /*
   * Solo un CSV marcado como datos
   * de la empresa puede materializarse.
   *
   * Un usuario normal solo puede
   * materializar un archivo que él subió.
   *
   * El admin conserva acceso global.
   */
  if not exists (

    select 1

    from public.imports i

    where i.id =
      p_import_id

      and i.es_propia =
        true

      and (
        i.user_id =
          auth.uid()

        or

        public.app_role() =
          'admin'
      )

  ) then

    raise exception
      'No puedes incorporar esta importacion a los datos de la empresa'
      using errcode = '42501';

  end if;


  if
    p_estructura is null
    or
    jsonb_typeof(
      p_estructura
    ) <> 'array'
    or
    jsonb_array_length(
      p_estructura
    ) = 0
  then

    raise exception
      'La estructura del archivo llego vacia'
      using errcode = '22023';

  end if;


  for r in
    select *
    from jsonb_array_elements(
      p_estructura
    )
  loop

    v_columna :=
      public.emp_validar_columna(
        r ->> 'columna'
      );


    v_cuerpo :=
      v_cuerpo ||
      format(
        ', %I %s',
        v_columna,
        public.emp_tipo_sql(
          r ->> 'tipo'
        )
      );


    v_destinos :=
      v_destinos ||
      format(
        ', %I',
        v_columna
      );


    v_origenes :=
      v_origenes ||
      ', ' ||
      public.emp_expresion(
        r ->> 'original',
        r ->> 'tipo'
      );

  end loop;


  if to_regclass(
    format(
      'public.%I',
      v_tabla
    )
  ) is null then

    execute format(
      '
        create table public.%I (
          id bigint
            generated always as identity
            primary key,

          import_id bigint,

          fila integer
          %s,

          created_at timestamptz
            not null
            default now()
        )
      ',
      v_tabla,
      v_cuerpo
    );


    execute format(
      'alter table public.%I enable row level security',
      v_tabla
    );


    execute format(
      'revoke all on table public.%I from anon, authenticated',
      v_tabla
    );


    v_creada :=
      true;

  else

    for r in
      select *
      from jsonb_array_elements(
        p_estructura
      )
    loop

      v_columna :=
        public.emp_validar_columna(
          r ->> 'columna'
        );


      execute format(
        '
          alter table public.%I
          add column if not exists %I %s
        ',
        v_tabla,
        v_columna,
        public.emp_tipo_sql(
          r ->> 'tipo'
        )
      );

    end loop;

  end if;


  execute format(
    '
      insert into public.%I (
        import_id,
        fila
        %s
      )

      select
        r.import_id,
        r.fila
        %s

      from public.import_rows r

      where r.import_id = %s

      order by r.fila
    ',
    v_tabla,
    v_destinos,
    v_origenes,
    p_import_id
  );


  get diagnostics
    v_filas = row_count;


  perform public.emp_registrar(

    v_tabla,

    case

      when v_creada
      then 'create_table'

      else 'add_column'

    end,

    jsonb_build_object(

      'importId',
      p_import_id,

      'filas',
      v_filas,

      'columnas',
      p_estructura
    ),

    case

      when v_creada
      then
        'Creada al importar el primer archivo de la empresa'

      else
        'Ampliada al importar un archivo nuevo de la empresa'

    end,

    format(
      '-- materializar import %s en %s',
      p_import_id,
      v_tabla
    )
  );


  update public.imports

  set tabla_fisica =
    v_tabla

  where id =
    p_import_id;


  return jsonb_build_object(

    'tabla',
    v_tabla,

    'creada',
    v_creada,

    'filas',
    v_filas,

    'columnas',
    jsonb_array_length(
      p_estructura
    )
  );

end
$$;


/* ==========================================================
   PROTEGER TABLAS DINAMICAS YA EXISTENTES
   ========================================================== */

/*
 * Las versiones anteriores creaban una politica:
 *
 * USING (true)
 *
 * Eso permitía acceso directo a cualquier
 * autenticado.
 *
 * Ahora las tablas se utilizan solamente
 * mediante los RPC protegidos.
 */
do $$
declare
  r record;
begin

  for r in

    select tablename

    from pg_tables

    where schemaname =
      'public'

      and (
        tablename =
          'empresa_datos'

        or

        tablename like
          'emp\_%'
      )

  loop

    execute format(
      'alter table public.%I enable row level security',
      r.tablename
    );


    execute format(
      'drop policy if exists %I on public.%I',
      r.tablename || '_todo',
      r.tablename
    );


    execute format(
      'revoke all on table public.%I from anon, authenticated',
      r.tablename
    );

  end loop;

end
$$;


/* ==========================================================
   BITACORA DE CAMBIOS
   ========================================================== */

/*
 * Un usuario solo puede leer su bitacora
 * cuando tiene Estructura de datos.
 *
 * El admin puede ver todo.
 */
drop policy if exists
cambios_select
on public.cambios_estructura;


create policy cambios_select
on public.cambios_estructura

for select
to authenticated

using (

  public.app_role() =
    'admin'

  or

  (
    user_id =
      auth.uid()

    and

    public.app_tiene_modulo(
      'big_data.estructura'
    )
  )
);


/*
 * La bitacora no debe falsificarse
 * mediante INSERT directo.
 *
 * emp_registrar() la crea internamente.
 */
drop policy if exists
cambios_insert
on public.cambios_estructura;


/* ==========================================================
   PERMISOS DE LOS RPC
   ========================================================== */

revoke all on function
  public.empresa_tablas(),
  public.empresa_leer(text, integer, integer),
  public.empresa_agregar_columna(text, text, text, text, text),
  public.empresa_crear_tabla(text, jsonb, text),
  public.empresa_eliminar_columna(text, text, text),
  public.empresa_actualizar_celda(text, bigint, text, text),
  public.empresa_materializar(bigint, jsonb)
from public, anon;


grant execute on function
  public.empresa_tablas(),
  public.empresa_leer(text, integer, integer),
  public.empresa_agregar_columna(text, text, text, text, text),
  public.empresa_crear_tabla(text, jsonb, text),
  public.empresa_eliminar_columna(text, text, text),
  public.empresa_actualizar_celda(text, bigint, text, text),
  public.empresa_materializar(bigint, jsonb)
to authenticated;


commit;