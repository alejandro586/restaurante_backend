import CourseDocumentModel
  from "../models/CourseDocumentModel.js"


/* ==========================================================
   UTILIDADES
   ========================================================== */

/**
 * Nunca enviamos al frontend información interna
 * de Storage que no necesita conocer.
 */
const documentoPublico =
  (documento) => {

    if (!documento) {
      return null
    }


    const {
      storage_bucket,
      storage_path,
      ...publico
    } =
      documento


    return publico
  }


/**
 * Respuesta de error interno.
 *
 * El error real queda únicamente
 * en los logs de Render.
 */
const errorInterno =
  (
    res,
    error,
    mensaje =
      "No se pudo procesar la operación"
  ) => {

    console.error(
      "CourseDocumentController:",
      error
    )


    return res
      .status(
        500
      )
      .json({
        ok:
          false,

        error:
          mensaje
      })
  }


/* ==========================================================
   RESPUESTAS DEL MODELO
   ========================================================== */

/**
 * Convierte los tipos internos del modelo
 * en respuestas HTTP coherentes.
 *
 * Devuelve true si ya respondió.
 */
const responderErrorModelo =
  (
    res,
    resultado
  ) => {

    if (
      !resultado ||
      resultado.tipo ===
        "ok"
    ) {
      return false
    }


    switch (
      resultado.tipo
    ) {

      /* ------------------------------------------------------
         CURSO
         ------------------------------------------------------ */

      case "invalid_course":

        res
          .status(
            400
          )
          .json({
            ok:
              false,

            error:
              "El curso indicado no es válido"
          })

        return true


      case "course_not_found":

        res
          .status(
            404
          )
          .json({
            ok:
              false,

            error:
              "El curso no existe o está desactivado"
          })

        return true


      /* ------------------------------------------------------
         MODULO
         ------------------------------------------------------ */

      case "invalid_module":

        res
          .status(
            400
          )
          .json({
            ok:
              false,

            error:
              "El módulo indicado no es válido"
          })

        return true


      /* ------------------------------------------------------
         PERMISOS
         ------------------------------------------------------ */

      case "forbidden":

        res
          .status(
            403
          )
          .json({
            ok:
              false,

            error:
              "No tienes permiso para acceder a este recurso"
          })

        return true


      /* ------------------------------------------------------
         ARCHIVOS
         ------------------------------------------------------ */

      case "file_required":

        res
          .status(
            400
          )
          .json({
            ok:
              false,

            error:
              "Debes seleccionar un archivo"
          })

        return true


      case "invalid_file_size":

        res
          .status(
            413
          )
          .json({
            ok:
              false,

            error:
              "El archivo está vacío o supera el límite de 25 MB"
          })

        return true


      case "invalid_file_type":

        res
          .status(
            400
          )
          .json({
            ok:
              false,

            error:
              "Formato no permitido. Usa PDF, Word, Excel o PowerPoint"
          })

        return true


      case "invalid_file_content":

        res
          .status(
            400
          )
          .json({
            ok:
              false,

            error:
              "El contenido del archivo no coincide con su formato"
          })

        return true


      /* ------------------------------------------------------
         DOCUMENTO
         ------------------------------------------------------ */

      case "not_found":

        res
          .status(
            404
          )
          .json({
            ok:
              false,

            error:
              "El documento no existe"
          })

        return true


      case "state_changed":

        res
          .status(
            409
          )
          .json({
            ok:
              false,

            error:
              "El documento cambió de estado. Actualiza la página e inténtalo nuevamente"
          })

        return true


      default:

        res
          .status(
            400
          )
          .json({
            ok:
              false,

            error:
              "No se pudo completar la operación solicitada"
          })

        return true
    }
  }


/* ==========================================================
   CONTROLADOR
   ========================================================== */

class CourseDocumentController {


  /* ========================================================
     LISTAR DOCUMENTOS DE UN CURSO
     ======================================================== */

