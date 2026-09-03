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
 * Esta ruta es PUBLICA.
 *
 * Sirve para que alguien pueda abrir
 * el enlace recibido por correo y ver:
 *
 * - proyecto
 * - rol
 * - quien lo invito
 * - fecha de expiracion
 *
 * aunque todavia no haya iniciado sesion.
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
 * Requiere iniciar sesion.
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
 * Requiere iniciar sesion.
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
 * Lista invitaciones:
 *
 * - pendientes
 * - aceptadas
 * - rechazadas
 * - revocadas
 * - expiradas
 *
 * Los permisos finales se comprueban
 * nuevamente dentro del modelo.
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
 * Crea y envia una invitacion.
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
 * Revoca una invitacion pendiente.
 */
router.delete(
  "/projects/:id/invitations/:invitationId",

  requireAuth,

  ProjectInvitationController
    .revocar
)


/* ==========================================================
   DIAGNOSTICO DEL CORREO
   ========================================================== */

/**
 * GET
 * /api/mail/health
 *
 * Solo administrador general.
 *
 * Comprueba que:
 *
 * - SMTP_HOST
 * - SMTP_PORT
 * - SMTP_USER
 * - SMTP_PASS
 *
 * esten funcionando correctamente.
 */
router.get(
  "/mail/health",

  requireAuth,
  requireAdmin,

  ProjectInvitationController
    .verificarCorreo
)


export default router