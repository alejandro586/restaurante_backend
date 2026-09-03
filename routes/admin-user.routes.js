import { Router } from "express"

import UserAdminController
  from "../controllers/UserAdminController.js"

import {
  requireAuth,
  requireAdmin
} from "../middlewares/auth.js"


const router = Router()


/* ==========================================================
   PROTECCION GENERAL
   ========================================================== */

/**
 * Todas las rutas de este archivo:
 *
 * 1. Requieren iniciar sesion.
 * 2. Requieren ser ADMIN.
 *
 * Un usuario normal no puede modificar
 * permisos aunque intente llamar
 * directamente al backend.
 */
router.use(
  requireAuth,
  requireAdmin
)


/* ==========================================================
   CATALOGO COMPLETO DE CURSOS Y MODULOS
   ========================================================== */

/**
 * GET
 * /api/admin/users/catalog
 *
 * Devuelve todos los cursos disponibles
 * y todos sus submodulos.
 *
 * Se usa para construir la pantalla
 * de asignacion de permisos.
 */
router.get(
  "/catalog",
  UserAdminController.catalogo
)


/* ==========================================================
   LISTAR USUARIOS
   ========================================================== */

/**
 * GET
 * /api/admin/users
 *
 * Lista los usuarios registrados
 * en RIMBERIO.
 */
router.get(
  "/",
  UserAdminController.listarUsuarios
)


/* ==========================================================
   PERMISOS DE UN USUARIO
   ========================================================== */

/**
 * GET
 * /api/admin/users/:userId/permissions
 *
 * Ejemplo:
 *
 * /api/admin/users/
 * 550e8400-e29b-41d4-a716-446655440000/
 * permissions
 *
 * Devuelve los cursos y submodulos
 * actualmente asignados al usuario.
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
 * Ejemplo:
 *
 * POST
 * /api/admin/users/UUID/courses/1
 *
 * Habilita Big Data para ese usuario.
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
 * Al quitar el curso tambien se
 * desactivan sus submodulos.
 */
router.delete(
  "/:userId/courses/:courseId",
  UserAdminController.quitarCurso
)


/* ==========================================================
   ASIGNAR SUBMODULO
   ========================================================== */

/**
 * POST
 * /api/admin/users/:userId/modules/:moduleId
 *
 * Ejemplo:
 *
 * POST
 * /api/admin/users/UUID/modules/6
 *
 * Si el usuario todavia no tiene
 * el curso correspondiente, el modelo
 * lo asigna automaticamente.
 */
router.post(
  "/:userId/modules/:moduleId",
  UserAdminController.asignarModulo
)


/* ==========================================================
   QUITAR SUBMODULO
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
 * Esta ruta queda al final porque
 * "/:userId" es una ruta dinamica.
 *
 * GET
 * /api/admin/users/:userId
 */
router.get(
  "/:userId",
  UserAdminController.obtenerUsuario
)


export default router