import {
  Router
} from "express"

import CourseAdminController
  from "../controllers/CourseAdminController.js"

import {
  requireAuth,
  requireAdmin
} from "../middlewares/auth.js"


const router =
  Router()


/* ==========================================================
   SEGURIDAD GENERAL
   ========================================================== */

/**
 * TODAS las rutas de este archivo requieren:
 *
 * 1. sesión válida
 * 2. rol administrador
 *
 * Un usuario normal NO puede:
 *
 * - listar el catálogo administrativo completo
 * - crear cursos
 * - modificar cursos
 * - activar/desactivar cursos
 * - crear módulos
 * - modificar módulos
 * - activar/desactivar módulos
 */

router.use(
  requireAuth,
  requireAdmin
)


/* ==========================================================
   CATALOGO COMPLETO
   ========================================================== */

/**
 * GET
 * /api/admin/courses
 *
 * Devuelve:
 *
 * - cursos activos
 * - cursos desactivados
 * - módulos activos
 * - módulos desactivados
 */

router.get(
  "/",
  CourseAdminController
    .listarCatalogo
)


/* ==========================================================
   CREAR CURSO
   ========================================================== */

/**
 * POST
 * /api/admin/courses
 *
 * Body ejemplo:
 *
 * {
 *   "nombre": "Desarrollo Web",
 *   "slug": "desarrollo-web",
 *   "descripcion": "Curso de desarrollo web",
 *   "orden": 2,
 *   "activo": true
 * }
 *
 * Solamente nombre es obligatorio.
 */

router.post(
  "/",
  CourseAdminController
    .crearCurso
)


/* ==========================================================
   MODULOS
   ========================================================== */


/* ==========================================================
   ACTUALIZAR MODULO
   ========================================================== */

/**
 * PATCH
 * /api/admin/courses/modules/:moduleId
 *
 * Body parcial:
 *
 * {
 *   "nombre": "Nuevo nombre",
 *   "slug": "nuevo-slug",
 *   "clave": "curso.nueva_clave",
 *   "descripcion": "...",
 *   "orden": 2
 * }
 */

router.patch(
  "/modules/:moduleId",
  CourseAdminController
    .actualizarModulo
)


/* ==========================================================
   ACTIVAR / DESACTIVAR MODULO
   ========================================================== */

/**
 * PATCH
 * /api/admin/courses/modules/:moduleId/status
 *
 * Body:
 *
 * {
 *   "activo": false
 * }
 */

router.patch(
  "/modules/:moduleId/status",
  CourseAdminController
    .cambiarEstadoModulo
)


/* ==========================================================
   CREAR MODULO EN UN CURSO
   ========================================================== */

/**
 * POST
 * /api/admin/courses/:courseId/modules
 *
 * Body ejemplo:
 *
 * {
 *   "nombre": "Semana 1",
 *   "slug": "semana-1",
 *   "clave": "desarrollo_web.semana_1",
 *   "descripcion": "...",
 *   "orden": 1,
 *   "activo": true
 * }
 *
 * La clave puede omitirse.
 * CourseAdminModel puede generarla automáticamente.
 */

router.post(
  "/:courseId/modules",
  CourseAdminController
    .crearModulo
)


/* ==========================================================
   ESTADO DEL CURSO
   ========================================================== */

/**
 * PATCH
 * /api/admin/courses/:courseId/status
 *
 * Body:
 *
 * {
 *   "activo": false
 * }
 */

router.patch(
  "/:courseId/status",
  CourseAdminController
    .cambiarEstadoCurso
)


/* ==========================================================
   ACTUALIZAR CURSO
   ========================================================== */

/**
 * PATCH
 * /api/admin/courses/:courseId
 *
 * Body parcial:
 *
 * {
 *   "nombre": "Nuevo nombre",
 *   "slug": "nuevo-slug",
 *   "descripcion": "...",
 *   "orden": 3
 * }
 */

router.patch(
  "/:courseId",
  CourseAdminController
    .actualizarCurso
)


/* ==========================================================
   EXPORTAR
   ========================================================== */

export default router