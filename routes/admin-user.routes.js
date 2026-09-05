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
 * 1. Sesión válida.
 * 2. Usuario activo.
 * 3. Rol administrador.
 *
 * requireAuth:
 * - valida el token
 * - obtiene el perfil real
 * - bloquea cuentas desactivadas
 *
 * requireAdmin:
 * - permite únicamente administradores
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
 * El usuario se crea inicialmente activo.
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
 * Devuelve todos los cursos y módulos
 * disponibles para asignación.
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
 * Lista todos los usuarios registrados.
 *
 * Incluye:
 *
 * - id
 * - email
 * - full_name
 * - role
 * - empresa
 * - activo
 * - created_at
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
 * No elimina:
 *
 * - datos
 * - cursos
 * - módulos
 * - permisos
 * - CSV
 * - proyectos
 * - historial
 */
router.patch(
  "/:userId/status",
  UserAdminController.cambiarEstadoUsuario
)


/* ==========================================================
   PERMISOS DE UN USUARIO
   ========================================================== */

/**
 * GET
 * /api/admin/users/:userId/permissions
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
 *
 * Habilita el curso para el usuario.
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
 * Al retirar el curso también se
 * desactivan sus módulos para ese usuario.
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
 * Si todavía no tiene el curso padre,
 * UserAdminModel lo asigna automáticamente.
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
   ACTUALIZAR DATOS DEL USUARIO
   ========================================================== */

/**
 * PATCH
 * /api/admin/users/:userId
 *
 * Permite editar:
 *
 * - nombre completo
 * - empresa
 *
 * Body:
 *
 * {
 *   "full_name": "Juan Carlos Perez",
 *   "empresa": "RIMBERIO"
 * }
 *
 * NO modifica:
 *
 * - email
 * - contraseña
 * - rol
 * - estado activo
 * - cursos
 * - módulos
 * - permisos
 */
router.patch(
  "/:userId",
  UserAdminController.actualizarUsuario
)


/* ==========================================================
   OBTENER UN USUARIO
   ========================================================== */

/**
 * GET
 * /api/admin/users/:userId
 *
 * IMPORTANTE:
 *
 * Esta ruta genérica queda al final
 * después de las rutas específicas:
 *
 * /catalog
 * /:userId/status
 * /:userId/permissions
 * /:userId/courses/...
 * /:userId/modules/...
 */
router.get(
  "/:userId",
  UserAdminController.obtenerUsuario
)


export default router