import { Router } from "express"
import EmpresaController from "../controllers/EmpresaController.js"
import { requireAuth, requireTrabajador } from "../middlewares/auth.js"

const router = Router()

router.use(requireAuth, requireTrabajador)

// Las operaciones de estructura ya no pasan por aqui: el frontend las
// ejecuta contra las funciones RPC definidas en migrations/002.
router.get("/sugerencias", EmpresaController.sugerencias)

export default router
