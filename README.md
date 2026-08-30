# Backend

API REST del sistema de analisis competitivo de restaurantes. Arquitectura MVC
sobre Node.js y Express.

## Que hace el sistema

Un trabajador importa archivos CSV o Excel de ventas, propios y de la
competencia, con cualquier estructura de columnas. El administrador los revisa
y compara dos restaurantes entre si para entender por que uno vende mas. El
resultado de esa comparacion vuelve al trabajador como columnas concretas que
conviene empezar a registrar, y el trabajador las crea en la base desde la
interfaz.

## Requisitos

Node.js 18 o superior.

## Instalacion

```
npm install
npm run dev
```

La API queda disponible en `http://localhost:4000`.

## Variables de entorno

| Variable | Descripcion |
|---|---|
| `SUPABASE_URL` | URL del proyecto de Supabase |
| `SUPABASE_ANON_KEY` | Clave publicable, para validar el token del usuario |
| `SUPABASE_SERVICE_KEY` | Clave de servicio. Ignora RLS |
| `SUPABASE_PROJECT_REF` | Identificador del proyecto. Solo para migraciones |
| `SUPABASE_ACCESS_TOKEN` | Token de la Management API. Solo para migraciones |
| `PORT` | Puerto de la API |
| `CLIENT_URL` | Origenes permitidos por CORS, separados por coma |

La API en ejecucion no usa la Management API. Las dos ultimas variables solo
las lee `scripts/db.mjs`, que aplica las migraciones desde la terminal en
desarrollo, y no hacen falta para desplegar.

## Estructura de carpetas

```
backend/
  server.js                    Express, CORS y montaje de rutas
  config/
    supabase.js                Clientes publico, con token de usuario y de servicio
  routes/
    auth.routes.js             Autenticacion
    import.routes.js           Carga y consulta de archivos
    empresa.routes.js          Sugerencias para el modulo del trabajador
    comparar.routes.js         Comparacion entre restaurantes
    tarea.routes.js            Asignacion de tareas a los trabajadores
  controllers/
    AuthController.js          Registro, verificacion, login y perfil
    ImportController.js        Lectura del archivo y guardado
    EmpresaController.js       Sugerencias de columnas a registrar
    CompararController.js      Analisis de uno o dos archivos
    TareaController.js         Alta y seguimiento de tareas
  models/
    AuthModel.js               Supabase Auth
    ImportModel.js             Tablas imports e import_rows
    TareaModel.js              Tabla tareas y destinatarios
  middlewares/
    auth.js                    Valida el token y resuelve el rol desde la base
    upload.js                  Recepcion del archivo con Multer
  utils/
    Importer.js                Lectura de CSV y Excel sin estructura fija
    Estructura.js              Deteccion de columnas y tipos del archivo
    Mapeo.js                   Traduce columnas reales a roles comparables
    Comparador.js              Calculo de metricas y series
    Insight.js                 Reglas de comparacion entre restaurantes
  migrations/
    001_roles_e_imports.sql    Esquema, RLS y trigger de perfiles
    002_rpc_empresa.sql        Funciones que el frontend llama para el DDL
    003_tareas.sql             Tabla tareas, RLS y cierre automatico
  scripts/
    db.mjs                     Ejecuta SQL contra la Management API
    seed-users.mjs             Crea las cuentas de prueba
    gen-csv.mjs                Genera los archivos de ejemplo
    probar-*.mjs               Pruebas manuales de cada flujo
```

## Roles

El rol se guarda en la tabla `profiles` y se lee **siempre desde la base** en
cada peticion. Lo que el frontend tenga en `localStorage` solo decide que se
dibuja, nunca que se permite.

| Rol | Modulos |
|---|---|
| `trabajador` | Importar archivos, Datos de la empresa |
| `admin` | Archivos cargados, Comparar restaurantes |

## Modelo de datos

| Tabla | Contenido |
|---|---|
| `profiles` | Rol y empresa de cada usuario. Se crea sola al registrarse |
| `imports` | Un registro por archivo: nombre, empresa, si es propia, columnas |
| `import_rows` | El contenido, en una columna `data` de tipo JSONB |
| `cambios_estructura` | Bitacora de cada ALTER y CREATE aplicado |
| `tareas` | Insights que el admin convirtio en orden para un trabajador |
| `empresa_datos` | Tabla fisica con los datos propios. La crea la primera importacion |
| `emp_*` | Tablas que crea el trabajador para registrar algo nuevo |

