import "dotenv/config"

import express from "express"
import cors from "cors"

import authRoutes from "./routes/auth.routes.js"
import importRoutes from "./routes/import.routes.js"
import compararRoutes from "./routes/comparar.routes.js"
import tareaRoutes from "./routes/tarea.routes.js"

import projectRoutes from "./routes/project.routes.js"
import projectTaskRoutes from "./routes/project-task.routes.js"

const app = express()

const port =
  process.env.PORT || 4000

/**
 * Permite una o varias URLs
 * separadas por coma.
 *
 * Ejemplo:
 *
 * CLIENT_URL=
 * https://restaurante-rimberio.vercel.app,
 * http://localhost:5000
 */
const origins =
  (
    process.env.CLIENT_URL ||
    ""
  )
    .split(",")
    .map(
      (origin) =>
        origin.trim()
    )
    .filter(Boolean)

/**
 * CORS
 */
app.use(
  cors({
    origin:
      origins.length > 0
        ? origins
        : true,

    credentials: true
  })
)

/**
 * JSON
 */
app.use(
  express.json({
    limit: "2mb"
  })
)

/* ==========================================================
   RUTAS EXISTENTES
   ========================================================== */

app.use(
  "/api/auth",
  authRoutes
)

app.use(
  "/api/imports",
  importRoutes
)

app.use(
  "/api/comparar",
  compararRoutes
)

app.use(
  "/api/tareas",
  tareaRoutes
)

/* ==========================================================
   PROYECTOS
   ========================================================== */

app.use(
  "/api/projects",
  projectRoutes
)

/* ==========================================================
   ACTIVIDADES DE PROYECTOS
   ========================================================== */

app.use(
  "/api/projects",
  projectTaskRoutes
)

/* ==========================================================
   HEALTH CHECK
   ========================================================== */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      status: "ok"
    })
  }
)

/* ==========================================================
   404
   ========================================================== */

app.use(
  (req, res) => {
    res.status(404).json({
      error:
        "Recurso no encontrado"
    })
  }
)

/* ==========================================================
   MANEJO GENERAL DE ERRORES
   ========================================================== */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "Error no controlado:",
      error
    )

    /**
     * Multer:
     * archivo demasiado grande.
     */
    if (
      error.code ===
      "LIMIT_FILE_SIZE"
    ) {
      return res
        .status(400)
        .json({
          error:
            "El archivo supera los 10 MB permitidos"
        })
    }

    /**
     * Formato de archivo incorrecto.
     */
    if (
      error.message?.includes(
        "Formato no permitido"
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            error.message
        })
    }

    res.status(500).json({
      error:
        error.message ||
        "Error interno del servidor"
    })
  }
)

/* ==========================================================
   SERVIDOR
   ========================================================== */

app.listen(
  port,
  () => {
    console.log(
      `API disponible en puerto ${port}`
    )
  }
)