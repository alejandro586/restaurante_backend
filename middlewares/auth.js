import {
  adminClient,
  userClient
} from "../config/supabase.js"


/* ==========================================================
   AUTENTICACION
   ========================================================== */

/**
 * Valida el token contra Supabase
 * y adjunta el perfil real a req.user.
 *
 * Nunca confiamos en un role o user_id
 * enviado desde el frontend.
 */
export const requireAuth =
  async (
    req,
    res,
    next
  ) => {

    const header =
      req.headers.authorization || ""


    if (
      !header.startsWith(
        "Bearer "
      )
    ) {

      return res
        .status(401)
        .json({
          error:
            "Sesion no valida"
        })
    }


    const token =
      header
        .slice(7)
        .trim()


    if (!token) {

      return res
        .status(401)
        .json({
          error:
            "Sesion no valida"
        })
    }


    try {

      /* ====================================================
         VALIDAR TOKEN
         ==================================================== */

      const {
        data,
        error
      } =
        await userClient(
          token
        )
          .auth
          .getUser()


      if (
        error ||
        !data.user
      ) {

        return res
          .status(401)
          .json({
            error:
              "Sesion expirada. Vuelve a iniciar sesion"
          })
      }


      /* ====================================================
         CARGAR PERFIL REAL
         ==================================================== */

      const {
        data: perfil,
        error:
          profileError
      } =
        await adminClient()
          .from(
            "profiles"
          )
          .select(
            "id,email,full_name,role,empresa,activo"
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

        return res
          .status(403)
          .json({
            error:
              "El usuario no tiene un perfil asignado"
          })
      }


      /* ====================================================
         USUARIO ACTIVO / DESACTIVADO
         ==================================================== */

      if (
        perfil.activo ===
        false
      ) {

        return res
          .status(403)
          .json({
            error:
              "Tu cuenta está desactivada. Contacta con un administrador."
          })
      }


      /* ====================================================
         NORMALIZAR ROL
         ==================================================== */

      perfil.role =
        String(
          perfil.role ||
          ""
        )
          .trim()
          .toLowerCase()


      /* ====================================================
         SESION VALIDA
         ==================================================== */

      req.token =
        token

      req.user =
        perfil


      next()

    } catch (
      error
    ) {

      console.error(
        "Error validando sesion:",
        error
      )


      return res
        .status(401)
        .json({
          error:
            "Sesion no valida"
        })
    }
  }


/* ==========================================================
   ADMINISTRADOR
   ========================================================== */

export const requireAdmin =
  (
    req,
    res,
    next
  ) => {

    if (
      req.user?.role !==
      "admin"
    ) {

      return res
        .status(403)
        .json({
          error:
            "Esta seccion es solo para administradores"
        })
    }


    next()
  }


/* ==========================================================
   USUARIO NORMAL
   ========================================================== */

/**
 * Rol definitivo visible en RIMBERIO:
 *
 * - admin
 * - usuario
 *
 * Durante la transición también aceptamos
 * "trabajador" para mantener funcionando
 * las cuentas antiguas.
 */
export const requireUsuario =
  (
    req,
    res,
    next
  ) => {

    const rol =
      String(
        req.user?.role ||
        ""
      )
        .trim()
        .toLowerCase()


    if (
      ![
        "usuario",
        "trabajador"
      ].includes(
        rol
      )
    ) {

      return res
        .status(403)
        .json({
          error:
            "Esta seccion es solo para usuarios"
        })
    }


    next()
  }


/* ==========================================================
   COMPATIBILIDAD CON SISTEMA ANTIGUO
   ========================================================== */

/**
 * Algunas rutas antiguas todavía importan:
 *
 * requireTrabajador
 *
 * No eliminamos el nombre todavía porque
 * rompería esas rutas.
 *
 * Internamente utiliza requireUsuario().
 */
export const requireTrabajador =
  (
    req,
    res,
    next
  ) => {

    return requireUsuario(
      req,
      res,
      next
    )
  }


