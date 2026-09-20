import { adminClient } from "../config/supabase.js"
import crypto from "node:crypto"
import AccountActivationModel from "./AccountActivationModel.js"
import MailService from "../services/MailService.js"


const PROFILE_FIELDS =
  "id,email,full_name,role,empresa,activo,created_at"

const CURSO_FIELDS =
  "id,nombre,slug,descripcion,orden,activo"

const MODULO_FIELDS =
  "id,curso_id,nombre,slug,clave,descripcion,orden,activo"

const DOMINIO_EMPRESA = String(process.env.EMPRESA_DOMINIO || "").trim().toLowerCase()

class UserAdminModel {
  constructor(adminUser) {
    this.adminUser = adminUser
    this.db = adminClient()
  }


  /* ==========================================================
     CREAR USUARIO
     ========================================================== */

  /**
   * Crea una cuenta nueva desde el panel administrativo.
   *
   * El administrador define:
   *
   * - nombre
   * - correo
   * - contraseña temporal
   * - empresa
   *
   * El rol normal definitivo del ERP es "usuario".
   * El rol "admin" queda reservado para administradores.
   */
async crearUsuario({ correoAcceso, correoPersonal, fullName, empresa }) {
  const acceso = String(correoAcceso || "").trim().toLowerCase()
  const personal = String(correoPersonal || "").trim().toLowerCase()
  const nombre = String(fullName || "").trim()
  const empresaFinal = String(empresa || "").trim()

  if (!acceso) {
    throw new Error("El correo de acceso es obligatorio")
  }

  if (DOMINIO_EMPRESA && !acceso.endsWith(`@${DOMINIO_EMPRESA}`)) {
    throw new Error(`El correo de acceso debe pertenecer al dominio @${DOMINIO_EMPRESA}`)
  }

  if (!personal) {
    throw new Error("El correo personal es obligatorio")
  }

  if (!nombre) {
    throw new Error("El nombre completo es obligatorio")
  }

  if (!empresaFinal) {
    throw new Error("La empresa es obligatoria")
  }

  const { data: existente, error: errorExistente } = await this.db
    .from("profiles")
    .select("id,email")
    .ilike("email", acceso)
    .maybeSingle()

  if (errorExistente) {
    throw errorExistente
  }

  if (existente) {
    throw new Error("Ese correo de acceso ya está registrado en RIMBERIO")
  }

  let nuevoUsuarioId = null

  try {
    const { data: authData, error: authError } = await this.db.auth.admin.createUser({
      email: acceso,
      password: crypto.randomBytes(24).toString("hex"),
      email_confirm: true,
      user_metadata: { full_name: nombre }
    })

    if (authError) {
      if (authError.message?.toLowerCase().includes("already")) {
        throw new Error("Ese correo de acceso ya está registrado")
      }
      throw authError
    }

    if (!authData?.user?.id) {
      throw new Error("Supabase no devolvió el usuario creado")
    }

    nuevoUsuarioId = authData.user.id

    const { data: perfil, error: perfilError } = await this.db
      .from("profiles")
      .upsert(
        {
          id: nuevoUsuarioId,
          email: acceso,
          usuario: acceso,
          full_name: nombre,
          role: "trabajador",
          empresa: empresaFinal,
          activo: false
        },
        { onConflict: "id" }
      )
      .select(PROFILE_FIELDS)
      .single()

    if (perfilError) {
      throw perfilError
    }

    const activacionModel = new AccountActivationModel()
    const { token } = await activacionModel.crear({
      userId: nuevoUsuarioId,
      email: personal
    })

    await MailService.enviarActivacion({ email: personal, nombre, token })

    return perfil
  } catch (error) {
    if (nuevoUsuarioId) {
      try {
        await this.db.auth.admin.deleteUser(nuevoUsuarioId)
      } catch (rollbackError) {
        console.error("No se pudo revertir el usuario:", rollbackError)
      }
    }

    throw error
  }
}
////////////////////////////////////////////////////////////////////////////////////////////

  /* ==========================================================
     LISTAR USUARIOS
     ========================================================== */

  async listarUsuarios() {
    const {
      data,
      error
    } =
      await this.db
        .from(
          "profiles"
        )
        .select(
          PROFILE_FIELDS
        )
        .order(
          "created_at",
          {
            ascending:
              false
          }
        )


    if (error) {
      throw error
    }


    return data || []
  }


  /* ==========================================================
     OBTENER USUARIO
     ========================================================== */