  /**
   * GET
   *
   * /api/course-documents/courses/:courseId
   *
   * Opcional:
   *
   * ?modulo_id=1
   *
   *
   * ADMIN:
   * puede ver todos los documentos.
   *
   * USUARIO:
   * solamente los documentos generales
   * y los de módulos asignados.
   */
  async listar(
    req,
    res
  ) {

    try {

      const cursoId =
        req.params
          .courseId


      const moduloId =
        req.query
          ?.modulo_id ??
        null


      const model =
        new CourseDocumentModel()


      const resultado =
        await model
          .listar({
            usuario:
              req.user,

            cursoId,

            moduloId
          })


      if (
        responderErrorModelo(
          res,
          resultado
        )
      ) {
        return
      }


      return res.json({
        ok:
          true,

        curso:
          resultado.curso,

        total:
          (
            resultado
              .documentos ||
            []
          ).length,

        documentos:
          (
            resultado
              .documentos ||
            []
          ).map(
            documentoPublico
          )
      })

    } catch (
      error
    ) {

      return errorInterno(
        res,
        error,
        "No se pudieron cargar los documentos del curso"
      )
    }
  }


  /* ========================================================
     SUBIR DOCUMENTO
     ======================================================== */

  /**
   * POST
   *
   * /api/course-documents/courses/:courseId
   *
   * multipart/form-data
   *
   * archivo:
   *   archivo físico
   *
   * modulo_id:
   *   opcional
   *
   * descripcion:
   *   opcional
   */
  async subir(
    req,
    res
  ) {

    try {

      const cursoId =
        req.params
          .courseId


      const moduloId =
        req.body
          ?.modulo_id ??
        null


      const descripcion =
        req.body
          ?.descripcion ??
        null


      const archivo =
        req.file ||
        null


      const model =
        new CourseDocumentModel()


      const resultado =
        await model
          .subir({
            usuario:
              req.user,

            cursoId,

            moduloId,

            archivo,

            descripcion
          })


      if (
        responderErrorModelo(
          res,
          resultado
        )
      ) {
        return
      }


      return res
        .status(
          201
        )
        .json({
          ok:
            true,

          mensaje:
            "Documento subido correctamente",

          documento:
            documentoPublico(
              resultado
                .documento
            )
        })

    } catch (
      error
    ) {

      return errorInterno(
        res,
        error,
        "No se pudo subir el documento"
      )
    }
  }


  /* ========================================================
     GENERAR URL PRIVADA
     ======================================================== */

  /**
   * GET
   *
   * /api/course-documents/:documentId/url
   *
   * Genera una URL temporal de Supabase Storage.
   *
   * La URL dura solamente unos minutos.
   *
   * Sirve tanto para:
   *
   * - visualizar
   * - descargar
   */
  async obtenerUrl(
    req,
    res
  ) {

    try {

      const documentoId =
        req.params
          .documentId


      const model =
        new CourseDocumentModel()


      const resultado =
        await model
          .crearUrlFirmada({
            usuario:
              req.user,

            documentoId
          })


      if (
        responderErrorModelo(
          res,
          resultado
        )
      ) {
        return
      }


      return res.json({
        ok:
          true,

        documento:
          documentoPublico(
            resultado
              .documento
          ),

        url:
          resultado.url,

        expires_in:
          resultado
            .expires_in
      })

    } catch (
      error
    ) {

      return errorInterno(
        res,
        error,
        "No se pudo generar el acceso al documento"
      )
    }
  }


  /* ========================================================
     ELIMINAR DOCUMENTO
     ======================================================== */

  /**
   * DELETE
   *
   * /api/course-documents/:documentId
   *
   *
   * ADMIN:
   * puede eliminar cualquier documento.
   *
   * USUARIO:
   * solamente puede eliminar los
   * documentos que él mismo subió.
   */
  async eliminar(
    req,
    res
  ) {

    try {

      const documentoId =
        req.params
          .documentId


      const model =
        new CourseDocumentModel()


      const resultado =
        await model
          .eliminar({
            usuario:
              req.user,

            documentoId
          })


      if (
        responderErrorModelo(
          res,
          resultado
        )
      ) {
        return
      }


      return res.json({
        ok:
          true,

        mensaje:
          "Documento eliminado correctamente",

        documento:
          resultado
            .documento
      })

    } catch (
      error
    ) {

      return errorInterno(
        res,
        error,
        "No se pudo eliminar el documento"
      )
    }
  }
}


/* ==========================================================
   EXPORT
   ========================================================== */

export default new CourseDocumentController()