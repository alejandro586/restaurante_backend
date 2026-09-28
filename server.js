import "dotenv/config"

import express from "express"
import cors from "cors"


/* ==========================================================
   RUTAS PRINCIPALES
   ========================================================== */

import authRoutes from "./routes/auth.routes.js"
import importRoutes from "./routes/import.routes.js"
import compararRoutes from "./routes/comparar.routes.js"
import tareaRoutes from "./routes/tarea.routes.js"
import facialRoutes from "./routes/facial.routes.js"


/* ==========================================================
   CURSOS
   ========================================================== */

import courseRoutes from "./routes/course.routes.js"
import courseDocumentRoutes from "./routes/course-document.routes.js"


/* ==========================================================
   ADMINISTRACION
   ========================================================== */

import adminUserRoutes from "./routes/admin-user.routes.js"
import courseAdminRoutes from "./routes/course-admin.routes.js"


/* ==========================================================
   RECUPERACION DE CONTRASEÑA
   ========================================================== */

import passwordResetRoutes from "./routes/password-reset.routes.js"


/* ==========================================================
   ACTIVACION DE CUENTAS
   ========================================================== */

import activationRoutes from "./routes/activation.routes.js"


/* ==========================================================
   PROYECTOS
   ========================================================== */

import projectRoutes from "./routes/project.routes.js"
import projectTaskRoutes from "./routes/project-task.routes.js"
import projectInvitationRoutes from "./routes/project-invitation.routes.js"


/* ==========================================================
   APP
   ========================================================== */

const app = express()

const port = process.env.PORT || 4000


/* ==========================================================
   CORS
   ========================================================== */

/**
 * CLIENT_URL puede contener una o varias URLs
 * separadas por coma.
 *
 * Ejemplo en Render:
 *
 * CLIENT_URL=https://restaurante-rimberio.vercel.app,http://localhost:5173
 */

const origins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean)


/*
 * Muestra durante el inicio del servidor
 * qué dominios están autorizados.
 *
 * NO muestra claves privadas.
 */
console.log("========================================")
console.log("CONFIGURACION CORS")
console.log("Orígenes permitidos:", origins)
console.log("========================================")


app.use(
  cors({
    origin: (origin, callback) => {

      /*
       * Solicitudes que no incluyen Origin.
       *
       * Ejemplos:
       * - Render health checks
       * - Postman
       * - curl
       * - llamadas internas
       */
      if (!origin) {
        return callback(null, true)
      }


      /*
       * Normalizamos el origen.
       */
      const normalizedOrigin = origin
        .trim()
        .replace(/\/$/, "")


      /*
       * Si CLIENT_URL no está configurado,
       * permitimos temporalmente la petición.
       *
       * Esto evita romper completamente
       * el backend por una variable faltante.
       */
      if (origins.length === 0) {

        console.warn(
          "⚠️ CLIENT_URL no está configurado."
        )

        console.warn(
          "⚠️ Permitiendo temporalmente:",
          normalizedOrigin
        )

        return callback(null, true)
      }


      /*
       * Origen autorizado.
       */
      if (
        origins.includes(
          normalizedOrigin
        )
      ) {

        return callback(
          null,
          true
        )
      }


      /*
       * IMPORTANTE:
       *
       * Si CORS bloquea una petición,
       * Render mostrará exactamente
       * qué dominio intentó conectarse.
       */
      console.error(
        "========================================"
      )

      console.error(
        "❌ CORS BLOQUEADO"
      )

      console.error(
        "Origen recibido:",
        normalizedOrigin
      )

      console.error(
        "Orígenes permitidos:",
        origins
      )

      console.error(
        "========================================"
      )


      return callback(
        new Error(
          "Origen no permitido por CORS"
        )
      )
    },


    /*
     * Necesario si utilizas cookies,
     * sesiones o credenciales.
     */
    credentials: true,


    /*
     * Métodos HTTP permitidos.
     */
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS"
    ],


    /*
     * Headers permitidos.
     */
    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ]
  })
)


/* ==========================================================
   BODY
   ========================================================== */

app.use(
  express.json({
    limit: "8mb"
  })
)


app.use(
  express.urlencoded({
    extended: true
  })
)


/* ==========================================================
   AUTENTICACION
   ========================================================== */

app.use(
  "/api/auth",
  authRoutes
)


/* ==========================================================
   ACTIVACION DE CUENTAS
   ========================================================== */

app.use(
  "/api/activation",
  activationRoutes
)


/* ==========================================================
   BIG DATA - IMPORTACIONES
   ========================================================== */

app.use(
  "/api/imports",
  importRoutes
)


/* ==========================================================
   BIG DATA - COMPARACIONES
   ========================================================== */

app.use(
  "/api/comparar",
  compararRoutes
)


/* ==========================================================
   TAREAS
   ========================================================== */