/* ==========================================================
   CREACION DE PROYECTOS
   ========================================================== */

/**
 * El sistema final utiliza:
 *
 * - admin
 * - usuario
 *
 * trabajador y supervisor continúan
 * aceptándose temporalmente para no romper
 * módulos antiguos del proyecto.
 */
export const requireProjectCreator =
  (
    req,
    res,
    next
  ) => {

    const rol =
      String(
        req.user?.role ||
        ""
      )
        .trim()
        .toLowerCase()


    if (
      ![
        "admin",
        "usuario",
        "trabajador",
        "supervisor"
      ].includes(
        rol
      )
    ) {

      return res
        .status(403)
        .json({
          error:
            "No tienes permisos para crear proyectos"
        })
    }


    next()
  }


/* ==========================================================
   NORMALIZAR CLAVES
   ========================================================== */

const normalizarClaves =
  (
    claves
  ) => {

    return [
      ...new Set(
        claves
          .flat()
          .map(
            (
              clave
            ) =>
              String(
                clave ||
                ""
              ).trim()
          )
          .filter(
            Boolean
          )
      )
    ]
  }


/* ==========================================================
   COMPROBAR PERMISOS DE MODULO
   ========================================================== */

/**
 * Comprueba si el usuario tiene
 * al menos UNO de los módulos recibidos.
 *
 * Ejemplo:
 *
 * requireAnyModulePermission(
 *   "big_data.analisis",
 *   "big_data.comparar",
 *   "big_data.graficos"
 * )
 *
 *
 * ADMIN:
 * siempre tiene acceso.
 *
 * USUARIO:
 * necesita:
 *
 * 1. curso activo
 * 2. asignacion activa al curso
 * 3. modulo activo
 * 4. asignacion activa al modulo
 */
