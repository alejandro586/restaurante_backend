import express
  from "express"

import FacialController
  from "../controllers/FacialController.js"

import {
  requireAuth,
  requireAnyModulePermission,
  requireModulePermission
} from "../middlewares/auth.js"


const router =
  express.Router()


router.get(
  "/status",
  requireAuth,
  requireAnyModulePermission(
    "facial.en_vivo",
    "facial.analizar_imagen"
  ),
  FacialController.status
)


router.post(
  "/analyze",
  requireAuth,
  requireAnyModulePermission(
    "facial.en_vivo",
    "facial.analizar_imagen"
  ),
  FacialController.analizar
)


router.get(
  "/history",
  requireAuth,
  requireModulePermission(
    "facial.historial"
  ),
  FacialController.historial
)


router.get(
  "/stats",
  requireAuth,
  requireModulePermission(
    "facial.estadisticas"
  ),
  FacialController.estadisticas
)


export default router
