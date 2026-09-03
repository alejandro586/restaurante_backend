import crypto from "crypto"

import ProjectInvitationModel from "../models/ProjectInvitationModel.js"
import MailService from "../services/MailService.js"

import {
  sendError
} from "../utils/apiError.js"


/* ==========================================================
   CONFIGURACION
   ========================================================== */

const ROLES_INVITABLES = [
  "manager",
  "developer",
  "member",
  "viewer"
]

const DIAS_EXPIRACION = 7


/* ==========================================================
   UTILIDADES
   ========================================================== */

/**
 * Comprueba IDs numericos.
 */
const idValido = (
  valor
) => {
  return /^\d+$/.test(
    String(
      valor || ""
    )
  )
}


/**
 * Normaliza un correo.
 */
const normalizarEmail = (
  valor
) => {
  return String(
    valor || ""
  )
    .trim()
    .toLowerCase()
}


/**
 * Validacion sencilla de email.
 */
const emailValido = (
  email
) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  )
}


/**
 * Genera un token criptograficamente
 * seguro para la invitacion.
 *
 * Este token SI se envia por correo,
 * pero NO se guarda directamente
 * en Supabase.
 */
const generarToken = () => {
  return crypto
    .randomBytes(32)
    .toString("base64url")
}


/**
 * Calcula la fecha de expiracion.
 */
const generarExpiracion = () => {
  const fecha =
    new Date()

  fecha.setDate(
    fecha.getDate() +
      DIAS_EXPIRACION
  )

  return fecha.toISOString()
}


/**
 * Convierte los errores internos
 * del modelo en respuestas HTTP.
 */
const responderErrorModelo = (
  res,
  resultado
) => {
  switch (
    resultado?.tipo
  ) {
    case "not_found":
      res
        .status(404)
        .json({
          error:
            "Proyecto no encontrado"
        })

      return true

    case "project_not_found":
      res
        .status(404)
        .json({
          error:
            "El proyecto de esta invitacion ya no existe"
        })

      return true

    case "forbidden":
      res
        .status(403)
        .json({
          error:
            "No tienes permisos para administrar las invitaciones de este proyecto"
        })

      return true

    case "already_member":
      res
        .status(409)
        .json({
          error:
            "Este usuario ya pertenece al proyecto"
        })

      return true

    case "already_invited":
      res
        .status(409)
        .json({
          error:
            "Ya existe una invitacion pendiente para este correo"
        })

      return true

    case "invalid_token":
      res
        .status(404)
        .json({
          error:
            "La invitacion no existe o el enlace no es valido"
        })

      return true

    case "already_accepted":
      res
        .status(409)
        .json({
          error:
            "Esta invitacion ya fue aceptada"
        })

      return true

    case "not_pending":
      res
        .status(409)
        .json({
          error:
            "Esta invitacion ya no esta disponible"
        })

      return true

    case "expired":
      res
        .status(410)
        .json({
          error:
            "Esta invitacion ha expirado"
        })

      return true

    case "wrong_email":
      res
        .status(403)
        .json({
          error:
            "Debes iniciar sesion con el correo al que fue enviada la invitacion",

          expected_email:
            resultado.expected_email ||
            undefined
        })

      return true

    case "unauthenticated":
      res
        .status(401)
        .json({
          error:
            "Debes iniciar sesion para aceptar esta invitacion"
        })

      return true

    case "invitation_not_found":
      res
        .status(404)
        .json({
          error:
            "Invitacion no encontrada"
        })

      return true

    default:
      return false
  }
}


/* ==========================================================
   CONTROLLER
   ========================================================== */

class ProjectInvitationController {

  /**
   * GET
   * /api/projects/:id/invitations
   *
   * Lista las invitaciones del proyecto.
   */
  async listar(
    req,
    res
  ) {
    if (
      !idValido(
        req.params.id
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Proyecto no valido"
        })
    }

