export const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || ""

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Sesion no valida" })
  }

  const token = header.slice(7).trim()

  if (!token) {
    return res.status(401).json({ error: "Sesion no valida" })
  }

  req.token = token
  next()
}
