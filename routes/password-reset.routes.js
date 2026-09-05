import {
  Router
} from "express"

import PasswordResetController
  from "../controllers/PasswordResetController.js"

import {
  requireAuth,
  requireAdmin
} from "../middlewares/auth.js"


const router =
  Router()


/* ==========================================================
   RUTAS PUBLICAS
   ========================================================== */

/**
 * POST
 * /api/password-reset/request
 *
 * No necesita iniciar sesión.
 *
 * El usuario escribe únicamente:
 *
 * {
 *   "email": "usuario@correo.com"
 * }
 *
 * El sistema NO confirma si el correo existe.
 */
router.post(
  "/request",
  PasswordResetController.solicitar
)


/**
 * POST
 * /api/password-reset/complete
 *
 * No necesita iniciar sesión.
 *
 * Body:
 *
 * {
 *   "email": "usuario@correo.com",
 *   "codigo": "482913",
 *   "password": "NuevaClave123",
 *   "password_confirm": "NuevaClave123"
 * }
 *
 * Esta ruta solamente funciona si:
 *
 * - existe una recuperación aprobada
 * - el código coincide
 * - el código no venció
 * - no se superaron los intentos
 */
router.post(
  "/complete",
  PasswordResetController.completar
)


/* ==========================================================
   RUTAS ADMINISTRATIVAS
   ========================================================== */

/**
 * A partir de aquí:
 *
 * 1. debe existir una sesión válida
 * 2. el usuario debe ser administrador
 */
router.use(
  "/admin",
  requireAuth,
  requireAdmin
)


/* ==========================================================
   ADMIN - LISTAR SOLICITUDES
   ========================================================== */

/**
 * GET
 * /api/password-reset/admin
 *
 * Opcional:
 *
 * /api/password-reset/admin?estado=pendiente
 *
 * Estados:
 *
 * pendiente
 * aprobado
 * rechazado
 * completado
 * vencido
 */
router.get(
  "/admin",
  PasswordResetController.listar
)


/* ==========================================================
   ADMIN - APROBAR SOLICITUD
   ========================================================== */

/**
 * POST
 * /api/password-reset/admin/:id/approve
 *
 * El administrador NO escribe una contraseña.
 *
 * RIMBERIO:
 *
 * - cambia estado a aprobado
 * - genera código temporal
 * - guarda solamente el hash
 * - devuelve el código una sola vez
 */
router.post(
  "/admin/:id/approve",
  PasswordResetController.aprobar
)


/* ==========================================================
   ADMIN - RECHAZAR SOLICITUD
   ========================================================== */

/**
 * POST
 * /api/password-reset/admin/:id/reject
 *
 * Puede rechazar:
 *
 * - pendiente
 * - aprobado
 *
 * Si estaba aprobado:
 *
 * - invalida el código
 * - elimina su vencimiento
 */
router.post(
  "/admin/:id/reject",
  PasswordResetController.rechazar
)


export default router