import { Router } from "express"
import AuthController from "../controllers/AuthController.js"

const router = Router()

router.post("/register", AuthController.register)
router.post("/verify", AuthController.verify)
router.post("/resend", AuthController.resend)
router.post("/login", AuthController.login)

export default router
