import { Router } from "express"

import ProjectTaskController from "../controllers/ProjectTaskController.js"

import {
  requireAuth
} from "../middlewares/auth.js"

const router = Router()

/**
 * Todas las rutas de actividades
 * requieren una sesion valida.
 */
router.use(requireAuth)

/**
 * GET
 * /api/projects/:id/tasks
 *
 * Lista las actividades del proyecto.
 */
router.get(
  "/:id/tasks",
  ProjectTaskController.listar
)

/**
 * GET
 * /api/projects/:id/tasks/members
 *
 * Lista los miembros que pueden
 * recibir actividades.
 *
 * IMPORTANTE:
 * Esta ruta debe estar antes de
 * /:id/tasks/:taskId
 */
router.get(
  "/:id/tasks/members",
  ProjectTaskController.miembros
)

/**
 * GET
 * /api/projects/:id/tasks/:taskId
 *
 * Obtiene una actividad especifica.
 */
router.get(
  "/:id/tasks/:taskId",
  ProjectTaskController.obtener
)

/**
 * POST
 * /api/projects/:id/tasks
 *
 * Crea una nueva actividad.
 *
 * Los permisos se comprueban
 * dentro del modelo.
 */
router.post(
  "/:id/tasks",
  ProjectTaskController.crear
)

/**
 * PATCH
 * /api/projects/:id/tasks/:taskId
 *
 * Actualiza una actividad.
 *
 * Owner / Manager / Admin:
 * pueden modificarla completa.
 *
 * Usuario asignado:
 * solamente puede cambiar estado.
 */
router.patch(
  "/:id/tasks/:taskId",
  ProjectTaskController.actualizar
)

/**
 * DELETE
 * /api/projects/:id/tasks/:taskId
 *
 * Elimina una actividad.
 */
router.delete(
  "/:id/tasks/:taskId",
  ProjectTaskController.eliminar
)

export default router