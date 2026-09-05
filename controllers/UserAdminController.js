import UserAdminModel from "../models/UserAdminModel.js"
import { sendError } from "../utils/apiError.js"


/* ==========================================================
   VALIDACIONES
   ========================================================== */

const uuidValido = (valor) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(valor || "").trim()
  )
}


const idNumericoValido = (valor) => {
  return /^\d+$/.test(
    String(valor || "").trim()
  )
}


class UserAdminController {


  /* ==========================================================
     CREAR USUARIO
     ========================================================== */

  async crearUsuario(
    req,
    res
  ) {

    try {

      /* ======================================================
         DATOS RECIBIDOS
         ====================================================== */

      const {
        email,
        password,
        full_name,
        fullName,
        empresa
      } =
        req.body || {}


      /*
       * Aceptamos full_name y fullName
       * para evitar problemas entre frontend
       * y backend.
       */
      const nombre =
        String(
          full_name ||
          fullName ||
          ""
        ).trim()


      const correo =
        String(
          email || ""
        )
          .trim()
          .toLowerCase()


      const empresaFinal =
        String(
          empresa || ""
        ).trim()


      /* ======================================================
         VALIDACIONES
         ====================================================== */

      if (!nombre) {

        return res
          .status(400)
          .json({
            error:
              "El nombre completo es obligatorio"
          })
      }


      if (!correo) {

        return res
          .status(400)
          .json({
            error:
              "El correo es obligatorio"
          })
      }


      /*
       * Validación sencilla del formato.
       *
       * Supabase también validará el correo,
       * pero así podemos devolver un mensaje
       * más claro.
       */
      const emailValido =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          .test(
            correo
          )


      if (!emailValido) {

        return res
          .status(400)
          .json({
            error:
              "Ingresa un correo electrónico válido"
          })
      }


      if (!password) {

        return res
          .status(400)
          .json({
            error:
              "La contraseña es obligatoria"
          })
      }


      if (
        String(
          password
        ).length <
        8
      ) {

        return res
          .status(400)
          .json({
            error:
              "La contraseña debe tener al menos 8 caracteres"
          })
      }


      if (!empresaFinal) {

        return res
          .status(400)
          .json({
            error:
              "La empresa es obligatoria"
          })
      }


      /* ======================================================
         CREAR USUARIO
         ====================================================== */

      const model =
        new UserAdminModel(
          req.user
        )


      const usuario =
        await model
          .crearUsuario({
            email:
              correo,

            password:
              String(
                password
              ),

            fullName:
              nombre,

            empresa:
              empresaFinal
          })


      /* ======================================================
         RESPUESTA
         ====================================================== */

      return res
        .status(201)
        .json({

          mensaje:
            "Usuario registrado correctamente",

          usuario

        })

    } catch (error) {

      console.error(
        "Error creando usuario:",
        error
      )


      const mensaje =
        String(
          error?.message ||
          ""
        )


      const mensajeLower =
        mensaje.toLowerCase()


      /* ======================================================
         CORREO DUPLICADO
         ====================================================== */

      if (
        mensajeLower.includes(
          "ya está registrado"
        ) ||
        mensajeLower.includes(
          "already registered"
        ) ||
        mensajeLower.includes(
          "already been registered"
        ) ||
        mensajeLower.includes(
          "user already"
        )
      ) {

        return res
          .status(409)
          .json({
            error:
              "Ese correo ya está registrado en RIMBERIO"
          })
      }


      /* ======================================================
         CORREO INVALIDO
         ====================================================== */

      if (
        mensajeLower.includes(
          "invalid email"
        )
      ) {

        return res
          .status(400)
          .json({
            error:
              "El correo electrónico no es válido"
          })
      }


      /* ======================================================
         CONTRASEÑA
         ====================================================== */

      if (
        mensajeLower.includes(
          "password"
        )
      ) {

        return res
          .status(400)
          .json({
            error:
              mensaje ||
              "La contraseña no cumple los requisitos"
          })
      }


      /* ======================================================
         ERROR GENERAL
         ====================================================== */

      return res
        .status(500)
        .json({
          error:
            mensaje ||
            "No se pudo registrar el usuario"
        })
    }
  }




  /* ==========================================================
     GET /api/admin/users
     ========================================================== */

