import {
  Router
} from "express"

import multer
  from "multer"

import CourseDocumentController
  from "../controllers/CourseDocumentController.js"

import {
  requireAuth
} from "../middlewares/auth.js"

import {
  MAX_FILE_SIZE
} from "../models/CourseDocumentModel.js"


/* ==========================================================
   ROUTER
   ========================================================== */

const router =
  Router()


/* ==========================================================
   CONFIGURACION MULTER
   ========================================================== */

/**
 * Los archivos permanecen temporalmente
 * en memoria.
 *
 * Después CourseDocumentModel:
 *
 * - valida extensión
 * - valida firma real del archivo
 * - comprueba permisos
 * - lo sube a Supabase Storage
 *
 * No se escriben archivos temporales
 * en el disco de Render.
 */
const storage =
  multer.memoryStorage()


const upload =
  multer({

    storage,

    limits: {

      /*
       * Máximo 25 MB.
       */
      fileSize:
        MAX_FILE_SIZE,

      /*
       * Cada petición permite
       * solamente un archivo.
       */
      files:
        1,

      /*
       * Evita formularios con
       * cantidades excesivas de campos.
       */
      fields:
        10,

      /*
       * Longitud máxima aproximada
       * para cada campo de texto.
       */
      fieldSize:
        1024 * 1024
    }
  })


/* ==========================================================
   MANEJAR SUBIDA
   ========================================================== */

/**
 * Ejecutamos upload.single manualmente para poder
 * devolver errores claros de Multer.
 *
 * Campo esperado:
 *
 * archivo
 */
const recibirArchivo =
  (
    req,
    res,
    next
  ) => {

    upload.single(
      "archivo"
    )(
      req,
      res,
      (
        error
      ) => {

        if (!error) {
          return next()
        }


        /* ----------------------------------------------------
           ARCHIVO DEMASIADO GRANDE
           ---------------------------------------------------- */

        if (
          error instanceof
            multer.MulterError &&
          error.code ===
            "LIMIT_FILE_SIZE"
        ) {

          return res
            .status(
              413
            )
            .json({
              ok:
                false,

              error:
                "El archivo supera el límite máximo de 25 MB"
            })
        }


        /* ----------------------------------------------------
           DEMASIADOS ARCHIVOS
           ---------------------------------------------------- */

        if (
          error instanceof
            multer.MulterError &&
          (
            error.code ===
              "LIMIT_FILE_COUNT" ||
            error.code ===
              "LIMIT_UNEXPECTED_FILE"
          )
        ) {

          return res
            .status(
              400
            )
            .json({
              ok:
                false,

              error:
                "Solo puedes subir un archivo por vez usando el campo 'archivo'"
            })
        }


        /* ----------------------------------------------------
           DEMASIADOS CAMPOS
           ---------------------------------------------------- */

        if (
          error instanceof
            multer.MulterError &&
          (
            error.code ===
              "LIMIT_FIELD_COUNT" ||
            error.code ===
              "LIMIT_FIELD_VALUE"
          )
        ) {

          return res
            .status(
              400
            )
            .json({
              ok:
                false,

              error:
                "El formulario contiene demasiada información"
            })
        }


        console.error(
          "Error procesando documento con Multer:",
          error
        )


        return res
          .status(
            400
          )
          .json({
            ok:
              false,

            error:
              "No se pudo procesar el archivo enviado"
          })
      }
    )
  }


/* ==========================================================
   SEGURIDAD
   ========================================================== */

/**
 * TODAS las rutas de documentos requieren
 * una sesión válida.
 *
 * requireAuth obtiene:
 *
 * req.user.id
 * req.user.email
 * req.user.role
 * req.user.empresa
 *
 * directamente desde el backend.
 */
router.use(
  requireAuth
)


/* ==========================================================
   LISTAR DOCUMENTOS DE UN CURSO
   ========================================================== */

/**
 * GET
 *
 * /api/course-documents/courses/:courseId
 *
 *
 * Todos los documentos permitidos:
 *
 * GET
 * /api/course-documents/courses/1
 *
 *
 * Filtrar por módulo:
 *
 * GET
 * /api/course-documents/courses/1?modulo_id=3
 */
router.get(
  "/courses/:courseId",

  CourseDocumentController
    .listar
)


/* ==========================================================
   SUBIR DOCUMENTO
   ========================================================== */

/**
 * POST
 *
 * /api/course-documents/courses/:courseId
 *
 *
 * Content-Type:
 *
 * multipart/form-data
 *
 *
 * Campos:
 *
 * archivo      obligatorio
 * modulo_id    opcional
 * descripcion  opcional
 *
 *
 * Ejemplo conceptual:
 *
 * archivo:
 * Semana_01.pdf
 *
 * modulo_id:
 * 3
 *
 * descripcion:
 * Material correspondiente a la semana 1.
 */
router.post(
  "/courses/:courseId",

  recibirArchivo,

  CourseDocumentController
    .subir
)


/* ==========================================================
   OBTENER URL PRIVADA
   ========================================================== */

/**
 * GET
 *
 * /api/course-documents/:documentId/url
 *
 *
 * Devuelve una URL firmada temporal
 * generada por Supabase.
 *
 * El usuario necesita permiso real
 * sobre el curso/módulo.
 */
router.get(
  "/:documentId/url",

  CourseDocumentController
    .obtenerUrl
)


/* ==========================================================
   ELIMINAR DOCUMENTO
   ========================================================== */

/**
 * DELETE
 *
 * /api/course-documents/:documentId
 *
 *
 * ADMIN:
 * puede eliminar cualquier documento.
 *
 *
 * USUARIO:
 * solamente puede eliminar documentos
 * que él mismo haya subido y para los
 * cuales todavía tenga acceso.
 */
router.delete(
  "/:documentId",

  CourseDocumentController
    .eliminar
)


/* ==========================================================
   EXPORT
   ========================================================== */

export default router