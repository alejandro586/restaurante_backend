import CourseAdminModel
  from "../models/CourseAdminModel.js"


/* ==========================================================
   UTILIDADES
   ========================================================== */


/* ==========================================================
   ID NUMERICO VALIDO
   ========================================================== */

const idNumericoValido = (
  valor
) => {

  const numero =
    Number(
      valor
    )


  return (
    Number.isInteger(
      numero
    ) &&
    numero > 0
  )
}


/* ==========================================================
   TEXTO
   ========================================================== */

const textoSeguro = (
  valor
) =>
  String(
    valor ?? ""
  ).trim()


/* ==========================================================
   BOOLEANO
   ========================================================== */

const booleanoValido = (
  valor
) =>
  typeof valor ===
    "boolean"


/* ==========================================================
   ERROR
   ========================================================== */

const enviarError = (
  res,
  error
) => {

  console.error(
    "Error en administración de cursos:",
    error
  )


  const mensaje =
    textoSeguro(
      error?.message
    )


  const mensajeLower =
    mensaje.toLowerCase()


  /* ========================================================
     NO ENCONTRADO
     ======================================================== */

  if (
    mensajeLower.includes(
      "curso no encontrado"
    )
  ) {

    return res
      .status(
        404
      )
      .json({
        error:
          "Curso no encontrado"
      })
  }


  if (
    mensajeLower.includes(
      "módulo no encontrado"
    ) ||
    mensajeLower.includes(
      "modulo no encontrado"
    )
  ) {

    return res
      .status(
        404
      )
      .json({
        error:
          "Módulo no encontrado"
      })
  }


  /* ========================================================
     DUPLICADOS
     ======================================================== */

  if (
    error?.code ===
      "23505" ||
    mensajeLower.includes(
      "ya existe"
    ) ||
    mensajeLower.includes(
      "duplicate"
    ) ||
    mensajeLower.includes(
      "duplicado"
    )
  ) {

    return res
      .status(
        409
      )
      .json({
        error:
          mensaje ||
          "Ya existe un registro con esos datos"
      })
  }


  /* ========================================================
     VALIDACIONES
     ======================================================== */

  const erroresValidacion = [

    "obligatorio",

    "obligatoria",

    "no es válido",

    "no es valida",

    "no es valido",

    "no se pudo generar",

    "debe ser true o false",

    "slug",

    "clave"

  ]


  const esValidacion =
    erroresValidacion.some(
      (
        fragmento
      ) =>
        mensajeLower.includes(
          fragmento
        )
    )


  if (
    esValidacion
  ) {

    return res
      .status(
        400
      )
      .json({
        error:
          mensaje ||
          "Datos inválidos"
      })
  }


  /* ========================================================
     ERROR GENERAL
     ======================================================== */

  return res
    .status(
      500
    )
    .json({
      error:
        mensaje ||
        "Error interno del servidor"
    })
}


/* ==========================================================
   CONTROLADOR
   ========================================================== */

class CourseAdminController {


  /* ========================================================
     GET /api/admin/courses
     ======================================================== */

  /**
   * Devuelve TODOS los cursos:
   *
   * - activos
   * - desactivados
   *
   * y sus módulos:
   *
   * - activos
   * - desactivados
   *
   * Solo administrador.
   */
  async listarCatalogo(
    req,
    res
  ) {

    try {

      const model =
        new CourseAdminModel(
          req.user
        )


      const cursos =
        await model
          .listarCatalogoCompleto()


      const totalModulos =
        cursos.reduce(
          (
            total,
            curso
          ) => {

            const modulos =
              Array.isArray(
                curso?.modulos
              )
                ? curso.modulos
                : []


            return (
              total +
              modulos.length
            )
          },
          0
        )


      return res.json({

        ok:
          true,

        total_cursos:
          cursos.length,

        total_modulos:
          totalModulos,

        cursos

      })

    } catch (
      error
    ) {

      return enviarError(
        res,
        error
      )
    }
  }


  /* ========================================================
     POST /api/admin/courses
     ======================================================== */

  /**
   * Body:
   *
   * {
   *   "nombre": "Desarrollo Web",
   *   "slug": "desarrollo-web",
   *   "descripcion": "...",
   *   "orden": 2,
   *   "activo": true
   * }
   *
   * slug, descripcion, orden y activo
   * pueden omitirse.
   */
  async crearCurso(
    req,
    res
  ) {

    const nombre =
      textoSeguro(
        req.body?.nombre
      )


    if (
      !nombre
    ) {

      return res
        .status(
          400
        )
        .json({
          error:
            "El nombre del curso es obligatorio"
        })
    }


    try {

      const model =
        new CourseAdminModel(
          req.user
        )


      const curso =
        await model
          .crearCurso({

            nombre,

            slug:
              req.body?.slug,

            descripcion:
              req.body?.descripcion,

            orden:
              req.body?.orden,

            activo:
              req.body?.activo

          })


      return res
        .status(
          201
        )
        .json({

          ok:
            true,

          mensaje:
            "Curso creado correctamente",

          curso

        })

    } catch (
      error
    ) {

      return enviarError(
        res,
        error
      )
    }
  }


