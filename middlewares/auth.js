import {
  adminClient,
  userClient
} from "../config/supabase.js"

/**
 * Valida el token contra Supabase
 * y adjunta el perfil a la peticion.
 *
 * IMPORTANTE:
 * El rol siempre se obtiene desde
 * la base de datos.
 *
 * Nunca se confia en un rol enviado
 * por el frontend.
 */
export const requireAuth = async (
  req,
  res,
  next
) => {
  const header =
    req.headers.authorization || ""

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Sesion no valida"
    })
  }

  const token =
    header.slice(7).trim()

  if (!token) {
    return res.status(401).json({
      error: "Sesion no valida"
    })
  }

  try {
    const {
      data,
      error
    } = await userClient(
      token
    ).auth.getUser()

    if (
      error ||
      !data?.user
    ) {
      return res.status(401).json({
        error:
          "Sesion expirada. Vuelve a iniciar sesion"
      })
    }

    const {
      data: perfil,
      error: profileError
    } = await adminClient()
      .from("profiles")
      .select(
        "id,email,full_name,role,empresa"
      )
      .eq(
        "id",
        data.user.id
      )
      .single()

    if (
      profileError ||
      !perfil
    ) {
      return res.status(403).json({
        error:
          "El usuario no tiene un perfil asignado"
      })
    }

    /**
     * Guardamos los datos
     * autenticados dentro de req.
     */
    req.token = token
    req.user = perfil

    next()
  } catch (error) {
    console.error(
      "Error autenticando usuario:",
      error
    )

    return res.status(401).json({
      error: "Sesion no valida"
    })
  }
}

/**
 * Solo administradores.
 */
export const requireAdmin = (
  req,
  res,
  next
) => {
  if (
    req.user.role !== "admin"
  ) {
    return res.status(403).json({
      error:
        "Esta seccion es solo para administradores"
    })
  }

  next()
}

/**
 * Mantiene compatibilidad
 * con las rutas actuales
 * exclusivas para trabajadores.
 */
export const requireTrabajador = (
  req,
  res,
  next
) => {
  if (
    req.user.role !== "trabajador"
  ) {
    return res.status(403).json({
      error:
        "Esta seccion es solo para trabajadores"
    })
  }

  next()
}

/**
 * Permite crear nuevos proyectos.
 *
 * Roles permitidos:
 * - admin
 * - supervisor
 */
export const requireProjectCreator = (
  req,
  res,
  next
) => {
  const rolesPermitidos = [
    "admin",
    "supervisor"
  ]

  if (
    !rolesPermitidos.includes(
      req.user.role
    )
  ) {
    return res.status(403).json({
      error:
        "No tienes permisos para crear proyectos"
    })
  }

  next()
}

/**
 * Permite acceso a funciones
 * generales del sistema colaborativo.
 *
 * Todos los usuarios autenticados
 * excepto invitados.
 */
export const requireCollaborator = (
  req,
  res,
  next
) => {
  const rolesPermitidos = [
    "admin",
    "supervisor",
    "trabajador"
  ]

  if (
    !rolesPermitidos.includes(
      req.user.role
    )
  ) {
    return res.status(403).json({
      error:
        "No tienes permisos para realizar esta accion"
    })
  }

  next()
}