import { Router } from "express"

import CourseController
  from "../controllers/CourseController.js"

import {
  requireAuth
} from "../middlewares/auth.js"


const router = Router()


/* ==========================================================
   TODAS LAS RUTAS DE CURSOS REQUIEREN SESION
   ========================================================== */

router.use(requireAuth)


/* ==========================================================
   MIS PERMISOS
   ========================================================== */

/**
 * GET
 * /api/courses/me
 *
 * Devuelve:
 *
 * - usuario actual
 * - cursos permitidos
 * - submodulos permitidos
 *
 * IMPORTANTE:
 * Esta ruta debe ir ANTES de /:curso
 * para evitar que Express interprete
 * "me" como si fuera un curso.
 */
router.get(
  "/me",
  CourseController.misPermisos
)


/* ==========================================================
   COMPROBAR PERMISO
   ========================================================== */

/**
 * POST
 * /api/courses/check-permission
 *
 * Body:
 *
 * {
 *   "clave": "big_data.comparar"
 * }
 *
 * Respuesta:
 *
 * {
 *   "clave": "big_data.comparar",
 *   "permitido": true
 * }
 */
router.post(
  "/check-permission",
  CourseController.comprobarPermiso
)


/* ==========================================================
   LISTAR CURSOS
   ========================================================== */

/**
 * GET
 * /api/courses
 *
 * ADMIN:
 * todos los cursos activos.
 *
 * OTROS:
 * solamente cursos asignados.
 */
router.get(
  "/",
  CourseController.listar
)


/* ==========================================================
   MODULOS DE UN CURSO
   ========================================================== */

/**
 * GET
 * /api/courses/:curso/modules
 *
 * Ejemplos:
 *
 * /api/courses/1/modules
 *
 * /api/courses/big-data/modules
 */
router.get(
  "/:curso/modules",
  CourseController.modulos
)


/* ==========================================================
   OBTENER CURSO
   ========================================================== */

/**
 * GET
 * /api/courses/:curso
 *
 * Ejemplos:
 *
 * /api/courses/1
 *
 * /api/courses/big-data
 */
router.get(
  "/:curso",
  CourseController.obtener
)


export default router