  /* ========================================================
     PATCH /api/admin/courses/:courseId
     ======================================================== */

  /**
   * Permite modificar:
   *
   * - nombre
   * - slug
   * - descripcion
   * - orden
   *
   * El estado se modifica mediante
   * la ruta /status.
   */
  async actualizarCurso(
    req,
    res
  ) {

    const courseId =
      req.params?.courseId


    if (
      !idNumericoValido(
        courseId
      )
    ) {

      return res
        .status(
          400
        )
        .json({
          error:
            "Curso no válido"
        })
    }


    const cambios =
      {}


    /* ======================================================
       NOMBRE
       ====================================================== */

    if (
      Object.prototype
        .hasOwnProperty
        .call(
          req.body || {},
          "nombre"
        )
    ) {

      cambios.nombre =
        req.body.nombre
    }


    /* ======================================================
       SLUG
       ====================================================== */

    if (
      Object.prototype
        .hasOwnProperty
        .call(
          req.body || {},
          "slug"
        )
    ) {

      cambios.slug =
        req.body.slug
    }


    /* ======================================================
       DESCRIPCION
       ====================================================== */

    if (
      Object.prototype
        .hasOwnProperty
        .call(
          req.body || {},
          "descripcion"
        )
    ) {

      cambios.descripcion =
        req.body.descripcion
    }


    /* ======================================================
       ORDEN
       ====================================================== */

    if (
      Object.prototype
        .hasOwnProperty
        .call(
          req.body || {},
          "orden"
        )
    ) {

      cambios.orden =
        req.body.orden
    }


    if (
      Object.keys(
        cambios
      ).length ===
        0
    ) {

      return res
        .status(
          400
        )
        .json({
          error:
            "No se enviaron cambios para actualizar el curso"
        })
    }


    try {

      const model =
        new CourseAdminModel(
          req.user
        )


      const curso =
        await model
          .actualizarCurso(
            Number(
              courseId
            ),
            cambios
          )


      return res.json({

        ok:
          true,

        mensaje:
          "Curso actualizado correctamente",

        curso

      })

    } catch (
      error
    ) {

      return enviarError(
        res,
        error
      )
    }
  }


  /* ========================================================
     PATCH /api/admin/courses/:courseId/status
     ======================================================== */

  /**
   * Body:
   *
   * {
   *   "activo": false
   * }
   */
  async cambiarEstadoCurso(
    req,
    res
  ) {

    const courseId =
      req.params?.courseId


    if (
      !idNumericoValido(
        courseId
      )
    ) {

      return res
        .status(
          400
        )
        .json({
          error:
            "Curso no válido"
        })
    }


    const activo =
      req.body?.activo


    if (
      !booleanoValido(
        activo
      )
    ) {

      return res
        .status(
          400
        )
        .json({
          error:
            "El estado del curso debe ser true o false"
        })
    }


    try {

      const model =
        new CourseAdminModel(
          req.user
        )


      const curso =
        await model
          .cambiarEstadoCurso(
            Number(
              courseId
            ),
            activo
          )


      return res.json({

        ok:
          true,

        mensaje:
          activo
            ? "Curso activado correctamente"
            : "Curso desactivado correctamente",

        curso

      })

    } catch (
      error
    ) {

      return enviarError(
        res,
        error
      )
    }
  }


  /* ========================================================
     POST /api/admin/courses/:courseId/modules
     ======================================================== */

  /**
   * Body:
   *
   * {
   *   "nombre": "Semana 1",
   *   "slug": "semana-1",
   *   "clave": "desarrollo_web.semana_1",
   *   "descripcion": "...",
   *   "orden": 1,
   *   "activo": true
   * }
   *
   * Si no se envía clave,
   * CourseAdminModel genera una.
   */
  async crearModulo(
    req,
    res
  ) {

    const courseId =
      req.params?.courseId


    if (
      !idNumericoValido(
        courseId
      )
    ) {

      return res
        .status(
          400
        )
        .json({
          error:
            "Curso no válido"
        })
    }


    const nombre =
      textoSeguro(
        req.body?.nombre
      )


    if (
      !nombre
    ) {

      return res
        .status(
          400
        )
        .json({
          error:
            "El nombre del módulo es obligatorio"
        })
    }


    try {

      const model =
        new CourseAdminModel(
          req.user
        )


      const modulo =
        await model
          .crearModulo(
            Number(
              courseId
            ),
            {

              nombre,

              slug:
                req.body?.slug,

              clave:
                req.body?.clave,

              descripcion:
                req.body?.descripcion,

              orden:
                req.body?.orden,

              activo:
                req.body?.activo

            }
          )


      return res
        .status(
          201
        )
        .json({

          ok:
            true,

          mensaje:
            "Módulo creado correctamente",

          modulo

        })

    } catch (
      error
    ) {

      return enviarError(
        res,
        error
      )
    }
  }


