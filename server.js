import "dotenv/config"

import express from "express"
import cors from "cors"

import authRoutes from "./routes/auth.routes.js"
import importRoutes from "./routes/import.routes.js"
import compararRoutes from "./routes/comparar.routes.js"
import tareaRoutes from "./routes/tarea.routes.js"

import courseRoutes from "./routes/course.routes.js"
import courseDocumentRoutes from "./routes/course-document.routes.js"

import adminUserRoutes from "./routes/admin-user.routes.js"
import passwordResetRoutes from "./routes/password-reset.routes.js"

import projectRoutes from "./routes/project.routes.js"
import projectTaskRoutes from "./routes/project-task.routes.js"
import projectInvitationRoutes from "./routes/project-invitation.routes.js"


/* ==========================================================
   APP
   ========================================================== */

const app =
  express()


const port =
  process.env.PORT ||
  4000


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
 * http://localhost:5173
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

      /*
       * Permitimos peticiones sin Origin:
       *
       * - Postman
       * - curl
       * - Render health checks
       */
      if (!origin) {

        return callback(
          null,
          true
        )
      }


      /*
       * Si CLIENT_URL no estuviera configurado,
       * permitimos temporalmente cualquier origen.
       */
      if (
        origins.length ===
        0
      ) {

        return callback(
          null,
          true
        )
      }


      /*
       * Frontend autorizado.
       */
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

    credentials:
      true
  })
)


/* ==========================================================
   BODY
   ========================================================== */

/**
 * Estas configuraciones son para JSON
 * y formularios normales.
 *
 * Los documentos multipart/form-data
 * son procesados por Multer dentro de:
 *
 * course-document.routes.js
 */
app.use(
  express.json({
    limit:
      "2mb"
  })
)


app.use(
  express.urlencoded({
    extended:
      true
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
 * MODULO PRINCIPAL DEL ERP
 *
 * Todas las rutas internas están
 * protegidas mediante requireAuth.
 *
 *
 * LISTAR DOCUMENTOS
 *
 * GET
 * /api/course-documents/courses/:courseId
 *
 *
 * FILTRAR POR MODULO
 *
 * GET
 * /api/course-documents/courses/:courseId?modulo_id=1
 *
 *
 * SUBIR DOCUMENTO
 *
 * POST
 * /api/course-documents/courses/:courseId
 *
 *
 * OBTENER URL PRIVADA
 *
 * GET
 * /api/course-documents/:documentId/url
 *
 *
 * ELIMINAR DOCUMENTO
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
 * Solo administradores.
 *
 * Permite:
 *
 * - registrar usuarios
 * - editar usuarios
 * - activar/desactivar
 * - asignar cursos
 * - retirar cursos
 * - asignar módulos
 * - retirar módulos
 */
app.use(
  "/api/admin/users",
  adminUserRoutes
)


/* ==========================================================
   RECUPERACION DE CONTRASEÑA
   ========================================================== */

/**
 * RUTAS PUBLICAS:
 *
 * POST
 * /api/password-reset/request
 *
 * POST
 * /api/password-reset/complete
 *
 *
 * RUTAS ADMIN:
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
   INVITACIONES Y CORREO
   ========================================================== */

/**
 * Este archivo contiene internamente
 * rutas como:
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

/**
 * Permite comprobar que:
 *
 * - Render está levantado
 * - Express está funcionando
 */
app.get(
  "/api/health",
  (
    req,
    res
  ) => {

    return res.json({
      status:
        "ok",

      service:
        "rimberio-api"
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

    return res.json({
      name:
        "RIMBERIO API",

      status:
        "online"
    })
  }
)


/* ==========================================================
   404
   ========================================================== */

/**
 * IMPORTANTE:
 *
 * Debe quedar después de todas
 * las rutas reales.
 */
app.use(
  (
    req,
    res
  ) => {

    return res
      .status(
        404
      )
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


    /* --------------------------------------------------------
       ARCHIVO DEMASIADO GRANDE
       -------------------------------------------------------- */

    if (
      error?.code ===
      "LIMIT_FILE_SIZE"
    ) {

      return res
        .status(
          413
        )
        .json({
          error:
            "El archivo supera el tamaño permitido"
        })
    }


    /* --------------------------------------------------------
       FORMATO NO PERMITIDO
       -------------------------------------------------------- */

    if (
      error?.message
        ?.includes(
          "Formato no permitido"
        )
    ) {

      return res
        .status(
          400
        )
        .json({
          error:
            error.message
        })
    }


    /* --------------------------------------------------------
       CORS
       -------------------------------------------------------- */

    if (
      error?.message ===
      "Origen no permitido por CORS"
    ) {

      return res
        .status(
          403
        )
        .json({
          error:
            "Origen no permitido"
        })
    }


    /* --------------------------------------------------------
       ERROR INTERNO
       -------------------------------------------------------- */

    return res
      .status(
        500
      )
      .json({
        error:
          process.env.NODE_ENV ===
          "production"
            ? "Error interno del servidor"
            : error?.message ||
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