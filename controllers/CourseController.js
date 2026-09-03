import CourseModel from "../models/CourseModel.js"
import { sendError } from "../utils/apiError.js"


class CourseController {

  /* ==========================================================
     GET /api/courses
     ========================================================== */

  /**
   * ADMIN:
   * Devuelve todos los cursos activos.
   *
   * USUARIO:
   * Devuelve solamente los cursos
   * que tenga asignados.
   */
  async listar(req, res) {
    try {
      const model =
        new CourseModel(req.user)

      const cursos =
        await model.listar()

      return res.json({
        total: cursos.length,
        cursos
      })

    } catch (error) {
      sendError(res, error)
    }
  }


  /* ==========================================================
     GET /api/courses/me
     ========================================================== */

  /**
   * Devuelve toda la estructura de permisos
   * del usuario autenticado.
   *
   * Ejemplo:
   *
   * Big Data
   *  - Importar
   *  - Datasets
   *  - Analizar
   *  - Graficos
   */
  async misPermisos(req, res) {
    try {
      const model =
        new CourseModel(req.user)

      const cursos =
        await model.misPermisos()

      return res.json({
        user: {
          id: req.user.id,
          email: req.user.email,
          full_name:
            req.user.full_name || null,
          role: req.user.role
        },

        total_cursos:
          cursos.length,

        cursos
      })

    } catch (error) {
      sendError(res, error)
    }
  }


  /* ==========================================================
     GET /api/courses/:curso
     ========================================================== */

  /**
   * Permite:
   *
   * /api/courses/1
   *
   * o:
   *
   * /api/courses/big-data
   */
  async obtener(req, res) {
    const valor =
      String(
        req.params.curso || ""
      ).trim()


    if (!valor) {
      return res
        .status(400)
        .json({
          error:
            "Curso no valido"
        })
    }


    try {
      const model =
        new CourseModel(req.user)

      const curso =
        await model.obtener(valor)


      if (!curso) {
        return res
          .status(404)
          .json({
            error:
              "Curso no encontrado o sin acceso"
          })
      }


      return res.json(curso)

    } catch (error) {
      sendError(res, error)
    }
  }


  /* ==========================================================
     GET /api/courses/:curso/modules
     ========================================================== */

  /**
   * Lista exclusivamente los submodulos
   * que el usuario puede utilizar dentro
   * del curso solicitado.
   */
  async modulos(req, res) {
    const valor =
      String(
        req.params.curso || ""
      ).trim()


    if (!valor) {
      return res
        .status(400)
        .json({
          error:
            "Curso no valido"
        })
    }


    try {
      const model =
        new CourseModel(req.user)


      const curso =
        await model.obtener(valor)


      if (!curso) {
        return res
          .status(404)
          .json({
            error:
              "Curso no encontrado o sin acceso"
          })
      }


      return res.json({
        curso: {
          id: curso.id,
          nombre: curso.nombre,
          slug: curso.slug,
          descripcion:
            curso.descripcion
        },

        total:
          curso.modulos.length,

        modulos:
          curso.modulos
      })

    } catch (error) {
      sendError(res, error)
    }
  }


  /* ==========================================================
     POST /api/courses/check-permission
     ========================================================== */

  /**
   * Comprobacion de permiso.
   *
   * Body:
   *
   * {
   *   "clave": "big_data.comparar"
   * }
   *
   * Respuesta:
   *
   * {
   *   "clave": "big_data.comparar",
   *   "permitido": true
   * }
   *
   * IMPORTANTE:
   *
   * Esto no sustituye los permisos reales
   * del backend.
   *
   * Nos servira para que React pueda saber
   * que botones o secciones mostrar.
   */
  async comprobarPermiso(req, res) {
    const clave =
      String(
        req.body.clave || ""
      )
        .trim()
        .toLowerCase()


    if (!clave) {
      return res
        .status(400)
        .json({
          error:
            "Debes indicar la clave del modulo"
        })
    }


    if (clave.length > 120) {
      return res
        .status(400)
        .json({
          error:
            "La clave del modulo no es valida"
        })
    }


    try {
      const model =
        new CourseModel(req.user)


      const permitido =
        await model.tieneModulo(
          clave
        )


      return res.json({
        clave,
        permitido
      })

    } catch (error) {
      sendError(res, error)
    }
  }
}


const controller =
  new CourseController()


export default {

  listar:
    controller.listar.bind(
      controller
    ),

  misPermisos:
    controller.misPermisos.bind(
      controller
    ),

  obtener:
    controller.obtener.bind(
      controller
    ),

  modulos:
    controller.modulos.bind(
      controller
    ),

  comprobarPermiso:
    controller.comprobarPermiso.bind(
      controller
    )
}