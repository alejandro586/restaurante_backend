import { Router } from "express"
import DishController from "../controllers/DishController.js"
import { requireAuth } from "../middlewares/auth.js"
import { upload } from "../middlewares/upload.js"

const router = Router()

router.use(requireAuth)

router.get("/", DishController.index)
router.get("/categories", DishController.categories)
router.post("/", DishController.create)
router.post("/import", upload.single("file"), DishController.import)
router.put("/:id", DishController.update)
router.delete("/:id", DishController.destroy)

export default router
