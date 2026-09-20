import AccountActivationModel from "../models/AccountActivationModel.js"
import { sendError } from "../utils/apiError.js"

/* ==========================================================
   MAPEO DE ERRORES DEL MODELO
   ========================================================== */

const responderErrorModelo = (res, resultado) => {
  switch (resultado?.tipo) {
    case "invalid_token":
      res.status(404).json({
        error: "El enlace de activación no es válido"
      })
      return true

    case "already_used":
      res.status(409).json({
        error: "Este enlace de activación ya fue utilizado"
      })
      return true

    case "expired":
      res.status(410).json({
        error: "Este enlace de activación ha vencido"
      })
      return true

    case "password_too_short":
      res.status(400).json({
        error: "La contraseña debe tener al menos 8 caracteres"
      })
      return true

    case "password_too_long":
      res.status(400).json({
        error: "La contraseña es demasiado larga"
      })
      return true

    case "password_mismatch":
      res.status(400).json({
        error: "Las contraseñas no coinciden"
      })
      return true

    default:
      return false
  }
}

/* ==========================================================
   CONTROLLER
   ========================================================== */

class AccountActivationController {
  /**
   * GET /api/activation/:token
   *
   * Público. Muestra el correo asignado antes
   * de pedir la contraseña.
   */
  async obtenerPublica(req, res) {
    const token = String(req.params.token || "").trim()

    if (token.length < 20) {
      return res.status(400).json({
        error: "Enlace de activación no válido"
      })
    }

    try {
      const model = new AccountActivationModel()
      const resultado = await model.obtenerPorToken(token)

      if (responderErrorModelo(res, resultado)) {
        return
      }

      res.json({ email: resultado.email })
    } catch (error) {
      console.error("Error consultando activación:", error)
      sendError(res, error)
    }
  }

  /**
   * POST /api/activation/:token/complete
   *
   * Público. Fija la contraseña elegida por
   * el empleado y activa la cuenta.
   */
  async completar(req, res) {
    const token = String(req.params.token || "").trim()

    if (token.length < 20) {
      return res.status(400).json({
        error: "Enlace de activación no válido"
      })
    }

    const password = String(req.body?.password ?? "")
    const passwordConfirm = String(
      req.body?.password_confirm ?? req.body?.passwordConfirm ?? ""
    )

    try {
      const model = new AccountActivationModel()
      const resultado = await model.completar({
        token,
        password,
        passwordConfirm
      })

      if (responderErrorModelo(res, resultado)) {
        return
      }

      res.json({
        ok: true,
        mensaje:
          "Cuenta activada correctamente. Ya puedes iniciar sesión."
      })
    } catch (error) {
      console.error("Error completando activación:", error)
      sendError(res, error)
    }
  }
}

const controller = new AccountActivationController()

export default {
  obtenerPublica: controller.obtenerPublica.bind(controller),
  completar: controller.completar.bind(controller)
}