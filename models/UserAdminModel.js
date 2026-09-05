import { adminClient } from "../config/supabase.js"


const PROFILE_FIELDS =
  "id,email,full_name,role,empresa,activo,created_at"

const CURSO_FIELDS =
  "id,nombre,slug,descripcion,orden,activo"

const MODULO_FIELDS =
  "id,curso_id,nombre,slug,clave,descripcion,orden,activo"


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
   * Por ahora el rol interno sigue siendo "trabajador"
   * para mantener compatibilidad con las rutas antiguas.
   *
   * En la interfaz se mostrará simplemente como "Usuario".
   *
   * Más adelante migraremos definitivamente:
   *
   * trabajador -> usuario
   */
  async crearUsuario({
    email,
    password,
    fullName,
    empresa
  }) {

    const correo =
      String(
        email || ""
      )
        .trim()
        .toLowerCase()


    const nombre =
      String(
        fullName || ""
      ).trim()


    const empresaFinal =
      String(
        empresa || ""
      ).trim()


    /* ========================================================
       VALIDACIONES BASICAS
       ======================================================== */

    if (!correo) {
      throw new Error(
        "El correo es obligatorio"
      )
    }


    if (!password) {
      throw new Error(
        "La contraseña es obligatoria"
      )
    }


    if (
      String(password).length <
      8
    ) {
      throw new Error(
        "La contraseña debe tener al menos 8 caracteres"
      )
    }


    if (!nombre) {
      throw new Error(
        "El nombre completo es obligatorio"
      )
    }


    if (!empresaFinal) {
      throw new Error(
        "La empresa es obligatoria"
      )
    }


    /* ========================================================
       COMPROBAR SI YA EXISTE EN PROFILES
       ======================================================== */

    const {
      data: existente,
      error: errorExistente
    } =
      await this.db
        .from(
          "profiles"
        )
        .select(
          "id,email"
        )
        .ilike(
          "email",
          correo
        )
        .maybeSingle()


    if (errorExistente) {
      throw errorExistente
    }


    if (existente) {
      throw new Error(
        "Ese correo ya está registrado en RIMBERIO"
      )
    }


    let nuevoUsuarioId =
      null


    try {

      /* ======================================================
         CREAR CUENTA EN SUPABASE AUTH
         ====================================================== */

      const {
        data: authData,
        error: authError
      } =
        await this.db
          .auth
          .admin
          .createUser({

            email:
              correo,

            password,

            /*
             * La cuenta la crea un administrador,
             * por lo tanto no necesita pasar por
             * el proceso público de verificación.
             */
            email_confirm:
              true,

            user_metadata: {
              full_name:
                nombre
            }

          })


      if (authError) {

        if (
          authError.message
            ?.toLowerCase()
            .includes(
              "already"
            )
        ) {
          throw new Error(
            "Ese correo ya está registrado"
          )
        }


        throw authError
      }


      if (
        !authData?.user?.id
      ) {
        throw new Error(
          "Supabase no devolvió el usuario creado"
        )
      }


      nuevoUsuarioId =
        authData.user.id


      /* ======================================================
         ACTUALIZAR / CREAR PERFIL
         ====================================================== */

      /*
       * Supabase puede crear automáticamente
       * profiles mediante el trigger que ya tiene
       * el proyecto.
       *
       * Usamos UPSERT para que funcione tanto si
       * el trigger ya lo creó como si todavía no.
       */
      const {
        data: perfil,
        error: perfilError
      } =
        await this.db
          .from(
            "profiles"
          )
          .upsert(
            {
              id:
                nuevoUsuarioId,

              email:
                correo,

              full_name:
                nombre,

              /*
               * IMPORTANTE:
               *
               * Seguimos usando trabajador
               * internamente mientras existan
               * funciones antiguas que dependen
               * de ese rol.
               */
              role:
                "trabajador",

              empresa:
                empresaFinal,

              /*
               * Todo usuario creado desde
               * Administración empieza activo.
               */
              activo:
                true
            },
            {
              onConflict:
                "id"
            }
          )
          .select(
            PROFILE_FIELDS
          )
          .single()


      if (perfilError) {
        throw perfilError
      }


      /* ======================================================
         RESULTADO
         ====================================================== */

      return perfil

    } catch (error) {

      /* ======================================================
         ROLLBACK
         ====================================================== */

      /*
       * Si Auth se creó correctamente pero falló
       * profiles, eliminamos la cuenta para evitar
       * usuarios incompletos.
       */
      if (nuevoUsuarioId) {

        try {

          await this.db
            .auth
            .admin
            .deleteUser(
              nuevoUsuarioId
            )

        } catch (
          rollbackError
        ) {

          console.error(
            "No se pudo revertir el usuario:",
            rollbackError
          )

        }

      }


      throw error
    }
  }


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

    /* ========================================================
       VALIDAR ESTADO
       ======================================================== */

    if (
      typeof activo !==
      "boolean"
    ) {
      return {
        tipo:
          "invalid_state"
      }
    }


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
       PROTEGER ADMINISTRADORES
       ======================================================== */

    if (
      perfil.role ===
      "admin"
    ) {
      return {
        tipo:
          "admin_not_allowed"
      }
    }


    /* ========================================================
       ACTUALIZAR ESTADO
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

  /**
   * Sirve para que el ADMIN vea:
   *
   * Big Data
   *   ☑ Importar
   *   ☑ Analizar
   *   ☑ Comparar
   *   ...
   *
   * incluyendo los modulos que el usuario
   * aun no tiene asignados.
   */
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

  /**
   * Al quitar un curso también desactivamos
   * los permisos de sus submodulos.
   */
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


    /*
     * Obtenemos todos los modulos
     * pertenecientes al curso.
     */
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


    /*
     * Para tener un submodulo,
     * primero debe tener el curso.
     *
     * Lo asignamos automaticamente.
     */
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


    const {
      data:
        existente,
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