import AuthModel from "../models/AuthModel.js"

const messages = {
  "Invalid login credentials": "Correo o contrasena incorrectos",
  "Email not confirmed": "Tu cuenta aun no esta verificada",
  "User already registered": "Ese correo ya esta registrado",
  "Token has expired or is invalid": "El codigo expiro o no es valido",
  "Email rate limit exceeded": "Demasiados correos enviados. Espera unos minutos",
  "For security purposes": "Espera unos segundos antes de solicitar otro codigo"
}

const translate = (text = "") => {
  const key = Object.keys(messages).find((item) => text.includes(item))
  return key ? messages[key] : "Ocurrio un error. Intenta nuevamente"
}

class AuthController {
  async register(req, res) {
    const { email, password, fullName } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: "Correo y contrasena son obligatorios" })
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "La contrasena debe tener al menos 8 caracteres" })
    }

    try {
      const model = new AuthModel()
      const data = await model.register(email, password, fullName || "")

      if (data.session) {
        return res.json({ verified: true, token: data.session.access_token, user: data.user })
      }

      res.json({ verified: false, email })
    } catch (error) {
      res.status(400).json({ error: translate(error.message) })
    }
  }

  async verify(req, res) {
    const { email, token } = req.body

    if (!email || !token) {
      return res.status(400).json({ error: "Correo y codigo son obligatorios" })
    }

    try {
      const model = new AuthModel()
      const data = await model.verify(email, token)

      res.json({ token: data.session.access_token, user: data.user })
    } catch (error) {
      res.status(400).json({ error: translate(error.message) })
    }
  }

  async resend(req, res) {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: "El correo es obligatorio" })
    }

    try {
      const model = new AuthModel()
      await model.resend(email)
      res.json({ sent: true })
    } catch (error) {
      res.status(400).json({ error: translate(error.message) })
    }
  }

  async login(req, res) {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: "Correo y contrasena son obligatorios" })
    }

    try {
      const model = new AuthModel()
      const data = await model.login(email, password)

      res.json({ token: data.session.access_token, user: data.user })
    } catch (error) {
      const pending = error.message.includes("Email not confirmed")
      res.status(400).json({ error: translate(error.message), pending })
    }
  }
}

export default new AuthController()