  /* ========================================================
     PATCH /api/admin/courses/modules/:moduleId
     ======================================================== */

  /**
   * Permite modificar:
   *
   * - nombre
   * - slug
   * - clave
   * - descripcion
   * - orden
   *
   * No cambia curso_id.
   */
  async actualizarModulo(
    req,
    res
  ) {

    const moduleId =
      req.params?.moduleId


    if (
      !idNumericoValido(
        moduleId
      )
    ) {

      return res
        .status(
          400
        )
        .json({
          error:
            "Módulo no válido"
        })
    }


    const cambios =
      {}


    /* ======================================================
       NOMBRE
       ====================================================== */

    if (
      Object.prototype
        .hasOwnProperty
        .call(
          req.body || {},
          "nombre"
        )
    ) {

      cambios.nombre =
        req.body.nombre
    }


    /* ======================================================
       SLUG
       ====================================================== */

    if (
      Object.prototype
        .hasOwnProperty
        .call(
          req.body || {},
          "slug"
        )
    ) {

      cambios.slug =
        req.body.slug
    }


    /* ======================================================
       CLAVE
       ====================================================== */

    if (
      Object.prototype
        .hasOwnProperty
        .call(
          req.body || {},
          "clave"
        )
    ) {

      cambios.clave =
        req.body.clave
    }


    /* ======================================================
       DESCRIPCION
       ====================================================== */

    if (
      Object.prototype
        .hasOwnProperty
        .call(
          req.body || {},
          "descripcion"
        )
    ) {

      cambios.descripcion =
        req.body.descripcion
    }


    /* ======================================================
       ORDEN
       ====================================================== */

    if (
      Object.prototype
        .hasOwnProperty
        .call(
          req.body || {},
          "orden"
        )
    ) {

      cambios.orden =
        req.body.orden
    }


    if (
      Object.keys(
        cambios
      ).length ===
        0
    ) {

      return res
        .status(
          400
        )
        .json({
          error:
            "No se enviaron cambios para actualizar el módulo"
        })
    }


    try {

      const model =
        new CourseAdminModel(
          req.user
        )


      const modulo =
        await model
          .actualizarModulo(
            Number(
              moduleId
            ),
            cambios
          )


      return res.json({

        ok:
          true,

        mensaje:
          "Módulo actualizado correctamente",

        modulo

      })

    } catch (
      error
    ) {

      return enviarError(
        res,
        error
      )
    }
  }


  /* ========================================================
     PATCH /api/admin/courses/modules/:moduleId/status
     ======================================================== */

  /**
   * Body:
   *
   * {
   *   "activo": false
   * }
   */
  async cambiarEstadoModulo(
    req,
    res
  ) {

    const moduleId =
      req.params?.moduleId


    if (
      !idNumericoValido(
        moduleId
      )
    ) {

      return res
        .status(
          400
        )
        .json({
          error:
            "Módulo no válido"
        })
    }


    const activo =
      req.body?.activo


    if (
      !booleanoValido(
        activo
      )
    ) {

      return res
        .status(
          400
        )
        .json({
          error:
            "El estado del módulo debe ser true o false"
        })
    }


    try {

      const model =
        new CourseAdminModel(
          req.user
        )


      const modulo =
        await model
          .cambiarEstadoModulo(
            Number(
              moduleId
            ),
            activo
          )


      return res.json({

        ok:
          true,

        mensaje:
          activo
            ? "Módulo activado correctamente"
            : "Módulo desactivado correctamente",

        modulo

      })

    } catch (
      error
    ) {

      return enviarError(
        res,
        error
      )
    }
  }
}


/* ==========================================================
   INSTANCIA
   ========================================================== */

const controller =
  new CourseAdminController()


/* ==========================================================
   EXPORTAR
   ========================================================== */

export default {

  listarCatalogo:
    controller
      .listarCatalogo
      .bind(
        controller
      ),


  crearCurso:
    controller
      .crearCurso
      .bind(
        controller
      ),


  actualizarCurso:
    controller
      .actualizarCurso
      .bind(
        controller
      ),


  cambiarEstadoCurso:
    controller
      .cambiarEstadoCurso
      .bind(
        controller
      ),


  crearModulo:
    controller
      .crearModulo
      .bind(
        controller
      ),


  actualizarModulo:
    controller
      .actualizarModulo
      .bind(
        controller
      ),


  cambiarEstadoModulo:
    controller
      .cambiarEstadoModulo
      .bind(
        controller
      )

}