  async obtenerUsuario(
    userId
  ) {
    const perfil =
      await this.buscarPerfil(
        userId
      )


    if (!perfil) {
      return null
    }


    const permisos =
      await this
        .obtenerPermisosUsuario(
          userId
        )


    return {
      ...perfil,
      permisos
    }
  }


  /* ==========================================================
     ACTUALIZAR USUARIO
     ========================================================== */

  /**
   * Modifica únicamente los datos administrativos
   * básicos del perfil.
   *
   * Se puede modificar:
   *
   * - nombre completo
   * - empresa
   *
   * NO modifica:
   *
   * - correo
   * - contraseña
   * - rol
   * - estado activo
   * - cursos
   * - módulos
   * - permisos
   * - CSV
   * - proyectos
   * - historial
   *
   * IMPORTANTE:
   *
   * Cambiar la empresa puede cambiar qué datasets
   * internos compartidos puede consultar el usuario,
   * ya que los CSV propios se comparten por empresa.
   */
  async actualizarUsuario(
    userId,
    {
      fullName,
      empresa
    }
  ) {

    /* ========================================================
       BUSCAR USUARIO
       ======================================================== */

    const perfil =
      await this.buscarPerfil(
        userId
      )


    if (!perfil) {
      return {
        tipo:
          "user_not_found"
      }
    }


    /* ========================================================
       NORMALIZAR DATOS
       ======================================================== */

    const nombre =
      String(
        fullName || ""
      ).trim()


    const empresaFinal =
      String(
        empresa || ""
      ).trim()


    /* ========================================================
       VALIDAR NOMBRE
       ======================================================== */

    if (!nombre) {
      return {
        tipo:
          "invalid_name"
      }
    }


    /* ========================================================
       VALIDAR EMPRESA
       ======================================================== */

    if (!empresaFinal) {
      return {
        tipo:
          "invalid_company"
      }
    }


    /* ========================================================
       EVITAR VALORES EXCESIVAMENTE GRANDES
       ======================================================== */

    if (
      nombre.length >
      150
    ) {
      return {
        tipo:
          "name_too_long"
      }
    }


    if (
      empresaFinal.length >
      150
    ) {
      return {
        tipo:
          "company_too_long"
      }
    }


    /* ========================================================
       ACTUALIZAR PERFIL
       ======================================================== */

    const {
      data,
      error
    } =
      await this.db
        .from(
          "profiles"
        )
        .update({
          full_name:
            nombre,

          empresa:
            empresaFinal
        })
        .eq(
          "id",
          userId
        )
        .select(
          PROFILE_FIELDS
        )
        .single()


    if (error) {
      throw error
    }


    /* ========================================================
       RESULTADO
       ======================================================== */

    return {
      tipo:
        "ok",

      usuario:
        data
    }
  }


  /* ==========================================================
     CAMBIAR ESTADO DEL USUARIO
     ========================================================== */

  /**
   * Activa o desactiva un usuario.
   *
   * IMPORTANTE:
   *
   * Esta función NO elimina:
   *
   * - la cuenta de Supabase Auth
   * - cursos
   * - permisos
   * - CSV
   * - datos
   * - proyectos
   * - historial
   *
   * Solamente modifica:
   *
   * profiles.activo
   *
   * true  = puede utilizar RIMBERIO
   * false = el backend bloquea su acceso
   *
   * Los administradores no pueden ser
   * desactivados mediante esta función.
   */
  async cambiarEstadoUsuario(
    userId,
    activo
  ) {

    if (
      typeof activo !==
      "boolean"
    ) {
      return {
        tipo:
          "invalid_state"
      }
    }


    const perfil =
      await this.buscarPerfil(
        userId
      )


    if (!perfil) {
      return {
        tipo:
          "user_not_found"
      }
    }


    if (
      perfil.role ===
      "admin"
    ) {
      return {
        tipo:
          "admin_not_allowed"
      }
    }


    const {
      data,
      error
    } =
      await this.db
        .from(
          "profiles"
        )
        .update({
          activo
        })
        .eq(
          "id",
          userId
        )
        .select(
          PROFILE_FIELDS
        )
        .single()


    if (error) {
      throw error
    }


    return {
      tipo:
        "ok",

      usuario:
        data
    }
  }


  /* ==========================================================
     PERMISOS COMPLETOS DE UN USUARIO
     ========================================================== */