  /**
   * Lista todos los usuarios registrados
   * en RIMBERIO.
   *
   * Esta ruta sera exclusiva para ADMIN.
   */
  async listarUsuarios(req, res) {
    try {
      const model =
        new UserAdminModel(req.user)

      const usuarios =
        await model.listarUsuarios()

      return res.json({
        total:
          usuarios.length,

        usuarios
      })

    } catch (error) {
      sendError(res, error)
    }
  }


  /* ==========================================================
     GET /api/admin/users/catalog
     ========================================================== */

  /**
   * Devuelve todos los cursos y todos
   * sus submodulos activos.
   *
   * Sirve para construir la pantalla:
   *
   * BIG DATA
   * ☑ Importar
   * ☑ Datasets
   * ☑ Analisis
   * ☑ Comparacion
   * ☑ Estructura
   * ☑ Graficos
   */
  async catalogo(req, res) {
    try {
      const model =
        new UserAdminModel(req.user)

      const cursos =
        await model.obtenerCatalogo()

      return res.json({
        total_cursos:
          cursos.length,

        cursos
      })

    } catch (error) {
      sendError(res, error)
    }
  }


  /* ==========================================================
     GET /api/admin/users/:userId
     ========================================================== */

  /**
   * Obtiene:
   *
   * - perfil
   * - rol actual
   * - empresa
   * - cursos asignados
   * - submodulos asignados
   */
  async obtenerUsuario(req, res) {
    const userId =
      String(
        req.params.userId || ""
      ).trim()


    if (!uuidValido(userId)) {
      return res
        .status(400)
        .json({
          error:
            "Usuario no valido"
        })
    }


    try {
      const model =
        new UserAdminModel(req.user)

      const usuario =
        await model.obtenerUsuario(
          userId
        )


      if (!usuario) {
        return res
          .status(404)
          .json({
            error:
              "Usuario no encontrado"
          })
      }


      return res.json(usuario)

    } catch (error) {
      sendError(res, error)
    }
  }


  /* ==========================================================
     GET /api/admin/users/:userId/permissions
     ========================================================== */

  /**
   * Devuelve solamente los permisos
   * actuales del usuario.
   */
  async permisosUsuario(req, res) {
    const userId =
      String(
        req.params.userId || ""
      ).trim()


    if (!uuidValido(userId)) {
      return res
        .status(400)
        .json({
          error:
            "Usuario no valido"
        })
    }


    try {
      const model =
        new UserAdminModel(req.user)

      const permisos =
        await model
          .obtenerPermisosUsuario(
            userId
          )


      if (!permisos) {
        return res
          .status(404)
          .json({
            error:
              "Usuario no encontrado"
          })
      }


      return res.json({
        user_id:
          userId,

        permisos
      })

    } catch (error) {
      sendError(res, error)
    }
  }


  /* ==========================================================
     POST /api/admin/users/:userId/courses/:courseId
     ========================================================== */

  /**
   * Asigna un curso completo al usuario.
   *
   * IMPORTANTE:
   *
   * Esto solamente habilita el curso.
   *
   * Los submodulos se asignan
   * individualmente.
   */
  async asignarCurso(req, res) {
    const userId =
      String(
        req.params.userId || ""
      ).trim()


    const courseId =
      String(
        req.params.courseId || ""
      ).trim()


    if (!uuidValido(userId)) {
      return res
        .status(400)
        .json({
          error:
            "Usuario no valido"
        })
    }


    if (
      !idNumericoValido(
        courseId
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Curso no valido"
        })
    }


