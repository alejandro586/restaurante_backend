import "dotenv/config"

import express from "express"
import cors from "cors"

import authRoutes from "./routes/auth.routes.js"
import importRoutes from "./routes/import.routes.js"
import compararRoutes from "./routes/comparar.routes.js"
import tareaRoutes from "./routes/tarea.routes.js"

import projectRoutes from "./routes/project.routes.js"
import projectTaskRoutes from "./routes/project-task.routes.js"
import projectInvitationRoutes from "./routes/project-invitation.routes.js"

const app = express()

const port =
  process.env.PORT || 4000


/* ==========================================================
   CORS
   ========================================================== */

/**
 * CLIENT_URL puede contener varias URLs
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

app.use(
  cors({
    origin: (
      origin,
      callback
    ) => {
      /**
       * Permite solicitudes sin origin,
       * por ejemplo Postman, curl,
       * Render health checks, etc.
       */
      if (!origin) {
        return callback(
          null,
          true
        )
      }

      /**
       * Si no configuramos CLIENT_URL
       * permitimos temporalmente cualquier
       * origen.
       */
      if (
        origins.length === 0
      ) {
        return callback(
          null,
          true
        )
      }

      if (
        origins.includes(
          origin
        )
      ) {
        return callback(
          null,
          true
        )
      }

      return callback(
        new Error(
          "Origen no permitido por CORS"
        )
      )
    },

    credentials: true
  })
)


/* ==========================================================
   BODY
   ========================================================== */

app.use(
  express.json({
    limit: "2mb"
  })
)

app.use(
  express.urlencoded({
    extended: true
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
   INVITACIONES
   ========================================================== */

/**
 * IMPORTANTE:
 *
 * project-invitation.routes.js ya contiene
 * internamente rutas como:
 *
 * /invitations/:token
 * /projects/:id/invitations
 * /mail/health
 *
 * Por eso se monta solamente sobre /api.
 */
app.use(
  "/api",
  projectInvitationRoutes
)


/* ==========================================================
   HEALTH CHECK GENERAL
   ========================================================== */

app.get(
  "/api/health",
  (
    req,
    res
  ) => {
    res.json({
      status: "ok",
      service: "rimberio-api"
    })
  }
)


/* ==========================================================
   RUTA PRINCIPAL
   ========================================================== */

app.get(
  "/",
  (
    req,
    res
  ) => {
    res.json({
      name: "RIMBERIO API",
      status: "online"
    })
  }
)


/* ==========================================================
   404
   ========================================================== */

app.use(
  (
    req,
    res
  ) => {
    res
      .status(404)
      .json({
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
     * Archivo demasiado grande.
     */
    if (
      error.code ===
      "LIMIT_FILE_SIZE"
    ) {
      return res
        .status(400)
        .json({
          error:
            "El archivo supera el tamaño permitido"
        })
    }

    /**
     * Formato no permitido.
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

    /**
     * CORS.
     */
    if (
      error.message ===
      "Origen no permitido por CORS"
    ) {
      return res
        .status(403)
        .json({
          error:
            "Origen no permitido"
        })
    }

    res
      .status(500)
      .json({
        error:
          process.env.NODE_ENV ===
          "production"
            ? "Error interno del servidor"
            : error.message ||
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
      `RIMBERIO API disponible en puerto ${port}`
    )
  }
)