  async obtenerPermisosUsuario(
    userId
  ) {
    const perfil =
      await this.buscarPerfil(
        userId
      )


    if (!perfil) {
      return null
    }


    const {
      data:
        cursosAsignados,
      error:
        cursosError
    } =
      await this.db
        .from(
          "usuario_cursos"
        )
        .select(
          "id,user_id,curso_id,activo,asignado_por,created_at,updated_at"
        )
        .eq(
          "user_id",
          userId
        )
        .eq(
          "activo",
          true
        )


    if (cursosError) {
      throw cursosError
    }


    const {
      data:
        modulosAsignados,
      error:
        modulosError
    } =
      await this.db
        .from(
          "usuario_modulos"
        )
        .select(
          "id,user_id,modulo_id,activo,asignado_por,created_at,updated_at"
        )
        .eq(
          "user_id",
          userId
        )
        .eq(
          "activo",
          true
        )


    if (modulosError) {
      throw modulosError
    }


    const cursoIds =
      [
        ...new Set(
          (
            cursosAsignados ||
            []
          )
            .map(
              (item) =>
                item.curso_id
            )
            .filter(
              Boolean
            )
        )
      ]


    const moduloIds =
      [
        ...new Set(
          (
            modulosAsignados ||
            []
          )
            .map(
              (item) =>
                item.modulo_id
            )
            .filter(
              Boolean
            )
        )
      ]


    let cursos = []


    if (
      cursoIds.length >
      0
    ) {
      const {
        data,
        error
      } =
        await this.db
          .from(
            "cursos"
          )
          .select(
            CURSO_FIELDS
          )
          .in(
            "id",
            cursoIds
          )
          .order(
            "orden",
            {
              ascending:
                true
            }
          )


      if (error) {
        throw error
      }


      cursos =
        data || []
    }


    let modulos = []


    if (
      moduloIds.length >
      0
    ) {
      const {
        data,
        error
      } =
        await this.db
          .from(
            "curso_modulos"
          )
          .select(
            MODULO_FIELDS
          )
          .in(
            "id",
            moduloIds
          )
          .order(
            "orden",
            {
              ascending:
                true
            }
          )


      if (error) {
        throw error
      }


      modulos =
        data || []
    }


    const modulosPorCurso =
      new Map()


    for (
      const modulo
      of modulos
    ) {

      if (
        !modulosPorCurso
          .has(
            modulo.curso_id
          )
      ) {

        modulosPorCurso
          .set(
            modulo.curso_id,
            []
          )
      }


      modulosPorCurso
        .get(
          modulo.curso_id
        )
        .push(
          modulo
        )
    }


    return {
      cursos:
        cursos.map(
          (curso) => ({
            ...curso,

            modulos:
              modulosPorCurso.get(
                curso.id
              ) || []
          })
        )
    }
  }


  /* ==========================================================
     CATALOGO COMPLETO
     ========================================================== */

  async obtenerCatalogo() {

    const {
      data:
        cursos,
      error:
        cursosError
    } =
      await this.db
        .from(
          "cursos"
        )
        .select(
          CURSO_FIELDS
        )
        .eq(
          "activo",
          true
        )
        .order(
          "orden",
          {
            ascending:
              true
          }
        )


    if (cursosError) {
      throw cursosError
    }


    const {
      data:
        modulos,
      error:
        modulosError
    } =
      await this.db
        .from(
          "curso_modulos"
        )
        .select(
          MODULO_FIELDS
        )
        .eq(
          "activo",
          true
        )
        .order(
          "orden",
          {
            ascending:
              true
          }
        )


    if (modulosError) {
      throw modulosError
    }


    const porCurso =
      new Map()


    for (
      const modulo
      of modulos || []
    ) {

      if (
        !porCurso.has(
          modulo.curso_id
        )
      ) {

        porCurso.set(
          modulo.curso_id,
          []
        )
      }


      porCurso
        .get(
          modulo.curso_id
        )
        .push(
          modulo
        )
    }


    return (
      cursos || []
    ).map(
      (curso) => ({
        ...curso,

        modulos:
          porCurso.get(
            curso.id
          ) || []
      })
    )
  }


  /* ==========================================================
     ASIGNAR CURSO
     ========================================================== */

