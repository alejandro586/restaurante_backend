import {
  Router
} from "express"

import ProjectInvitationController
  from "../controllers/ProjectInvitationController.js"

import {
  requireAuth,
  requireAdmin
} from "../middlewares/auth.js"


const router = Router()


/* ==========================================================
   INVITACION PUBLICA
   ========================================================== */

/**
 * GET
 * /api/invitations/:token
 *
 * Ruta pública para consultar
 * una invitación mediante su token.
 */
router.get(
  "/invitations/:token",

  ProjectInvitationController
    .obtenerPublica
)


/* ==========================================================
   ACEPTAR INVITACION
   ========================================================== */

/**
 * POST
 * /api/invitations/:token/accept
 *
 * Requiere autenticación.
 */
router.post(
  "/invitations/:token/accept",

  requireAuth,

  ProjectInvitationController
    .aceptar
)


/* ==========================================================
   RECHAZAR INVITACION
   ========================================================== */

/**
 * POST
 * /api/invitations/:token/reject
 *
 * Requiere autenticación.
 */
router.post(
  "/invitations/:token/reject",

  requireAuth,

  ProjectInvitationController
    .rechazar
)


/* ==========================================================
   INVITACIONES DE UN PROYECTO
   ========================================================== */

/**
 * GET
 * /api/projects/:id/invitations
 *
 * Lista las invitaciones
 * relacionadas con un proyecto.
 */
router.get(
  "/projects/:id/invitations",

  requireAuth,

  ProjectInvitationController
    .listar
)


/**
 * POST
 * /api/projects/:id/invitations
 *
 * Crea y envía una invitación.
 *
 * El servicio de correo utiliza
 * actualmente Brevo API.
 */
router.post(
  "/projects/:id/invitations",

  requireAuth,

  ProjectInvitationController
    .crear
)


/**
 * DELETE
 * /api/projects/:id/invitations/:invitationId
 *
 * Revoca una invitación pendiente.
 */
router.delete(
  "/projects/:id/invitations/:invitationId",

  requireAuth,

  ProjectInvitationController
    .revocar
)


/* ==========================================================
   DIAGNOSTICO DEL SERVICIO DE CORREO
   ========================================================== */

/**
 * GET
 * /api/mail/health
 *
 * Solo administrador.
 *
 * Comprueba que el backend pueda
 * comunicarse correctamente con
 * el servicio de correo Brevo.
 *
 * No devuelve:
 *
 * - BREVO_API_KEY
 * - credenciales
 * - contraseñas
 * - información sensible
 */
router.get(
  "/mail/health",

  requireAuth,
  requireAdmin,

  ProjectInvitationController
    .verificarCorreo
)


export default router