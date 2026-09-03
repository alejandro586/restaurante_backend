import { Router } from "express"

import ProjectController from "../controllers/ProjectController.js"

import {
  requireAuth,
  requireProjectCreator
} from "../middlewares/auth.js"

const router = Router()

/**
 * Todas las rutas de proyectos requieren
 * que el usuario tenga una sesion valida.
 */
router.use(requireAuth)

/**
 * GET /api/projects
 *
 * Lista los proyectos disponibles
 * para el usuario autenticado.
 */
router.get(
  "/",
  ProjectController.listar
)

/**
 * GET /api/projects/:id/members
 *
 * Obtiene los miembros de un proyecto.
 *
 * IMPORTANTE:
 * Esta ruta debe ir antes de /:id
 * para evitar conflictos con Express.
 */
router.get(
  "/:id/members",
  ProjectController.miembros
)

/**
 * GET /api/projects/:id
 *
 * Obtiene el detalle de un proyecto.
 */
router.get(
  "/:id",
  ProjectController.obtener
)

/**
 * POST /api/projects
 *
 * Crea un proyecto nuevo.
 *
 * Solo:
 * - admin
 * - supervisor
 */
router.post(
  "/",
  requireProjectCreator,
  ProjectController.crear
)

/**
 * PATCH /api/projects/:id
 *
 * Permite actualizar:
 * - nombre
 * - descripcion
 * - estado
 * - visibilidad
 *
 * Los permisos específicos
 * se validan dentro del modelo.
 */
router.patch(
  "/:id",
  ProjectController.actualizar
)

/**
 * DELETE /api/projects/:id
 *
 * Solo puede eliminar:
 * - administrador
 * - creador del proyecto
 */
router.delete(
  "/:id",
  ProjectController.eliminar
)

export default router