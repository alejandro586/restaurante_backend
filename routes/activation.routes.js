import { Router } from "express"

import AccountActivationController from "../controllers/AccountActivationController.js"

const router = Router()

/* ==========================================================
   RUTAS PUBLICAS
   ==========================================================

   El empleado todavia no tiene sesion en este punto,
   asi que ninguna ruta de aqui pasa por requireAuth.
*/

/**
 * GET /api/activation/:token
 */
router.get("/:token", AccountActivationController.obtenerPublica)

/**
 * POST /api/activation/:token/complete
 */
router.post(
  "/:token/complete",
  AccountActivationController.completar
)

export default router