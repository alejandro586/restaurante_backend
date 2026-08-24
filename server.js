import "dotenv/config"
import express from "express"
import cors from "cors"

import authRoutes from "./routes/auth.routes.js"
import dishRoutes from "./routes/dish.routes.js"
import menuRoutes from "./routes/menu.routes.js"
import reportRoutes from "./routes/report.routes.js"

const app = express()
const port = process.env.PORT || 3000

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }))
app.use(express.json())

app.use("/api/auth", authRoutes)
app.use("/api/dishes", dishRoutes)
app.use("/api/menu", menuRoutes)
app.use("/api/report", reportRoutes)

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" })
})

app.use((req, res) => {
  res.status(404).json({ error: "Recurso no encontrado" })
})

app.use((error, req, res, next) => {
  const status = error.message.includes("Formato no permitido") ? 400 : 500
  res.status(status).json({ error: error.message || "Error interno del servidor" })
})

app.listen(port, () => {
  console.log(`API disponible en http://localhost:${port}`)
})
