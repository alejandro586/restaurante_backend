import { Router } from "express"
import MenuController from "../controllers/MenuController.js"
import { requireAuth } from "../middlewares/auth.js"

const router = Router()

router.use(requireAuth)

router.get("/", MenuController.index)
router.get("/menus", MenuController.menus)
router.get("/sections/:menuId", MenuController.sections)
router.post("/assign", MenuController.assign)
router.put("/item/:id", MenuController.updateItem)
router.delete("/item/:id", MenuController.removeItem)

export default router