  async asignarCurso(
    userId,
    cursoId
  ) {
    const perfil =
      await this.buscarPerfil(
        userId
      )


    if (!perfil) {
      return {
        tipo:
          "user_not_found"
      }
    }


    const curso =
      await this.buscarCurso(
        cursoId
      )


    if (!curso) {
      return {
        tipo:
          "course_not_found"
      }
    }


    const {
      data:
        existente,
      error:
        buscarError
    } =
      await this.db
        .from(
          "usuario_cursos"
        )
        .select(
          "id,activo"
        )
        .eq(
          "user_id",
          userId
        )
        .eq(
          "curso_id",
          cursoId
        )
        .maybeSingle()


    if (buscarError) {
      throw buscarError
    }


    if (existente) {

      const {
        data,
        error
      } =
        await this.db
          .from(
            "usuario_cursos"
          )
          .update({
            activo:
              true,

            asignado_por:
              this.adminUser.id
          })
          .eq(
            "id",
            existente.id
          )
          .select()
          .single()


      if (error) {
        throw error
      }


      return {
        tipo:
          "ok",

        asignacion:
          data
      }
    }


    const {
      data,
      error
    } =
      await this.db
        .from(
          "usuario_cursos"
        )
        .insert({
          user_id:
            userId,

          curso_id:
            cursoId,

          activo:
            true,

          asignado_por:
            this.adminUser.id
        })
        .select()
        .single()


    if (error) {
      throw error
    }


    return {
      tipo:
        "ok",

      asignacion:
        data
    }
  }


  /* ==========================================================
     QUITAR CURSO
     ========================================================== */

  async quitarCurso(
    userId,
    cursoId
  ) {
    const perfil =
      await this.buscarPerfil(
        userId
      )


    if (!perfil) {
      return {
        tipo:
          "user_not_found"
      }
    }


    const curso =
      await this.buscarCurso(
        cursoId
      )


    if (!curso) {
      return {
        tipo:
          "course_not_found"
      }
    }


    const {
      error
    } =
      await this.db
        .from(
          "usuario_cursos"
        )
        .update({
          activo:
            false
        })
        .eq(
          "user_id",
          userId
        )
        .eq(
          "curso_id",
          cursoId
        )


    if (error) {
      throw error
    }


    const {
      data:
        modulos,
      error:
        modulosError
    } =
      await this.db
        .from(
          "curso_modulos"
        )
        .select(
          "id"
        )
        .eq(
          "curso_id",
          cursoId
        )


    if (modulosError) {
      throw modulosError
    }


    const moduloIds =
      (
        modulos || []
      ).map(
        (item) =>
          item.id
      )


    if (
      moduloIds.length >
      0
    ) {

      const {
        error:
          permisosError
      } =
        await this.db
          .from(
            "usuario_modulos"
          )
          .update({
            activo:
              false
          })
          .eq(
            "user_id",
            userId
          )
          .in(
            "modulo_id",
            moduloIds
          )


      if (permisosError) {
        throw permisosError
      }
    }


    return {
      tipo:
        "ok"
    }
  }


  /* ==========================================================
     ASIGNAR MODULO
     ========================================================== */

