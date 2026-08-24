import { Router } from "express"
import ReportController from "../controllers/ReportController.js"
import { requireAuth } from "../middlewares/auth.js"

const router = Router()

router.use(requireAuth)

router.get("/", ReportController.index)

export default router
