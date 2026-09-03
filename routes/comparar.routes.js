import {
  Router
} from "express"

import CompararController
  from "../controllers/CompararController.js"

import {
  requireAuth,
  requireAdmin,
  requireModulePermission
} from "../middlewares/auth.js"


const router =
  Router()


/* ==========================================================
   AUTENTICACION GENERAL
   ========================================================== */

/*
 * Todas las rutas de este archivo
 * requieren una sesion valida.
 */
router.use(
  requireAuth
)


/* ==========================================================
   VALIDAR CANTIDAD DE DATASETS
   ========================================================== */

const requireCantidadDatasets =
  (
    cantidad,
    mensaje
  ) =>
  (
    req,
    res,
    next
  ) => {

    const ids =
      Array.isArray(
        req.body?.ids
      )
        ? req.body.ids
        : []


    if (
      ids.length !==
      cantidad
    ) {
      return res
        .status(400)
        .json({
          error:
            mensaje
        })
    }


    next()
  }


/* ==========================================================
   ADMINISTRADOR - MODO COMPLETO
   ========================================================== */

/*
 * POST /api/comparar
 *
 * Esta ruta se conserva para el
 * administrador.
 *
 * Puede trabajar con uno o dos
 * datasets igual que antes.
 */
router.post(
  "/",

  requireAdmin,

  CompararController.comparar
)


/* ==========================================================
   BIG DATA - ANALISIS
   ========================================================== */

/*
 * POST /api/comparar/analisis
 *
 * Necesita:
 * big_data.analisis
 *
 * Solamente permite analizar
 * UN dataset.
 */
router.post(
  "/analisis",

  requireModulePermission(
    "big_data.analisis"
  ),

  requireCantidadDatasets(
    1,
    "Selecciona exactamente un dataset para realizar el analisis"
  ),

  CompararController.comparar
)


/* ==========================================================
   BIG DATA - COMPARACION
   ========================================================== */

/*
 * POST /api/comparar/comparacion
 *
 * Necesita:
 * big_data.comparar
 *
 * Obliga a seleccionar exactamente
 * DOS datasets.
 */
router.post(
  "/comparacion",

  requireModulePermission(
    "big_data.comparar"
  ),

  requireCantidadDatasets(
    2,
    "Selecciona exactamente dos datasets para realizar la comparacion"
  ),

  CompararController.comparar
)


/* ==========================================================
   BIG DATA - GRAFICOS
   ========================================================== */

/*
 * POST /api/comparar/graficos
 *
 * Necesita:
 * big_data.graficos
 *
 * Solamente trabaja con un dataset.
 */
router.post(
  "/graficos",

  requireModulePermission(
    "big_data.graficos"
  ),

  requireCantidadDatasets(
    1,
    "Selecciona exactamente un dataset para generar los graficos"
  ),

  CompararController.comparar
)


export default router