    try {
      const model =
        new ProjectInvitationModel(
          req.user
        )

      const resultado =
        await model.listar(
          Number(
            req.params.id
          )
        )

      if (
        responderErrorModelo(
          res,
          resultado
        )
      ) {
        return
      }

      res.json(
        resultado.invitaciones
      )
    } catch (error) {
      console.error(
        "Error listando invitaciones:",
        error
      )

      sendError(
        res,
        error
      )
    }
  }


  /**
   * POST
   * /api/projects/:id/invitations
   *
   * Genera la invitacion,
   * la almacena y envia el correo.
   */
  async crear(
    req,
    res
  ) {
    const projectId =
      req.params.id

    if (
      !idValido(
        projectId
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Proyecto no valido"
        })
    }

    const email =
      normalizarEmail(
        req.body.email
      )

    const role =
      String(
        req.body.role ||
        "member"
      ).trim()

    if (
      !email ||
      !emailValido(
        email
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Ingresa un correo electronico valido"
        })
    }

    if (
      !ROLES_INVITABLES.includes(
        role
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "El rol seleccionado no es valido"
        })
    }

    /**
     * Evitamos que el usuario
     * se invite a si mismo.
     */
    if (
      normalizarEmail(
        req.user.email
      ) === email
    ) {
      return res
        .status(400)
        .json({
          error:
            "No puedes enviarte una invitacion a ti mismo"
        })
    }

    const token =
      generarToken()

    const expiresAt =
      generarExpiracion()

    try {
      const model =
        new ProjectInvitationModel(
          req.user
        )

      /**
       * Guardamos solamente
       * el hash del token.
       */
      const tokenHash =
        model.hashToken(
          token
        )

      const resultado =
        await model.crear(
          Number(
            projectId
          ),
          {
            email,
            role,
            tokenHash,
            expiresAt
          }
        )

      if (
        responderErrorModelo(
          res,
          resultado
        )
      ) {
        return
      }

      /*
       * Enviamos el correo.
       *
       * req.user ya contiene:
       * - id
       * - email
       * - full_name
       * - role
       * - empresa
       */
      try {
        const correo =
          await MailService.enviarInvitacion({
            email,

            token,

            proyecto:
              resultado.proyecto,

            invitador:
              req.user,

            role,

            expiresAt
          })

        return res
          .status(201)
          .json({
            enviado: true,

            invitacion:
              resultado.invitacion,

            correo: {
              email:
                correo.email,

              messageId:
                correo.messageId
            }
          })
      } catch (
        mailError
      ) {
        console.error(
          "La invitacion se creo, pero el correo no pudo enviarse:",
          mailError
        )

        /**
         * Si el correo falla,
         * revocamos automaticamente
         * la invitacion.
         *
         * Asi no dejamos una
         * invitacion pendiente que
         * nunca llego al usuario.
         */
        try {
          await model.revocar(
            Number(
              projectId
            ),
            resultado
              .invitacion
              .id
          )
        } catch (
          rollbackError
        ) {
          console.error(
            "No se pudo revocar la invitacion despues del error de correo:",
            rollbackError
          )
        }

        return res
          .status(502)
          .json({
            error:
              "La invitacion no pudo enviarse por correo. Revisa la configuracion SMTP."
          })
      }

    } catch (error) {
      console.error(
        "Error creando invitacion:",
        error
      )

      sendError(
        res,
        error
      )
    }
  }


  /**
   * GET
   * /api/invitations/:token
   *
   * Endpoint publico.
   *
   * Permite mostrar informacion
   * basica de la invitacion antes
   * de iniciar sesion.
   */
  async obtenerPublica(
    req,
    res
  ) {
    const token =
      String(
        req.params.token ||
        ""
      ).trim()

    if (
      token.length < 20
    ) {
      return res
        .status(400)
        .json({
          error:
            "Enlace de invitacion no valido"
        })
    }

    try {
      /**
       * No necesita usuario
       * autenticado.
       */
      const model =
        new ProjectInvitationModel()

      const resultado =
        await model.obtenerPorToken(
          token
        )

      if (
        responderErrorModelo(
          res,
          resultado
        )
      ) {
        return
      }

      res.json({
        invitacion:
          resultado.invitacion,

        proyecto:
          resultado.proyecto,

        invitador:
          resultado.invitador
      })

    } catch (error) {
      console.error(
        "Error consultando invitacion:",
        error
      )

      sendError(
        res,
        error
      )
    }
  }


  /**
   * POST
   * /api/invitations/:token/accept
   *
   * El usuario autenticado acepta
   * la invitacion.
   */
  async aceptar(
    req,
    res
  ) {
    const token =
      String(
        req.params.token ||
        ""
      ).trim()

    if (
      token.length < 20
    ) {
      return res
        .status(400)
        .json({
          error:
            "Enlace de invitacion no valido"
        })
    }

    try {
      const model =
        new ProjectInvitationModel(
          req.user
        )

      const resultado =
        await model.aceptar(
          token
        )

      if (
        responderErrorModelo(
          res,
          resultado
        )
      ) {
        return
      }

      res.json({
        aceptada: true,

        project_id:
          resultado.project_id,

        role:
          resultado.role,

        proyecto:
          resultado.proyecto
      })

    } catch (error) {
      console.error(
        "Error aceptando invitacion:",
        error
      )

      sendError(
        res,
        error
      )
    }
  }


  /**
   * POST
   * /api/invitations/:token/reject
   *
   * Permite rechazar una invitacion.
   */
  async rechazar(
    req,
    res
  ) {
    const token =
      String(
        req.params.token ||
        ""
      ).trim()

    if (
      token.length < 20
    ) {
      return res
        .status(400)
        .json({
          error:
            "Enlace de invitacion no valido"
        })
    }

    try {
      const model =
        new ProjectInvitationModel(
          req.user
        )

      const resultado =
        await model.rechazar(
          token
        )

      if (
        responderErrorModelo(
          res,
          resultado
        )
      ) {
        return
      }

      res.json({
        rechazada: true
      })

    } catch (error) {
      console.error(
        "Error rechazando invitacion:",
        error
      )

      sendError(
        res,
        error
      )
    }
  }


  /**
   * DELETE
   * /api/projects/:id/invitations/:invitationId
   *
   * Revoca una invitacion pendiente.
   */
  async revocar(
    req,
    res
  ) {
    const {
      id,
      invitationId
    } = req.params

    if (
      !idValido(id) ||
      !idValido(
        invitationId
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Proyecto o invitacion no validos"
        })
    }

    try {
      const model =
        new ProjectInvitationModel(
          req.user
        )

      const resultado =
        await model.revocar(
          Number(id),
          Number(
            invitationId
          )
        )

      if (
        responderErrorModelo(
          res,
          resultado
        )
      ) {
        return
      }

      res.json({
        revocada: true
      })

    } catch (error) {
      console.error(
        "Error revocando invitacion:",
        error
      )

      sendError(
        res,
        error
      )
    }
  }


  /**
   * GET
   * /api/mail/health
   *
   * Lo usaremos para comprobar
   * que Gmail SMTP funciona.
   *
   * Esta ruta debe protegerse
   * como administrador.
   */
  async verificarCorreo(
    req,
    res
  ) {
    try {
      await MailService
        .verificarConexion()

      res.json({
        status: "ok",
        mail: "connected"
      })

    } catch (error) {
      console.error(
        "Error SMTP:",
        error
      )

      res
        .status(500)
        .json({
          status: "error",

          error:
            error.message ||
            "No se pudo conectar al servidor de correo"
        })
    }
  }
}


const controller =
  new ProjectInvitationController()


export default {
  listar:
    controller.listar.bind(
      controller
    ),

  crear:
    controller.crear.bind(
      controller
    ),

  obtenerPublica:
    controller.obtenerPublica.bind(
      controller
    ),

  aceptar:
    controller.aceptar.bind(
      controller
    ),

  rechazar:
    controller.rechazar.bind(
      controller
    ),

  revocar:
    controller.revocar.bind(
      controller
    ),

  verificarCorreo:
    controller.verificarCorreo.bind(
      controller
    )
}