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

      const {
        email,
        password,
        full_name,
        fullName,
        empresa
      } =
        req.body || {}


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
     LISTAR USUARIOS
     ========================================================== */

  async listarUsuarios(
    req,
    res
  ) {

    try {

      const model =
        new UserAdminModel(
          req.user
        )


      const usuarios =
        await model
          .listarUsuarios()


      return res.json({
        total:
          usuarios.length,

        usuarios
      })

    } catch (error) {

      sendError(
        res,
        error
      )
    }
  }


  /* ==========================================================
     CATALOGO
     ========================================================== */

  async catalogo(
    req,
    res
  ) {

    try {

      const model =
        new UserAdminModel(
          req.user
        )


      const cursos =
        await model
          .obtenerCatalogo()


      return res.json({
        total_cursos:
          cursos.length,

        cursos
      })

    } catch (error) {

      sendError(
        res,
        error
      )
    }
  }


  /* ==========================================================
     OBTENER USUARIO
     ========================================================== */

  async obtenerUsuario(
    req,
    res
  ) {

    const userId =
      String(
        req.params.userId ||
        ""
      ).trim()


    if (
      !uuidValido(
        userId
      )
    ) {

      return res
        .status(400)
        .json({
          error:
            "Usuario no valido"
        })
    }


    try {

      const model =
        new UserAdminModel(
          req.user
        )


      const usuario =
        await model
          .obtenerUsuario(
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


      return res.json(
        usuario
      )

    } catch (error) {

      sendError(
        res,
        error
      )
    }
  }


  /* ==========================================================
     ACTUALIZAR USUARIO
     ========================================================== */

  /**
   * PATCH
   * /api/admin/users/:userId
   *
   * Permite modificar:
   *
   * - full_name
   * - empresa
   *
   * No modifica:
   *
   * - correo
   * - contraseña
   * - rol
   * - activo
   * - permisos
   */
  async actualizarUsuario(
    req,
    res
  ) {

    const userId =
      String(
        req.params.userId ||
        ""
      ).trim()


    if (
      !uuidValido(
        userId
      )
    ) {

      return res
        .status(400)
        .json({
          error:
            "Usuario no valido"
        })
    }


    const {
      full_name,
      fullName,
      empresa
    } =
      req.body || {}


    const nombre =
      String(
        full_name ||
        fullName ||
        ""
      ).trim()


    const empresaFinal =
      String(
        empresa ||
        ""
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


    if (
      nombre.length >
      150
    ) {

      return res
        .status(400)
        .json({
          error:
            "El nombre no puede superar los 150 caracteres"
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


    if (
      empresaFinal.length >
      150
    ) {

      return res
        .status(400)
        .json({
          error:
            "La empresa no puede superar los 150 caracteres"
        })
    }


    try {

      const model =
        new UserAdminModel(
          req.user
        )


      const resultado =
        await model
          .actualizarUsuario(
            userId,
            {
              fullName:
                nombre,

              empresa:
                empresaFinal
            }
          )


      /* ======================================================
         USUARIO NO EXISTE
         ====================================================== */

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


      /* ======================================================
         NOMBRE INVALIDO
         ====================================================== */

      if (
        resultado.tipo ===
        "invalid_name"
      ) {

        return res
          .status(400)
          .json({
            error:
              "El nombre completo es obligatorio"
          })
      }


      /* ======================================================
         EMPRESA INVALIDA
         ====================================================== */

      if (
        resultado.tipo ===
        "invalid_company"
      ) {

        return res
          .status(400)
          .json({
            error:
              "La empresa es obligatoria"
          })
      }


      /* ======================================================
         NOMBRE MUY LARGO
         ====================================================== */

      if (
        resultado.tipo ===
        "name_too_long"
      ) {

        return res
          .status(400)
          .json({
            error:
              "El nombre no puede superar los 150 caracteres"
          })
      }


      /* ======================================================
         EMPRESA MUY LARGA
         ====================================================== */

      if (
        resultado.tipo ===
        "company_too_long"
      ) {

        return res
          .status(400)
          .json({
            error:
              "La empresa no puede superar los 150 caracteres"
          })
      }


      /* ======================================================
         RESPUESTA
         ====================================================== */

      return res.json({

        ok:
          true,

        mensaje:
          "Usuario actualizado correctamente",

        usuario:
          resultado.usuario

      })

    } catch (error) {

      console.error(
        "Error actualizando usuario:",
        error
      )


      sendError(
        res,
        error
      )
    }
  }


  /* ==========================================================
     CAMBIAR ESTADO
     ========================================================== */

  /**
   * PATCH
   * /api/admin/users/:userId/status
   */
  async cambiarEstadoUsuario(
    req,
    res
  ) {

    const userId =
      String(
        req.params.userId ||
        ""
      ).trim()


    if (
      !uuidValido(
        userId
      )
    ) {

      return res
        .status(400)
        .json({
          error:
            "Usuario no valido"
        })
    }


    const {
      activo
    } =
      req.body || {}


    if (
      typeof activo !==
      "boolean"
    ) {

      return res
        .status(400)
        .json({
          error:
            "El estado activo debe ser true o false"
        })
    }


    try {

      const model =
        new UserAdminModel(
          req.user
        )


      const resultado =
        await model
          .cambiarEstadoUsuario(
            userId,
            activo
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
        "invalid_state"
      ) {

        return res
          .status(400)
          .json({
            error:
              "El estado del usuario no es valido"
          })
      }


      if (
        resultado.tipo ===
        "admin_not_allowed"
      ) {

        return res
          .status(403)
          .json({
            error:
              "No se puede desactivar una cuenta administradora"
          })
      }


      return res.json({

        ok:
          true,

        mensaje:
          activo
            ? "Usuario reactivado correctamente"
            : "Usuario desactivado correctamente",

        usuario:
          resultado.usuario

      })

    } catch (error) {

      sendError(
        res,
        error
      )
    }
  }


  /* ==========================================================
     PERMISOS DE UN USUARIO
     ========================================================== */

  async permisosUsuario(
    req,
    res
  ) {

    const userId =
      String(
        req.params.userId ||
        ""
      ).trim()


    if (
      !uuidValido(
        userId
      )
    ) {

      return res
        .status(400)
        .json({
          error:
            "Usuario no valido"
        })
    }


    try {

      const model =
        new UserAdminModel(
          req.user
        )


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

      sendError(
        res,
        error
      )
    }
  }


  /* ==========================================================
     ASIGNAR CURSO
     ========================================================== */

  async asignarCurso(
    req,
    res
  ) {

    const userId =
      String(
        req.params.userId ||
        ""
      ).trim()


    const courseId =
      String(
        req.params.courseId ||
        ""
      ).trim()


    if (
      !uuidValido(
        userId
      )
    ) {

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
        new UserAdminModel(
          req.user
        )


      const resultado =
        await model
          .asignarCurso(
            userId,
            Number(
              courseId
            )
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

        ok:
          true,

        mensaje:
          "Curso asignado correctamente",

        asignacion:
          resultado.asignacion

      })

    } catch (error) {

      sendError(
        res,
        error
      )
    }
  }


  /* ==========================================================
     QUITAR CURSO
     ========================================================== */

  async quitarCurso(
    req,
    res
  ) {

    const userId =
      String(
        req.params.userId ||
        ""
      ).trim()


    const courseId =
      String(
        req.params.courseId ||
        ""
      ).trim()


    if (
      !uuidValido(
        userId
      )
    ) {

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
        new UserAdminModel(
          req.user
        )


      const resultado =
        await model
          .quitarCurso(
            userId,
            Number(
              courseId
            )
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

        ok:
          true,

        mensaje:
          "Acceso al curso eliminado correctamente"

      })

    } catch (error) {

      sendError(
        res,
        error
      )
    }
  }


  /* ==========================================================
     ASIGNAR MODULO
     ========================================================== */

  async asignarModulo(
    req,
    res
  ) {

    const userId =
      String(
        req.params.userId ||
        ""
      ).trim()


    const moduleId =
      String(
        req.params.moduleId ||
        ""
      ).trim()


    if (
      !uuidValido(
        userId
      )
    ) {

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
        new UserAdminModel(
          req.user
        )


      const resultado =
        await model
          .asignarModulo(
            userId,
            Number(
              moduleId
            )
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

        ok:
          true,

        mensaje:
          "Modulo asignado correctamente",

        asignacion:
          resultado.asignacion

      })

    } catch (error) {

      sendError(
        res,
        error
      )
    }
  }


  /* ==========================================================
     QUITAR MODULO
     ========================================================== */

  async quitarModulo(
    req,
    res
  ) {

    const userId =
      String(
        req.params.userId ||
        ""
      ).trim()


    const moduleId =
      String(
        req.params.moduleId ||
        ""
      ).trim()


    if (
      !uuidValido(
        userId
      )
    ) {

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
        new UserAdminModel(
          req.user
        )


      const resultado =
        await model
          .quitarModulo(
            userId,
            Number(
              moduleId
            )
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

        ok:
          true,

        mensaje:
          "Permiso del modulo eliminado correctamente"

      })

    } catch (error) {

      sendError(
        res,
        error
      )
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

  actualizarUsuario:
    controller
      .actualizarUsuario
      .bind(controller),

  cambiarEstadoUsuario:
    controller
      .cambiarEstadoUsuario
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