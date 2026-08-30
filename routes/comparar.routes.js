import { Router } from "express"
import CompararController from "../controllers/CompararController.js"
import { requireAuth, requireAdmin } from "../middlewares/auth.js"

const router = Router()

router.use(requireAuth, requireAdmin)

router.post("/", CompararController.comparar)

export default router
