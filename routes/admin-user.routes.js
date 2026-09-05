import {
  Router
} from "express"

import UserAdminController
  from "../controllers/UserAdminController.js"

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
 * Todas las rutas de este archivo requieren:
 *
 * 1. sesión válida
 * 2. rol administrador
 *
 * Por tanto un usuario normal no puede:
 *
 * - registrar usuarios
 * - consultar todos los usuarios
 * - activar o desactivar usuarios
 * - modificar cursos
 * - modificar módulos
 */
router.use(
  requireAuth,
  requireAdmin
)


/* ==========================================================
   REGISTRAR USUARIO
   ========================================================== */

/**
 * POST /api/admin/users
 *
 * Crea:
 *
 * - cuenta en Supabase Auth
 * - registro en profiles
 *
 * El nuevo usuario comienza con:
 *
 * activo = true
 *
 * Body:
 *
 * {
 *   "full_name": "Juan Perez",
 *   "email": "juan@correo.com",
 *   "password": "Temporal123",
 *   "empresa": "Mi Restaurante"
 * }
 */
router.post(
  "/",
  UserAdminController.crearUsuario
)


/* ==========================================================
   CATALOGO DE CURSOS Y MODULOS
   ========================================================== */

/**
 * GET /api/admin/users/catalog
 *
 * Devuelve los cursos y módulos disponibles
 * para poder asignarlos a los usuarios.
 */
router.get(
  "/catalog",
  UserAdminController.catalogo
)


/* ==========================================================
   LISTAR USUARIOS
   ========================================================== */

/**
 * GET /api/admin/users
 *
 * Lista los usuarios registrados en RIMBERIO.
 *
 * Ahora cada perfil también puede devolver:
 *
 * activo: true / false
 */
router.get(
  "/",
  UserAdminController.listarUsuarios
)


/* ==========================================================
   CAMBIAR ESTADO DEL USUARIO
   ========================================================== */

/**
 * PATCH
 * /api/admin/users/:userId/status
 *
 * Permite activar o desactivar una cuenta
 * sin eliminar al usuario.
 *
 * DESACTIVAR:
 *
 * {
 *   "activo": false
 * }
 *
 * REACTIVAR:
 *
 * {
 *   "activo": true
 * }
 *
 * IMPORTANTE:
 *
 * - no elimina la cuenta de Supabase Auth
 * - no elimina cursos
 * - no elimina módulos
 * - no elimina permisos
 * - no elimina CSV
 * - no elimina proyectos
 * - no elimina historial
 *
 * Solamente cambia:
 *
 * profiles.activo
 *
 * Las cuentas administradoras están
 * protegidas por el controlador/modelo.
 */
router.patch(
  "/:userId/status",
  UserAdminController.cambiarEstadoUsuario
)


/* ==========================================================
   PERMISOS DE UN USUARIO
   ========================================================== */

/**
 * GET /api/admin/users/:userId/permissions
 *
 * Devuelve:
 *
 * - cursos asignados
 * - módulos asignados
 */
router.get(
  "/:userId/permissions",
  UserAdminController.permisosUsuario
)


/* ==========================================================
   ASIGNAR CURSO
   ========================================================== */

/**
 * POST
 * /api/admin/users/:userId/courses/:courseId
 */
router.post(
  "/:userId/courses/:courseId",
  UserAdminController.asignarCurso
)


/* ==========================================================
   QUITAR CURSO
   ========================================================== */

/**
 * DELETE
 * /api/admin/users/:userId/courses/:courseId
 *
 * Al retirar un curso también se desactivan
 * sus módulos para ese usuario.
 */
router.delete(
  "/:userId/courses/:courseId",
  UserAdminController.quitarCurso
)


/* ==========================================================
   ASIGNAR MODULO
   ========================================================== */

/**
 * POST
 * /api/admin/users/:userId/modules/:moduleId
 *
 * Si el usuario todavía no tiene asignado
 * el curso padre, el modelo lo asigna
 * automáticamente.
 */
router.post(
  "/:userId/modules/:moduleId",
  UserAdminController.asignarModulo
)


/* ==========================================================
   QUITAR MODULO
   ========================================================== */

/**
 * DELETE
 * /api/admin/users/:userId/modules/:moduleId
 */
router.delete(
  "/:userId/modules/:moduleId",
  UserAdminController.quitarModulo
)


/* ==========================================================
   OBTENER UN USUARIO
   ========================================================== */

/**
 * IMPORTANTE:
 *
 * Esta ruta debe quedar al final porque:
 *
 * /catalog
 * /:userId/status
 * /:userId/permissions
 * /:userId/courses/...
 * /:userId/modules/...
 *
 * son rutas más específicas.
 *
 * GET /api/admin/users/:userId
 */
router.get(
  "/:userId",
  UserAdminController.obtenerUsuario
)


export default router