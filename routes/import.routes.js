import {
  Router
} from "express"

import ImportController
  from "../controllers/ImportController.js"

import {
  requireAuth,
  requireAdmin,
  requireModulePermission,
  requireAnyModulePermission
} from "../middlewares/auth.js"

import {
  upload
} from "../middlewares/upload.js"


const router =
  Router()


/* ==========================================================
   TODAS LAS RUTAS REQUIEREN SESION
   ========================================================== */

router.use(
  requireAuth
)


/* ==========================================================
   PERMISOS QUE NECESITAN LEER DATASETS
   ========================================================== */

/*
 * No solamente "Datasets" necesita GET /imports.
 *
 * Tambien:
 *
 * - Importar necesita mostrar los archivos existentes.
 * - Analisis necesita elegir un dataset.
 * - Comparacion necesita elegir datasets.
 * - Graficos necesita elegir un dataset.
 *
 * Basta con tener UNO de estos permisos.
 */
const requireDatasetRead =
  requireAnyModulePermission(
    "big_data.importar",
    "big_data.datasets",
    "big_data.analisis",
    "big_data.comparar",
    "big_data.graficos"
  )


/* ==========================================================
   IMPORTAR DATOS
   ========================================================== */

/**
 * POST /api/imports
 *
 * Solamente:
 *
 * - administrador
 * - usuario con big_data.importar
 *
 * puede cargar nuevos CSV o Excel.
 */
router.post(
  "/",

  requireModulePermission(
    "big_data.importar"
  ),

  upload.single(
    "file"
  ),

  ImportController.subir
)


/* ==========================================================
   LISTAR DATASETS
   ========================================================== */

/**
 * GET /api/imports
 *
 * Devuelve los datasets que el usuario
 * puede utilizar según ImportModel:
 *
 * ADMIN
 * → todos los CSV del sistema
 *
 * USUARIO
 * → datos propios compartidos de su empresa
 * → + sus propios CSV externos
 */
router.get(
  "/",

  requireDatasetRead,

  ImportController.listar
)


/* ==========================================================
   VER UN DATASET
   ========================================================== */

/**
 * GET /api/imports/:id
 *
 * Permite abrir las filas del dataset.
 *
 * ImportModel.buscar() vuelve a comprobar
 * que realmente tenga acceso al archivo.
 */
router.get(
  "/:id",

  requireDatasetRead,

  ImportController.detalle
)


/* ==========================================================
   ELIMINAR DATASET
   ========================================================== */

/**
 * DELETE /api/imports/:id
 *
 * De momento solo administrador.
 *
 * Esto evita que un trabajador pueda
 * eliminar un CSV propio compartido que
 * estén utilizando otros usuarios.
 *
 * Más adelante, si queremos, podemos crear:
 *
 * - eliminar externo propio
 * - eliminar compartido solo admin
 */
router.delete(
  "/:id",

  requireAdmin,

  ImportController.eliminar
)


export default router