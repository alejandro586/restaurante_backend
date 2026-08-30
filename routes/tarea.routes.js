import { Router } from "express"
import TareaController from "../controllers/TareaController.js"
import { requireAuth, requireAdmin } from "../middlewares/auth.js"

const router = Router()

// Asignar es potestad del administrador. El trabajador lee y cierra sus
// tareas desde su propio modulo, directo contra la base.
router.use(requireAuth, requireAdmin)

router.get("/trabajadores", TareaController.trabajadores)
router.get("/", TareaController.listar)
router.post("/", TareaController.crear)
router.delete("/:id", TareaController.eliminar)

export default router
