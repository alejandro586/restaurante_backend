# Backend

API REST del sistema de menus de restaurante. Arquitectura MVC sobre Node.js y Express.

## Requisitos

Node.js 18 o superior.

## Instalacion

```
npm install
npm run dev
```

La API queda disponible en `http://localhost:4000`.

## Variables de entorno

Archivo `.env` en la raiz de esta carpeta.

| Variable | Descripcion |
|---|---|
| `SUPABASE_URL` | URL del proyecto de Supabase |
| `SUPABASE_ANON_KEY` | Clave publicable del proyecto |
| `PORT` | Puerto de la API |
| `CLIENT_URL` | Origen permitido por CORS |

La clave secreta de Supabase no se usa en el proyecto. Toda consulta viaja con
el token del usuario autenticado, respetando las politicas de seguridad por fila.

## Estructura de carpetas

```
backend/
  server.js                    Configuracion de Express, CORS y montaje de rutas
  package.json
  .env
  config/
    supabase.js                Clientes de Supabase, publico y con token de usuario
  routes/
    auth.routes.js             Rutas de autenticacion
    dish.routes.js             Rutas del modulo de platos
    menu.routes.js             Rutas del modulo de menu
    report.routes.js           Rutas del modulo de reportes
  controllers/
    AuthController.js          Registro, verificacion y login
    DishController.js          Alta, edicion, baja e importacion de platos
    MenuController.js          Asignacion de platos a menus y secciones
    ReportController.js        Calculo de metricas y armado del reporte
  models/
    AuthModel.js               Operaciones contra Supabase Auth
    DishModel.js               Consultas a dishes y dish_categories
    MenuModel.js               Consultas a menus, menu_pages y menu_items
    ReportModel.js             Lectura de datos para reportes
  middlewares/
    auth.js                    Extrae y valida el token de la cabecera
    upload.js                  Recepcion del archivo con Multer
  utils/
    Importer.js                Lectura de CSV y Excel, resolucion de categorias
    Insight.js                 Reglas de recomendacion
    normalize.js               Normalizacion de nombres de plato
```

## Capas

| Capa | Carpeta | Responsabilidad |
|---|---|---|
| Rutas | `routes/` | Asocian cada URL con un metodo del controlador |
| Controlador | `controllers/` | Recibe la peticion, valida y construye la respuesta |
| Modelo | `models/` | Unico punto que consulta Supabase |

El controlador no consulta la base directamente y el modelo no construye
respuestas HTTP.

## Endpoints

### Autenticacion

| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/api/auth/register` | Crea la cuenta y envia el codigo de verificacion |
| POST | `/api/auth/verify` | Valida el codigo de 8 digitos y devuelve el token |
| POST | `/api/auth/resend` | Reenvia el codigo |
| POST | `/api/auth/login` | Inicia sesion y devuelve el token |

### Platos

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/dishes` | Lista platos. Acepta `search`, `categoryId` y `status` |
| GET | `/api/dishes/categories` | Lista las categorias activas |
| POST | `/api/dishes` | Registra un plato |
| POST | `/api/dishes/import` | Carga masiva desde CSV o Excel |
| PUT | `/api/dishes/:id` | Edita un plato |
| DELETE | `/api/dishes/:id` | Desactiva un plato sin borrarlo |

### Menu

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/menu` | Lista los platos asignados a cartas |
| GET | `/api/menu/menus` | Lista los menus disponibles |
| GET | `/api/menu/sections/:menuId` | Lista las secciones de un menu |
| POST | `/api/menu/assign` | Asigna un plato a un menu y seccion |
| PUT | `/api/menu/item/:id` | Edita precio, posicion, nota y destacado |
| DELETE | `/api/menu/item/:id` | Retira el plato de la carta |

### Reporte

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/report` | Metricas, series para graficos y recomendaciones |

### Utilitario

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/health` | Verifica que la API responde |

Todas las rutas excepto las de autenticacion y `/api/health` requieren la
cabecera `Authorization: Bearer <token>`.

## Importacion de archivos

Formatos aceptados: `.csv`, `.xlsx` y `.xls`. Tamano maximo 5 MB.

Columnas reconocidas:

| Columna | Obligatoria | Contenido |
|---|---|---|
| `name` | Si | Nombre del plato |
| `description` | No | Descripcion |
| `category` o `category_id` | No | Nombre de la categoria o su identificador |

El importador genera `name_normalized`, resuelve la categoria a su identificador
y rechaza las filas cuya categoria no exista. Los platos ya registrados se
actualizan en lugar de duplicarse.

## Recomendaciones del reporte

`utils/Insight.js` evalua cinco reglas sobre los datos:

| Regla | Situacion que detecta |
|---|---|
| Platos fuera de carta | Platos del catalogo sin aparicion en ningun menu |
| Desbalance en la carta | Una categoria triplica a la de menor cantidad |
| Incremento de precio | Un plato subio 25 por ciento o mas entre cartas |
| Concentracion de ventas | Un plato supera el 20 por ciento de los ingresos |
| Platos sin ventas | Platos publicados que no registran ventas |
