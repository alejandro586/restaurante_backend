import { adminClient, userClient } from "../config/supabase.js"

/**
 * Valida el token contra Supabase y adjunta el perfil a la peticion.
 * El rol se lee siempre de la base, nunca de lo que manda el cliente:
 * de otro modo bastaria editar el localStorage para ser administrador.
 */
export const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization || ""

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Sesion no valida" })
  }

  const token = header.slice(7).trim()

  if (!token) {
    return res.status(401).json({ error: "Sesion no valida" })
  }

  try {
    const { data, error } = await userClient(token).auth.getUser()

    if (error || !data.user) {
      return res.status(401).json({ error: "Sesion expirada. Vuelve a iniciar sesion" })
    }

    const { data: perfil } = await adminClient()
      .from("profiles")
      .select("id,email,full_name,role,empresa")
      .eq("id", data.user.id)
      .single()

    if (!perfil) {
      return res.status(403).json({ error: "El usuario no tiene un perfil asignado" })
    }

    req.token = token
    req.user = perfil
    next()
  } catch (error) {
    res.status(401).json({ error: "Sesion no valida" })
  }
}

export const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Esta seccion es solo para administradores" })
  }
  next()
}

export const requireTrabajador = (req, res, next) => {
  if (req.user.role !== "trabajador") {
    return res.status(403).json({ error: "Esta seccion es solo para trabajadores" })
  }
  next()
}
