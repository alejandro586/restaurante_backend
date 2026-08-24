const isAuthError = (error) => {
  const message = error.message || ""
  const code = error.code || ""

  return (
    code === "PGRST301" ||
    code === "42501" ||
    message.includes("JWT") ||
    message.includes("Invalid API key") ||
    message.includes("token is expired")
  )
}

export const sendError = (res, error) => {
  if (isAuthError(error)) {
    return res.status(401).json({ error: "Sesion expirada. Vuelve a iniciar sesion" })
  }

  if (error.code === "23505") {
    return res.status(409).json({ error: "Ese registro ya existe" })
  }

  if (error.code === "23503") {
    return res.status(409).json({ error: "El registro relacionado no existe" })
  }

  return res.status(500).json({ error: "No se pudo completar la operacion" })
}
