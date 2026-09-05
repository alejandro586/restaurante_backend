import PasswordResetModel from "../models/PasswordResetModel.js"


/* ==========================================================
   ESTADOS VALIDOS
   ========================================================== */

const ESTADOS_VALIDOS = new Set([
  "pendiente",
  "aprobado",
  "rechazado",
  "completado",
  "vencido"
])


/* ==========================================================
   UTILIDADES
   ========================================================== */

const normalizarCorreo =
  (email) =>
    String(
      email ||
      ""
    )
      .trim()
      .toLowerCase()


const correoValido =
  (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(
        normalizarCorreo(
          email
        )
      )


const idSolicitudValido =
  (id) => {

    const numero =
      Number(
        id
      )


    return (
      Number.isInteger(
        numero
      ) &&
      numero >
        0
    )
  }


/* ==========================================================
   ERROR GENERAL
   ========================================================== */

/**
 * IMPORTANTE:
 *
 * Nunca enviamos al navegador:
 *
 * - errores internos de Supabase
 * - claves
 * - hashes
 * - PASSWORD_RESET_SECRET
 * - contraseñas
 *
 * El error real solamente queda en
 * los logs del backend.
 */
const sendError =
  (
    res,
    error,
    mensaje =
      "No se pudo procesar la recuperación de contraseña"
  ) => {

    console.error(
      "PasswordResetController:",
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
   CONTROLADOR
   ========================================================== */

class PasswordResetController {

  /* ========================================================
     PUBLICO
     SOLICITAR RECUPERACION
     ======================================================== */

  /**
   * POST
   * /api/password-reset/request
   *
   * NO requiere iniciar sesión.
   *
   * Body:
   *
   * {
   *   "email": "usuario@correo.com"
   * }
   *
   * IMPORTANTE:
   *
   * La respuesta NO confirma si el correo
   * existe realmente.
   */
  async solicitar(
    req,
    res
  ) {

    const correo =
      normalizarCorreo(
        req.body?.email
      )


    /* ======================================================
       VALIDACION DEL FORMATO
       ====================================================== */

    if (
      !correo ||
      !correoValido(
        correo
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
            "Ingresa un correo electrónico válido"
        })
    }


    try {

      const model =
        new PasswordResetModel()


      await model
        .solicitarRecuperacion(
          correo
        )


      /*
       * RESPUESTA NEUTRA.
       *
       * No utilizamos:
       *
       * resultado.solicitud_creada
       *
       * porque hacerlo revelaría si el
       * correo pertenece a una cuenta.
       */
      return res.json({
        ok:
          true,

        mensaje:
          "Si el correo pertenece a una cuenta de RIMBERIO, la solicitud de recuperación será procesada por un administrador."
      })

    } catch (
      error
    ) {

      return sendError(
        res,
        error,
        "No se pudo enviar la solicitud de recuperación"
      )
    }
  }


  /* ========================================================
     ADMIN
     LISTAR SOLICITUDES
     ======================================================== */

  /**
   * GET
   * /api/admin/password-resets
   *
   * Requiere:
   *
   * requireAuth
   * requireAdmin
   *
   * Opcional:
   *
   * ?estado=pendiente
   */
  async listar(
    req,
    res
  ) {

    const estado =
      String(
        req.query?.estado ||
        ""
      )
        .trim()
        .toLowerCase()


    /* ======================================================
       VALIDAR FILTRO
       ====================================================== */

    if (
      estado &&
      !ESTADOS_VALIDOS.has(
        estado
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
            "Estado de recuperación no válido"
        })
    }


    try {

      const model =
        new PasswordResetModel()


      const solicitudes =
        await model
          .listarSolicitudes({
            estado:
              estado ||
              null
          })


      return res.json({
        ok:
          true,

        total:
          solicitudes.length,

        solicitudes
      })

    } catch (
      error
    ) {

      return sendError(
        res,
        error,
        "No se pudieron cargar las solicitudes de recuperación"
      )
    }
  }


  /* ========================================================
     ADMIN
     APROBAR SOLICITUD
     ======================================================== */

  /**
   * POST
   * /api/admin/password-resets/:id/approve
   *
   * El administrador NO elige
   * la contraseña.
   *
   * Solamente autoriza.
   *
   * RIMBERIO genera el código temporal.
   */
  async aprobar(
    req,
    res
  ) {

    const solicitudId =
      String(
        req.params?.id ||
        ""
      ).trim()


    /* ======================================================
       VALIDAR ID
       ====================================================== */

    if (
      !idSolicitudValido(
        solicitudId
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
            "Solicitud no válida"
        })
    }


    /* ======================================================
       ADMIN AUTENTICADO
       ====================================================== */

    const adminId =
      req.user?.id


    if (
      !adminId
    ) {

      return res
        .status(
          401
        )
        .json({
          ok:
            false,

          error:
            "Sesión no válida"
        })
    }


    try {

      const model =
        new PasswordResetModel()


      const resultado =
        await model
          .aprobarSolicitud(
            solicitudId,
            adminId
          )


      /* ====================================================
         SOLICITUD NO ENCONTRADA
         ==================================================== */

      if (
        resultado.tipo ===
        "not_found"
      ) {

        return res
          .status(
            404
          )
          .json({
            ok:
              false,

            error:
              "Solicitud de recuperación no encontrada"
          })
      }


      /* ====================================================
         ID INVALIDO
         ==================================================== */

      if (
        resultado.tipo ===
        "invalid_id"
      ) {

        return res
          .status(
            400
          )
          .json({
            ok:
              false,

            error:
              "Solicitud no válida"
          })
      }


      /* ====================================================
         YA APROBADA
         ==================================================== */

      if (
        resultado.tipo ===
        "already_approved"
      ) {

        return res
          .status(
            409
          )
          .json({
            ok:
              false,

            error:
              "Esta solicitud ya fue aprobada"
          })
      }


      /* ====================================================
         ESTADO NO PERMITE APROBACION
         ==================================================== */

      if (
        resultado.tipo ===
        "invalid_state"
      ) {

        return res
          .status(
            409
          )
          .json({
            ok:
              false,

            error:
              `La solicitud ya se encuentra en estado "${resultado.estado}"`
          })
      }


      /* ====================================================
         USUARIO YA NO EXISTE
         ==================================================== */

      if (
        resultado.tipo ===
        "user_not_found"
      ) {

        return res
          .status(
            404
          )
          .json({
            ok:
              false,

            error:
              "El usuario asociado ya no existe"
          })
      }


      /* ====================================================
         CAMBIO SIMULTANEO
         ==================================================== */

      if (
        resultado.tipo ===
        "state_changed"
      ) {

        return res
          .status(
            409
          )
          .json({
            ok:
              false,

            error:
              "La solicitud cambió de estado. Actualiza la lista e inténtalo nuevamente."
          })
      }


      /* ====================================================
         ERROR INESPERADO DEL MODELO
         ==================================================== */

      if (
        resultado.tipo !==
        "ok"
      ) {

        return res
          .status(
            400
          )
          .json({
            ok:
              false,

            error:
              "No se pudo aprobar la solicitud"
          })
      }


      /* ====================================================
         RESPUESTA
         ==================================================== */

      /*
       * IMPORTANTE:
       *
       * El código real se devuelve únicamente
       * en esta respuesta.
       *
       * No está almacenado en texto plano
       * en Supabase.
       */
      return res.json({
        ok:
          true,

        mensaje:
          "Solicitud aprobada correctamente",

        solicitud:
          resultado.solicitud,

        codigo:
          resultado.codigo,

        vence_en_minutos:
          resultado.vence_en_minutos,

        advertencia:
          "Copia este código ahora. Se mostrará únicamente al aprobar la recuperación."
      })

    } catch (
      error
    ) {

      return sendError(
        res,
        error,
        "No se pudo aprobar la recuperación"
      )
    }
  }


  /* ========================================================
     ADMIN
     RECHAZAR SOLICITUD
     ======================================================== */

  /**
   * POST
   * /api/admin/password-resets/:id/reject
   *
   * Puede rechazar:
   *
   * pendiente
   * aprobado
   *
   * Si estaba aprobado también se
   * invalida el código inmediatamente.
   */
  async rechazar(
    req,
    res
  ) {

    const solicitudId =
      String(
        req.params?.id ||
        ""
      ).trim()


    if (
      !idSolicitudValido(
        solicitudId
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
            "Solicitud no válida"
        })
    }


    const adminId =
      req.user?.id


    if (
      !adminId
    ) {

      return res
        .status(
          401
        )
        .json({
          ok:
            false,

          error:
            "Sesión no válida"
        })
    }


    try {

      const model =
        new PasswordResetModel()


      const resultado =
        await model
          .rechazarSolicitud(
            solicitudId,
            adminId
          )


      /* ====================================================
         NO ENCONTRADA
         ==================================================== */

      if (
        resultado.tipo ===
        "not_found"
      ) {

        return res
          .status(
            404
          )
          .json({
            ok:
              false,

            error:
              "Solicitud de recuperación no encontrada"
          })
      }


      /* ====================================================
         ID INVALIDO
         ==================================================== */

      if (
        resultado.tipo ===
        "invalid_id"
      ) {

        return res
          .status(
            400
          )
          .json({
            ok:
              false,

            error:
              "Solicitud no válida"
          })
      }


      /* ====================================================
         ESTADO INVALIDO
         ==================================================== */

      if (
        resultado.tipo ===
        "invalid_state"
      ) {

        return res
          .status(
            409
          )
          .json({
            ok:
              false,

            error:
              `La solicitud ya se encuentra en estado "${resultado.estado}"`
          })
      }


      /* ====================================================
         CAMBIO SIMULTANEO
         ==================================================== */

      if (
        resultado.tipo ===
        "state_changed"
      ) {

        return res
          .status(
            409
          )
          .json({
            ok:
              false,

            error:
              "La solicitud cambió de estado. Actualiza la lista e inténtalo nuevamente."
          })
      }


      if (
        resultado.tipo !==
        "ok"
      ) {

        return res
          .status(
            400
          )
          .json({
            ok:
              false,

            error:
              "No se pudo rechazar la solicitud"
          })
      }


      /* ====================================================
         RESPUESTA
         ==================================================== */

      return res.json({
        ok:
          true,

        mensaje:
          "Solicitud rechazada correctamente",

        solicitud:
          resultado.solicitud
      })

    } catch (
      error
    ) {

      return sendError(
        res,
        error,
        "No se pudo rechazar la recuperación"
      )
    }
  }


  /* ========================================================
     PUBLICO
     COMPLETAR RECUPERACION
     ======================================================== */

  /**
   * POST
   * /api/password-reset/complete
   *
   * NO requiere sesión.
   *
   * Body:
   *
   * {
   *   "email": "usuario@correo.com",
   *   "codigo": "482913",
   *   "password": "NuevaClave123",
   *   "password_confirm": "NuevaClave123"
   * }
   */
  async completar(
    req,
    res
  ) {

    const correo =
      normalizarCorreo(
        req.body?.email
      )


    const codigo =
      String(
        req.body?.codigo ||
        ""
      ).trim()


    const password =
      String(
        req.body?.password ||
        ""
      )


    /*
     * Permitimos ambos nombres para que
     * el frontend pueda usar:
     *
     * password_confirm
     *
     * o:
     *
     * passwordConfirm
     */
    const passwordConfirm =
      String(
        req.body?.password_confirm ??
        req.body?.passwordConfirm ??
        ""
      )


    /* ======================================================
       VALIDACIONES BASICAS
       ====================================================== */

    if (
      !correo ||
      !correoValido(
        correo
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
            "Ingresa un correo electrónico válido"
        })
    }


    if (
      !codigo
    ) {

      return res
        .status(
          400
        )
        .json({
          ok:
            false,

          error:
            "Ingresa el código de recuperación"
        })
    }


    if (
      !/^\d{6}$/
        .test(
          codigo
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
            "El código debe contener exactamente 6 números"
        })
    }


    if (
      !password
    ) {

      return res
        .status(
          400
        )
        .json({
          ok:
            false,

          error:
            "Ingresa la nueva contraseña"
        })
    }


    if (
      password.length <
      8
    ) {

      return res
        .status(
          400
        )
        .json({
          ok:
            false,

          error:
            "La nueva contraseña debe tener al menos 8 caracteres"
        })
    }


    if (
      password.length >
      128
    ) {

      return res
        .status(
          400
        )
        .json({
          ok:
            false,

          error:
            "La nueva contraseña es demasiado larga"
        })
    }


    if (
      !passwordConfirm
    ) {

      return res
        .status(
          400
        )
        .json({
          ok:
            false,

          error:
            "Confirma la nueva contraseña"
        })
    }


    if (
      password !==
      passwordConfirm
    ) {

      return res
        .status(
          400
        )
        .json({
          ok:
            false,

          error:
            "Las contraseñas no coinciden"
        })
    }


    try {

      const model =
        new PasswordResetModel()


      const resultado =
        await model
          .completarRecuperacion({
            email:
              correo,

            codigo,

            password
          })


      /* ====================================================
         CORREO INVALIDO
         ==================================================== */

      if (
        resultado.tipo ===
        "invalid_email"
      ) {

        return res
          .status(
            400
          )
          .json({
            ok:
              false,

            error:
              "Ingresa un correo electrónico válido"
          })
      }


      /* ====================================================
         FORMATO DE CODIGO
         ==================================================== */

      if (
        resultado.tipo ===
        "invalid_code_format"
      ) {

        return res
          .status(
            400
          )
          .json({
            ok:
              false,

            error:
              "El código debe contener exactamente 6 números"
          })
      }


      /* ====================================================
         PASSWORD CORTA
         ==================================================== */

      if (
        resultado.tipo ===
        "password_too_short"
      ) {

        return res
          .status(
            400
          )
          .json({
            ok:
              false,

            error:
              "La nueva contraseña debe tener al menos 8 caracteres"
          })
      }


      /* ====================================================
         PASSWORD LARGA
         ==================================================== */

      if (
        resultado.tipo ===
        "password_too_long"
      ) {

        return res
          .status(
            400
          )
          .json({
            ok:
              false,

            error:
              "La nueva contraseña es demasiado larga"
          })
      }


      /* ====================================================
         SOLICITUD INEXISTENTE O VENCIDA
         ==================================================== */

      if (
        resultado.tipo ===
        "invalid_or_expired"
      ) {

        return res
          .status(
            400
          )
          .json({
            ok:
              false,

            error:
              "El código no es válido, no está autorizado o ya venció"
          })
      }


      /* ====================================================
         CODIGO INCORRECTO
         ==================================================== */

      if (
        resultado.tipo ===
        "invalid_code"
      ) {

        return res
          .status(
            400
          )
          .json({
            ok:
              false,

            error:
              "El código de recuperación es incorrecto",

            intentos_restantes:
              resultado.intentos_restantes
          })
      }


      /* ====================================================
         MAXIMO DE INTENTOS
         ==================================================== */

      if (
        resultado.tipo ===
        "max_attempts"
      ) {

        return res
          .status(
            429
          )
          .json({
            ok:
              false,

            error:
              "Se alcanzó el máximo de intentos. Debes solicitar una nueva recuperación.",

            intentos_restantes:
              0
          })
      }


      /* ====================================================
         CODIGO YA UTILIZADO
         ==================================================== */

      if (
        resultado.tipo ===
        "already_used"
      ) {

        return res
          .status(
            409
          )
          .json({
            ok:
              false,

            error:
              "Esta autorización ya fue utilizada"
          })
      }


      /* ====================================================
         RESULTADO DESCONOCIDO
         ==================================================== */

      if (
        resultado.tipo !==
        "ok"
      ) {

        return res
          .status(
            400
          )
          .json({
            ok:
              false,

            error:
              "No se pudo completar la recuperación"
          })
      }


      /* ====================================================
         CONTRASEÑA CAMBIADA
         ==================================================== */

      /*
       * No devolvemos:
       *
       * user_id
       * contraseña
       * token
       *
       * El usuario debe volver al login
       * e iniciar sesión normalmente.
       */
      return res.json({
        ok:
          true,

        mensaje:
          "Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña."
      })

    } catch (
      error
    ) {

      return sendError(
        res,
        error,
        "No se pudo cambiar la contraseña"
      )
    }
  }
}


/* ==========================================================
   EXPORTAR INSTANCIA
   ========================================================== */

export default new PasswordResetController()