export const requireAnyModulePermission =
  (
    ...permisosSolicitados
  ) => {

    const claves =
      normalizarClaves(
        permisosSolicitados
      )


    return async (
      req,
      res,
      next
    ) => {

      /* ====================================================
         VALIDACION INTERNA
         ==================================================== */

      if (
        claves.length ===
        0
      ) {

        return res
          .status(500)
          .json({
            error:
              "La ruta no tiene permisos configurados correctamente"
          })
      }


      /* ====================================================
         ADMINISTRADOR
         ==================================================== */

      if (
        req.user?.role ===
        "admin"
      ) {

        return next()
      }


      /* ====================================================
         USUARIO AUTENTICADO
         ==================================================== */

      const userId =
        req.user?.id


      if (!userId) {

        return res
          .status(401)
          .json({
            error:
              "Sesion no valida"
          })
      }


      try {

        const supabase =
          adminClient()


        /* ==================================================
           1. BUSCAR MODULOS
           ================================================== */

        const {
          data:
            modulos,
          error:
            modulosError
        } =
          await supabase
            .from(
              "curso_modulos"
            )
            .select(
              "id,curso_id,nombre,clave,activo"
            )
            .in(
              "clave",
              claves
            )
            .eq(
              "activo",
              true
            )


        if (
          modulosError
        ) {

          throw modulosError
        }


        if (
          !modulos ||
          modulos.length ===
          0
        ) {

          return res
            .status(403)
            .json({
              error:
                "No tienes permiso para acceder a este modulo"
            })
        }


        /* ==================================================
           IDS
           ================================================== */

        const moduleIds =
          modulos.map(
            (
              modulo
            ) =>
              modulo.id
          )


        const courseIds =
          [
            ...new Set(
              modulos.map(
                (
                  modulo
                ) =>
                  modulo.curso_id
              )
            )
          ]


        /* ==================================================
           2. COMPROBAR CURSO ACTIVO
           ================================================== */

        const {
          data:
            cursos,
          error:
            cursosError
        } =
          await supabase
            .from(
              "cursos"
            )
            .select(
              "id,activo"
            )
            .in(
              "id",
              courseIds
            )
            .eq(
              "activo",
              true
            )


        if (
          cursosError
        ) {

          throw cursosError
        }


        const cursosActivos =
          new Set(
            (
              cursos ||
              []
            ).map(
              (
                curso
              ) =>
                Number(
                  curso.id
                )
            )
          )


        if (
          cursosActivos.size ===
          0
        ) {

          return res
            .status(403)
            .json({
              error:
                "No tienes acceso al curso de este modulo"
            })
        }


        /* ==================================================
           3. ASIGNACION DEL USUARIO AL CURSO
           ================================================== */

        const {
          data:
            asignacionesCurso,
          error:
            cursosUsuarioError
        } =
          await supabase
            .from(
              "usuario_cursos"
            )
            .select(
              "curso_id,activo"
            )
            .eq(
              "user_id",
              userId
            )
            .in(
              "curso_id",
              [
                ...cursosActivos
              ]
            )
            .eq(
              "activo",
              true
            )


        if (
          cursosUsuarioError
        ) {

          throw cursosUsuarioError
        }


        const cursosPermitidos =
          new Set(
            (
              asignacionesCurso ||
              []
            ).map(
              (
                asignacion
              ) =>
                Number(
                  asignacion
                    .curso_id
                )
            )
          )


        if (
          cursosPermitidos.size ===
          0
        ) {

          return res
            .status(403)
            .json({
              error:
                "No tienes acceso a este curso"
            })
        }


        /* ==================================================
           4. ASIGNACION DEL USUARIO AL MODULO
           ================================================== */

        const {
          data:
            asignacionesModulo,
          error:
            modulosUsuarioError
        } =
          await supabase
            .from(
              "usuario_modulos"
            )
            .select(
              "modulo_id,activo"
            )
            .eq(
              "user_id",
              userId
            )
            .in(
              "modulo_id",
              moduleIds
            )
            .eq(
              "activo",
              true
            )


        if (
          modulosUsuarioError
        ) {

          throw modulosUsuarioError
        }


        const modulosPermitidos =
          new Set(
            (
              asignacionesModulo ||
              []
            ).map(
              (
                asignacion
              ) =>
                Number(
                  asignacion
                    .modulo_id
                )
            )
          )


        /* ==================================================
           5. ENCONTRAR PERMISO COMPLETO
           ================================================== */

        const moduloPermitido =
          modulos.find(
            (
              modulo
            ) =>
              cursosPermitidos.has(
                Number(
                  modulo.curso_id
                )
              ) &&
              modulosPermitidos.has(
                Number(
                  modulo.id
                )
              )
          )


        if (
          !moduloPermitido
        ) {

          return res
            .status(403)
            .json({
              error:
                "No tienes permiso para acceder a este modulo"
            })
        }


        /* ==================================================
           GUARDAR INFORMACION DEL PERMISO
           ================================================== */

        req.modulePermission = {

          id:
            moduloPermitido.id,

          course_id:
            moduloPermitido
              .curso_id,

          clave:
            moduloPermitido
              .clave,

          nombre:
            moduloPermitido
              .nombre
        }


        next()

      } catch (
        error
      ) {

        console.error(
          "Error comprobando permiso de modulo:",
          error
        )


        return res
          .status(500)
          .json({
            error:
              "No se pudo comprobar el permiso del usuario"
          })
      }
    }
  }


/* ==========================================================
   COMPROBAR UN SOLO MODULO
   ========================================================== */

/**
 * Forma simplificada cuando una ruta
 * necesita exactamente un permiso.
 *
 * Ejemplo:
 *
 * router.post(
 *   "/...",
 *   requireAuth,
 *   requireModulePermission(
 *     "big_data.importar"
 *   ),
 *   controlador
 * )
 */
export const requireModulePermission =
  (
    clave
  ) =>
    requireAnyModulePermission(
      clave
    )