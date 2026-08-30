import { Router } from "express"
import AuthController from "../controllers/AuthController.js"
import { requireAuth } from "../middlewares/auth.js"

const router = Router()

router.post("/register", AuthController.register)
router.post("/verify", AuthController.verify)
router.post("/resend", AuthController.resend)
router.post("/login", AuthController.login)
router.get("/me", requireAuth, AuthController.me)

export default router