  async asignarModulo(
    userId,
    moduloId
  ) {

    const perfil =
      await this.buscarPerfil(
        userId
      )


    if (!perfil) {
      return {
        tipo:
          "user_not_found"
      }
    }


    const modulo =
      await this.buscarModulo(
        moduloId
      )


    if (!modulo) {
      return {
        tipo:
          "module_not_found"
      }
    }


    const {
      data:
        cursosAnteriores,
      error:
        cursoAnteriorError
    } =
      await this.db
        .from(
          "usuario_cursos"
        )
        .select(
          "id,activo"
        )
        .eq(
          "user_id",
          userId
        )
        .eq(
          "curso_id",
          modulo.curso_id
        )
        .order(
          "id",
          {
            ascending:
              true
          }
        )
        .limit(
          1
        )


    if (
      cursoAnteriorError
    ) {
      throw cursoAnteriorError
    }


    const cursoAnterior =
      Array.isArray(
        cursosAnteriores
      )
        ? cursosAnteriores[0] ||
          null
        : null


    const cursoYaEstabaActivo =
      cursoAnterior?.activo ===
      true


    const cursoResultado =
      await this.asignarCurso(
        userId,
        modulo.curso_id
      )


    if (
      cursoResultado.tipo !==
      "ok"
    ) {
      return cursoResultado
    }


    try {

      const {
        data:
          permisosExistentes,
        error:
          buscarError
      } =
        await this.db
          .from(
            "usuario_modulos"
          )
          .select(
            "id,activo"
          )
          .eq(
            "user_id",
            userId
          )
          .eq(
            "modulo_id",
            moduloId
          )
          .order(
            "id",
            {
              ascending:
                true
            }
          )
          .limit(
            1
          )


      if (
        buscarError
      ) {
        throw buscarError
      }


      const existente =
        Array.isArray(
          permisosExistentes
        )
          ? permisosExistentes[0] ||
            null
          : null


      let asignacion =
        null


      if (
        existente
      ) {

        const {
          data,
          error
        } =
          await this.db
            .from(
              "usuario_modulos"
            )
            .update({
              activo:
                true,

              asignado_por:
                this.adminUser.id
            })
            .eq(
              "id",
              existente.id
            )
            .select(
              "id,user_id,modulo_id,activo,asignado_por,created_at,updated_at"
            )
            .single()


        if (
          error
        ) {
          throw error
        }


        asignacion =
          data

      } else {

        const {
          data,
          error
        } =
          await this.db
            .from(
              "usuario_modulos"
            )
            .insert({
              user_id:
                userId,

              modulo_id:
                moduloId,

              activo:
                true,

              asignado_por:
                this.adminUser.id
            })
            .select(
              "id,user_id,modulo_id,activo,asignado_por,created_at,updated_at"
            )
            .single()


        if (
          error
        ) {
          throw error
        }


        asignacion =
          data
      }


      const {
        data:
          verificacion,
        error:
          verificarError
      } =
        await this.db
          .from(
            "usuario_modulos"
          )
          .select(
            "id,user_id,modulo_id,activo,asignado_por,created_at,updated_at"
          )
          .eq(
            "user_id",
            userId
          )
          .eq(
            "modulo_id",
            moduloId
          )
          .eq(
            "activo",
            true
          )
          .order(
            "id",
            {
              ascending:
                true
            }
          )
          .limit(
            1
          )


      if (
        verificarError
      ) {
        throw verificarError
      }


      const permisoConfirmado =
        Array.isArray(
          verificacion
        )
          ? verificacion[0] ||
            null
          : null


      if (
        !permisoConfirmado
      ) {
        throw new Error(
          "El permiso del módulo no pudo confirmarse en usuario_modulos"
        )
      }


      return {
        tipo:
          "ok",

        asignacion:
          permisoConfirmado ||
          asignacion,

        curso_id:
          modulo.curso_id,

        modulo_id:
          modulo.id,

        clave:
          modulo.clave
      }

    } catch (
      error
    ) {

      if (
        !cursoYaEstabaActivo
      ) {

        try {

          await this.db
            .from(
              "usuario_cursos"
            )
            .update({
              activo:
                false
            })
            .eq(
              "user_id",
              userId
            )
            .eq(
              "curso_id",
              modulo.curso_id
            )

        } catch (
          rollbackError
        ) {

          console.error(
            "No se pudo revertir el curso después del fallo del módulo:",
            rollbackError
          )
        }
      }


      console.error(
        "Error asignando módulo:",
        {
          userId,
          moduloId,
          cursoId:
            modulo.curso_id,
          error
        }
      )


      throw error
    }
  }


  /* ==========================================================
     QUITAR MODULO
     ========================================================== */

  async quitarModulo(
    userId,
    moduloId
  ) {
    const perfil =
      await this.buscarPerfil(
        userId
      )


    if (!perfil) {
      return {
        tipo:
          "user_not_found"
      }
    }


    const modulo =
      await this.buscarModulo(
        moduloId
      )


    if (!modulo) {
      return {
        tipo:
          "module_not_found"
      }
    }


    const {
      error
    } =
      await this.db
        .from(
          "usuario_modulos"
        )
        .update({
          activo:
            false
        })
        .eq(
          "user_id",
          userId
        )
        .eq(
          "modulo_id",
          moduloId
        )


    if (error) {
      throw error
    }


    return {
      tipo:
        "ok"
    }
  }


  /* ==========================================================
     BUSCAR PERFIL
     ========================================================== */

  async buscarPerfil(
    userId
  ) {
    const {
      data,
      error
    } =
      await this.db
        .from(
          "profiles"
        )
        .select(
          PROFILE_FIELDS
        )
        .eq(
          "id",
          userId
        )
        .maybeSingle()


    if (error) {
      throw error
    }


    return data
  }


  /* ==========================================================
     BUSCAR CURSO
     ========================================================== */

  async buscarCurso(
    cursoId
  ) {
    const {
      data,
      error
    } =
      await this.db
        .from(
          "cursos"
        )
        .select(
          CURSO_FIELDS
        )
        .eq(
          "id",
          cursoId
        )
        .eq(
          "activo",
          true
        )
        .maybeSingle()


    if (error) {
      throw error
    }


    return data
  }


  /* ==========================================================
     BUSCAR MODULO
     ========================================================== */

  async buscarModulo(
    moduloId
  ) {
    const {
      data,
      error
    } =
      await this.db
        .from(
          "curso_modulos"
        )
        .select(
          MODULO_FIELDS
        )
        .eq(
          "id",
          moduloId
        )
        .eq(
          "activo",
          true
        )
        .maybeSingle()


    if (error) {
      throw error
    }


    return data
  }
}


export default UserAdminModel