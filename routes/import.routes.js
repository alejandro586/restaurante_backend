import { Router } from "express"
import ImportController from "../controllers/ImportController.js"
import { requireAuth, requireTrabajador } from "../middlewares/auth.js"
import { upload } from "../middlewares/upload.js"

const router = Router()

router.use(requireAuth)

// Cargar archivos es tarea del trabajador. El administrador solo consulta.
router.post("/", requireTrabajador, upload.single("file"), ImportController.subir)

router.get("/", ImportController.listar)
router.get("/:id", ImportController.detalle)
router.delete("/:id", ImportController.eliminar)

export default router