app.use(
  "/api/tareas",
  tareaRoutes
)


/* ==========================================================
   RECONOCIMIENTO FACIAL - WORKFLOW VISUAL
   ========================================================== */

app.use(
  "/api/facial",
  facialRoutes
)


/* ==========================================================
   CURSOS DEL ERP
   ========================================================== */

/**
 * Ejemplos:
 *
 * GET /api/courses
 * GET /api/courses/me
 * GET /api/courses/big-data
 * GET /api/courses/big-data/modules
 */

app.use(
  "/api/courses",
  courseRoutes
)


/* ==========================================================
   DOCUMENTOS DE CURSOS
   ========================================================== */

/**
 * Ejemplos:
 *
 * GET
 * /api/course-documents/courses/:courseId
 *
 * POST
 * /api/course-documents/courses/:courseId
 *
 * GET
 * /api/course-documents/:documentId/url
 *
 * DELETE
 * /api/course-documents/:documentId
 */

app.use(
  "/api/course-documents",
  courseDocumentRoutes
)


/* ==========================================================
   ADMINISTRACION DE USUARIOS
   ========================================================== */

/**
 * Exclusivo administrador.
 *
 * GET
 * /api/admin/users
 *
 * POST
 * /api/admin/users
 *
 * GET
 * /api/admin/users/catalog
 *
 * GET
 * /api/admin/users/:userId
 *
 * GET
 * /api/admin/users/:userId/permissions
 *
 * POST
 * /api/admin/users/:userId/courses/:courseId
 *
 * DELETE
 * /api/admin/users/:userId/courses/:courseId
 *
 * POST
 * /api/admin/users/:userId/modules/:moduleId
 *
 * DELETE
 * /api/admin/users/:userId/modules/:moduleId
 */

app.use(
  "/api/admin/users",
  adminUserRoutes
)


/* ==========================================================
   ADMINISTRACION DE CURSOS Y MODULOS
   ========================================================== */

/**
 * Exclusivo administrador.
 *
 * CATALOGO
 *
 * GET
 * /api/admin/courses
 *
 *
 * CURSOS
 *
 * POST
 * /api/admin/courses
 *
 * PATCH
 * /api/admin/courses/:courseId
 *
 * PATCH
 * /api/admin/courses/:courseId/status
 *
 *
 * MODULOS
 *
 * POST
 * /api/admin/courses/:courseId/modules
 *
 * PATCH
 * /api/admin/courses/modules/:moduleId
 *
 * PATCH
 * /api/admin/courses/modules/:moduleId/status
 */

app.use(
  "/api/admin/courses",
  courseAdminRoutes
)


/* ==========================================================
   RECUPERACION DE CONTRASEÑA
   ========================================================== */

/**
 * Públicas:
 *
 * POST
 * /api/password-reset/request
 *
 * POST
 * /api/password-reset/complete
 *
 *
 * Administrador:
 *
 * GET
 * /api/password-reset/admin
 *
 * POST
 * /api/password-reset/admin/:id/approve
 *
 * POST
 * /api/password-reset/admin/:id/reject
 */

app.use(
  "/api/password-reset",
  passwordResetRoutes
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
 * project-invitation.routes.js
 * ya contiene internamente:
 *
 * /invitations/:token
 * /projects/:id/invitations
 * /mail/health
 *
 * Por eso se monta directamente
 * sobre /api.
 */

app.use(
  "/api",
  projectInvitationRoutes
)


/* ==========================================================
   HEALTH CHECK
   ========================================================== */

app.get(
  "/api/health",
  (req, res) => {

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
  (req, res) => {

    res.json({
      name: "RIMBERIO API",
      status: "online"
    })
  }
)


/* ==========================================================
   404
   ========================================================== */

/**
 * IMPORTANTE:
 *
 * Siempre debe permanecer
 * después de todas las rutas.
 */

app.use(
  (req, res) => {

    res
      .status(404)
      .json({
        error: "Recurso no encontrado"
      })
  }
)


/* ==========================================================
   MANEJO GENERAL DE ERRORES
   ========================================================== */

app.use(
  (error, req, res, next) => {

    console.error(
      "Error no controlado:",
      error
    )


    /* ======================================================
       ARCHIVO DEMASIADO GRANDE
       ====================================================== */

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


    /* ======================================================
       FORMATO NO PERMITIDO
       ====================================================== */

    if (
      error.message
        ?.includes(
          "Formato no permitido"
        )
    ) {

      return res
        .status(400)
        .json({
          error: error.message
        })
    }


    /* ======================================================
       CORS
       ====================================================== */

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


    /* ======================================================
       ERROR INTERNO
       ====================================================== */

    return res
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

    console.log(
      `Entorno: ${process.env.NODE_ENV || "development"}`
    )
  }
)