Los archivos importados se guardan en `import_rows.data` como JSONB porque cada
uno trae columnas distintas y no se pueden conocer de antemano. La tabla
`empresa_datos` es la excepcion: al ser la que el trabajador amplia con columnas
nuevas, necesita ser una tabla real con columnas reales.

## Endpoints

### Autenticacion

| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/api/auth/register` | Crea la cuenta y envia el codigo |
| POST | `/api/auth/verify` | Valida el codigo y devuelve el token |
| POST | `/api/auth/resend` | Reenvia el codigo |
| POST | `/api/auth/login` | Inicia sesion, devuelve token y perfil |
| GET | `/api/auth/me` | Perfil vigente segun la base |

### Archivos

| Metodo | Ruta | Rol | Descripcion |
|---|---|---|---|
| POST | `/api/imports` | trabajador | Carga un CSV o Excel |
| GET | `/api/imports` | ambos | Lista archivos. El trabajador ve los suyos |
| GET | `/api/imports/:id` | ambos | Metadata y filas, para el modal |
| DELETE | `/api/imports/:id` | ambos | Elimina la importacion y sus filas |

### Empresa (solo trabajador)

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/empresa/sugerencias` | Columnas que la competencia registra y nosotros no |

Es lo unico que queda de este modulo en el backend. Las operaciones sobre la
base las ejecuta el navegador, ver la seccion siguiente.

### Comparacion (solo admin)

| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/api/comparar` | Recibe uno o dos ids y devuelve metricas, series e insights |

### Tareas (solo admin)

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/tareas/trabajadores` | Trabajadores a los que se puede asignar |
| GET | `/api/tareas` | Avance de todo lo asignado |
| POST | `/api/tareas` | Convierte un insight en una tarea |
| DELETE | `/api/tareas/:id` | Elimina una tarea |

Asignar es potestad del administrador. El trabajador lee y cierra las suyas
desde su modulo, directo contra la base con RLS.

## Tareas

Cada insight de la comparacion se puede convertir en una orden concreta para un
trabajador. El sistema no ejecuta nada por el: la tarea se muestra y el
trabajador la resuelve a mano con el formulario de siempre.

| Tipo de tarea | Origen | Como se cierra |
|---|---|---|
| Ejecutable | Insight con `accion` (capacidades faltantes) | Sola, cuando la columna existe |
| De lectura | Cualquier otro insight | El trabajador la marca a mano |

El cierre automatico vive dentro de `empresa_agregar_columna`, no en el
frontend: asi la tarea se cierra sin importar por donde se haya creado la
columna. La funcion devuelve `tareasCerradas` para que la interfaz lo avise.

## Importacion de archivos

Formatos aceptados: `.csv`, `.xlsx` y `.xls`. Maximo 10 MB y 20 000 filas.

No hay columnas obligatorias ni nombres esperados. El importador detecta las
cabeceras que traiga el archivo, deduce el tipo de cada una y guarda las filas
tal cual. Un CSV con `plato, categoria, precio` y otro con
`producto, tipo, precio_carta, canal` conviven sin conflicto.

Los CSV se leen en crudo. Sin eso la libreria interpreta que `2026-01` es una
fecha y la reescribe como `12/31/25`, corrompiendo la columna. Los Excel si se
leen con formato, porque ahi las fechas estan guardadas como numero de serie.

## El modulo del trabajador no pasa por este backend

Por requisito del proyecto, las operaciones sobre la base que hace el trabajador
salen del navegador. Estan implementadas como funciones RPC de Postgres en
`migrations/002_rpc_empresa.sql`, y el frontend las invoca con `supabase-js`.

| Funcion | Operacion |
|---|---|
| `empresa_tablas()` | Lista las tablas administrables |
| `empresa_leer(tabla, limite, desde)` | Filas y columnas, paginadas |
| `empresa_agregar_columna(...)` | `ALTER TABLE ... ADD COLUMN` |
| `empresa_crear_tabla(...)` | `CREATE TABLE emp_...` |
| `empresa_eliminar_columna(...)` | `ALTER TABLE ... DROP COLUMN` |
| `empresa_actualizar_celda(...)` | `UPDATE` de un valor |
| `empresa_materializar(id, estructura)` | Crea o amplia `empresa_datos` desde una importacion |

### Por que no se llama a la Management API desde el navegador