    try {
      const model =
        new UserAdminModel(req.user)


      const resultado =
        await model.asignarCurso(
          userId,
          Number(courseId)
        )


      if (
        resultado.tipo ===
        "user_not_found"
      ) {
        return res
          .status(404)
          .json({
            error:
              "Usuario no encontrado"
          })
      }


      if (
        resultado.tipo ===
        "course_not_found"
      ) {
        return res
          .status(404)
          .json({
            error:
              "Curso no encontrado"
          })
      }


      return res.json({
        ok: true,

        mensaje:
          "Curso asignado correctamente",

        asignacion:
          resultado.asignacion
      })

    } catch (error) {
      sendError(res, error)
    }
  }


  /* ==========================================================
     DELETE /api/admin/users/:userId/courses/:courseId
     ========================================================== */

  /**
   * Quita el acceso al curso.
   *
   * UserAdminModel tambien desactiva
   * los submodulos pertenecientes
   * al curso.
   */
  async quitarCurso(req, res) {
    const userId =
      String(
        req.params.userId || ""
      ).trim()


    const courseId =
      String(
        req.params.courseId || ""
      ).trim()


    if (!uuidValido(userId)) {
      return res
        .status(400)
        .json({
          error:
            "Usuario no valido"
        })
    }


    if (
      !idNumericoValido(
        courseId
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Curso no valido"
        })
    }


    try {
      const model =
        new UserAdminModel(req.user)


      const resultado =
        await model.quitarCurso(
          userId,
          Number(courseId)
        )


      if (
        resultado.tipo ===
        "user_not_found"
      ) {
        return res
          .status(404)
          .json({
            error:
              "Usuario no encontrado"
          })
      }


      if (
        resultado.tipo ===
        "course_not_found"
      ) {
        return res
          .status(404)
          .json({
            error:
              "Curso no encontrado"
          })
      }


      return res.json({
        ok: true,

        mensaje:
          "Acceso al curso eliminado correctamente"
      })

    } catch (error) {
      sendError(res, error)
    }
  }


  /* ==========================================================
     POST /api/admin/users/:userId/modules/:moduleId
     ========================================================== */

  /**
   * Asigna un submodulo.
   *
   * Si el usuario todavia no tiene
   * el curso correspondiente,
   * UserAdminModel lo asigna
   * automaticamente.
   */
  async asignarModulo(req, res) {
    const userId =
      String(
        req.params.userId || ""
      ).trim()


    const moduleId =
      String(
        req.params.moduleId || ""
      ).trim()


    if (!uuidValido(userId)) {
      return res
        .status(400)
        .json({
          error:
            "Usuario no valido"
        })
    }


    if (
      !idNumericoValido(
        moduleId
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Modulo no valido"
        })
    }


    try {
      const model =
        new UserAdminModel(req.user)


      const resultado =
        await model.asignarModulo(
          userId,
          Number(moduleId)
        )


      if (
        resultado.tipo ===
        "user_not_found"
      ) {
        return res
          .status(404)
          .json({
            error:
              "Usuario no encontrado"
          })
      }


      if (
        resultado.tipo ===
        "module_not_found"
      ) {
        return res
          .status(404)
          .json({
            error:
              "Modulo no encontrado"
          })
      }


      if (
        resultado.tipo ===
        "course_not_found"
      ) {
        return res
          .status(404)
          .json({
            error:
              "El curso asociado al modulo no existe"
          })
      }


      return res.json({
        ok: true,

        mensaje:
          "Modulo asignado correctamente",

        asignacion:
          resultado.asignacion
      })

    } catch (error) {
      sendError(res, error)
    }
  }


  /* ==========================================================
     DELETE /api/admin/users/:userId/modules/:moduleId
     ========================================================== */

  async quitarModulo(req, res) {
    const userId =
      String(
        req.params.userId || ""
      ).trim()


    const moduleId =
      String(
        req.params.moduleId || ""
      ).trim()


    if (!uuidValido(userId)) {
      return res
        .status(400)
        .json({
          error:
            "Usuario no valido"
        })
    }


    if (
      !idNumericoValido(
        moduleId
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Modulo no valido"
        })
    }


    try {
      const model =
        new UserAdminModel(req.user)


      const resultado =
        await model.quitarModulo(
          userId,
          Number(moduleId)
        )


      if (
        resultado.tipo ===
        "user_not_found"
      ) {
        return res
          .status(404)
          .json({
            error:
              "Usuario no encontrado"
          })
      }


      if (
        resultado.tipo ===
        "module_not_found"
      ) {
        return res
          .status(404)
          .json({
            error:
              "Modulo no encontrado"
          })
      }


      return res.json({
        ok: true,

        mensaje:
          "Permiso del modulo eliminado correctamente"
      })

    } catch (error) {
      sendError(res, error)
    }
  }
}


const controller =
  new UserAdminController()


export default {

  crearUsuario:
    controller
      .crearUsuario
      .bind(controller),

  listarUsuarios:
    controller
      .listarUsuarios
      .bind(controller),

  catalogo:
    controller
      .catalogo
      .bind(controller),

  obtenerUsuario:
    controller
      .obtenerUsuario
      .bind(controller),

  permisosUsuario:
    controller
      .permisosUsuario
      .bind(controller),

  asignarCurso:
    controller
      .asignarCurso
      .bind(controller),

  quitarCurso:
    controller
      .quitarCurso
      .bind(controller),

  asignarModulo:
    controller
      .asignarModulo
      .bind(controller),

  quitarModulo:
    controller
      .quitarModulo
      .bind(controller)
}