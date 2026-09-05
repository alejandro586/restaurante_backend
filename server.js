import "dotenv/config"

import express from "express"
import cors from "cors"

import authRoutes from "./routes/auth.routes.js"
import importRoutes from "./routes/import.routes.js"
import compararRoutes from "./routes/comparar.routes.js"
import tareaRoutes from "./routes/tarea.routes.js"

import courseRoutes from "./routes/course.routes.js"
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

      /*
       * Permite solicitudes sin Origin:
       *
       * - Postman
       * - curl
       * - Render health checks
       * - llamadas internas
       */
      if (!origin) {
        return callback(
          null,
          true
        )
      }


      /*
       * Si CLIENT_URL todavía no estuviera
       * configurado, permitimos temporalmente
       * cualquier origen.
       *
       * En producción CLIENT_URL sí debe
       * estar configurado.
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
       * Origen autorizado.
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
   ADMINISTRACION DE USUARIOS
   ========================================================== */

/**
 * Las rutas internas se encuentran
 * protegidas mediante:
 *
 * requireAuth
 * requireAdmin
 *
 * Ejemplos:
 *
 * GET
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
 * RUTAS ADMINISTRATIVAS:
 *
 * GET
 * /api/password-reset/admin
 *
 * POST
 * /api/password-reset/admin/:id/approve
 *
 * POST
 * /api/password-reset/admin/:id/reject
 *
 *
 * La protección de las rutas administrativas
 * está dentro de password-reset.routes.js.
 *
 * IMPORTANTE:
 *
 * server.js NO genera códigos,
 * NO conoce códigos,
 * NO imprime PASSWORD_RESET_SECRET.
 *
 * Toda esa lógica pertenece al
 * modelo de recuperación.
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
 * project-invitation.routes.js contiene
 * internamente rutas como:
 *
 * /invitations/:token
 * /projects/:id/invitations
 * /mail/health
 *
 * Por eso se monta directamente sobre /api.
 *
 * Actualmente /api/mail/health utiliza
 * MailService.verificarConexion(), que
 * comprueba la conexión con Brevo API.
 */
app.use(
  "/api",
  projectInvitationRoutes
)


/* ==========================================================
   HEALTH CHECK
   ========================================================== */

/**
 * Health check simple para comprobar
 * que Render y Express están funcionando.
 *
 * No consulta:
 *
 * - Supabase
 * - Brevo
 * - secretos
 *
 * Para Brevo existe:
 *
 * GET /api/mail/health
 */
app.get(
  "/api/health",
  (
    req,
    res
  ) => {

    res.json({
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

    res.json({
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
 * Esta ruta siempre debe quedar después
 * de todas las rutas reales.
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

    /*
     * Registramos el error interno solamente
     * en el backend.
     *
     * En producción no enviamos detalles
     * internos al navegador.
     */
    console.error(
      "Error no controlado:",
      error
    )


    /* ----------------------------------------------------------
       ARCHIVO DEMASIADO GRANDE
       ---------------------------------------------------------- */

    if (
      error?.code ===
      "LIMIT_FILE_SIZE"
    ) {

      return res
        .status(
          400
        )
        .json({
          error:
            "El archivo supera el tamaño permitido"
        })
    }


    /* ----------------------------------------------------------
       FORMATO NO PERMITIDO
       ---------------------------------------------------------- */

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


    /* ----------------------------------------------------------
       CORS
       ---------------------------------------------------------- */

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


    /* ----------------------------------------------------------
       ERROR INTERNO
       ---------------------------------------------------------- */

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

    /*
     * Solo mostramos información necesaria.
     *
     * NO mostramos:
     *
     * PASSWORD_RESET_SECRET
     * BREVO_API_KEY
     * SUPABASE_SERVICE_KEY
     * SMTP_PASS
     */
    console.log(
      `RIMBERIO API disponible en puerto ${port}`
    )
  }
)