Fue lo primero que se intento y no es posible. `api.supabase.com` responde con
`Access-Control-Allow-Origin` unicamente para `https://supabase.com`, su propio
dashboard. Desde cualquier otro origen el navegador descarta la respuesta por
CORS, con token o sin el.

```
Origin: https://supabase.com     -> Access-Control-Allow-Origin: https://supabase.com
Origin: https://mi-app.vercel.app -> sin cabecera, bloqueado
```

El endpoint del proyecto (`<ref>.supabase.co/rest/v1/rpc/*`) si responde
`Access-Control-Allow-Origin: *`, por eso las funciones RPC son la unica via.

### Seguridad

La clave que viaja en el bundle es la publicable (`anon`), pensada para estar en
el navegador. Lo que protege las operaciones esta dentro de la base:

| Control | Efecto |
|---|---|
| `emp_exigir_trabajador()` | Cada funcion valida contra `profiles` que quien llama sea trabajador. Un admin recibe 403 |
| `grant execute ... to authenticated` | Sin sesion no se puede ni invocar la funcion |
| `emp_validar_tabla()` | Solo `empresa_datos` y `emp_*`. `profiles` o `auth.users` dan 403 |
| `emp_validar_columna()` | Regex `^[a-z][a-z0-9_]{0,58}$`. Cualquier intento de inyeccion no pasa |
| `emp_tipo_sql()` | Lista blanca de seis tipos. No se acepta SQL libre |
| `format('%I')` | Todo identificador se cita antes de interpolarse |
| Columnas reservadas | `id`, `import_id`, `fila` y `created_at` no se pueden tocar |
| `cambios_estructura` | Cada operacion queda registrada con su SQL, su motivo y su autor |

Las funciones son `SECURITY DEFINER` porque necesitan permisos de DDL, y los
ayudantes (`emp_*`) tienen el `execute` revocado para que PostgREST no los
exponga. `scripts/probar-rpc.mjs` ejercita cada control con un JWT real.

## Comparacion entre restaurantes

Dos archivos rara vez nombran igual la misma cosa. `utils/Mapeo.js` traduce las
columnas reales a roles comparables antes de calcular nada:

| Rol | Columnas que reconoce |
|---|---|
| producto | plato, producto, item, nombre_plato, articulo |
| categoria | categoria, tipo, familia, seccion, grupo |
| precio | precio_unitario, precio_final, precio, pvp |
| unidades | unidades, cantidad, vendidos, qty |
| ingresos | ingreso_total, venta_total, total, monto |
| periodo | mes, fecha, periodo, dia |

Para precio, unidades e ingresos exige ademas que la columna sea numerica: una
columna llamada `total` con texto adentro romperia todos los calculos.

Aparte de los roles, detecta **capacidades**: columnas que revelan algo que el
negocio hace, no un dato de la venta. Son las que producen el insight principal.

| Capacidad | Se detecta en |
|---|---|
| Canal de delivery | canal, delivery, reparto, modalidad |
| Promociones | promocion, descuento, oferta |
| Combos | combo, menu_dia, paquete |
| Fidelizacion | socio, club, puntos, membresia |
| Resenas | resena, calificacion, rating |
| Costo y margen | costo, margen, utilidad, food_cost |

Una columna `canal` que solo dice `Salon` no cuenta como delivery, y una columna
booleana en la que nunca se dice que si tampoco: la capacidad tiene que estar
efectivamente en uso.

## Reglas de insight

`utils/Insight.js` evalua ocho reglas y devuelve las seis mas relevantes,
ordenadas por nivel (`oportunidad`, `alerta`, `info`).

| Regla | Situacion que detecta |
|---|---|
| Brecha de ingresos | El otro factura 15 por ciento mas, y si es por volumen o por precio |
| Capacidades faltantes | El otro registra algo que nosotros ni medimos |
| Peso del canal | Cuanto del ingreso ajeno sale del delivery |
| Ticket promedio | Diferencia mayor al 10 por ciento, con el impacto en soles |
| Amplitud de catalogo | El otro mueve 25 por ciento mas productos distintos |
| Categorias sin cubrir | Categorias que el otro trabaja y nosotros no |
| Concentracion | Un solo plato pasa el 18 por ciento de nuestro ingreso |
| Tendencia | Si la brecha se abre o se cierra en el periodo |

Las reglas de capacidades faltantes traen una `accion`: el nombre y el tipo de la
columna que conviene crear. Es lo que enlaza el modulo del administrador con el
del trabajador.
