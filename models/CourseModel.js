import { adminClient } from "../config/supabase.js"


const CURSO_FIELDS =
  "id,nombre,slug,descripcion,orden,activo,created_at,updated_at"

const MODULO_FIELDS =
  "id,curso_id,nombre,slug,clave,descripcion,orden,activo,created_at,updated_at"


class CourseModel {
  constructor(user) {
    this.user = user
    this.db = adminClient()
  }


  /* ==========================================================
     LISTAR CURSOS DISPONIBLES
     ========================================================== */

  /**
   * ADMIN:
   * Puede ver todos los cursos activos.
   *
   * OTROS USUARIOS:
   * Solo pueden ver los cursos que tengan asignados
   * en usuario_cursos.
   */
  async listar() {
    if (this.user.role === "admin") {
      const { data, error } = await this.db
        .from("cursos")
        .select(CURSO_FIELDS)
        .eq("activo", true)
        .order("orden", { ascending: true })
        .order("nombre", { ascending: true })

      if (error) throw error

      return this.agregarResumenModulos(data || [])
    }


    const { data: asignaciones, error: asignacionError } =
      await this.db
        .from("usuario_cursos")
        .select("curso_id")
        .eq("user_id", this.user.id)
        .eq("activo", true)

    if (asignacionError) throw asignacionError

    const cursoIds = [
      ...new Set(
        (asignaciones || [])
          .map((item) => item.curso_id)
          .filter(Boolean)
      )
    ]

    if (cursoIds.length === 0) {
      return []
    }


    const { data, error } = await this.db
      .from("cursos")
      .select(CURSO_FIELDS)
      .in("id", cursoIds)
      .eq("activo", true)
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true })

    if (error) throw error

    return this.agregarResumenModulos(data || [])
  }


  /* ==========================================================
     OBTENER CURSO
     ========================================================== */

  /**
   * Permite buscar por:
   *
   * 1
   *
   * o:
   *
   * big-data
   */
  async obtener(valor) {
    const curso = await this.buscarCurso(valor)

    if (!curso) {
      return null
    }

    const permitido =
      await this.tieneCurso(curso.id)

    if (!permitido) {
      return null
    }

    const modulos =
      await this.listarModulos(curso.id)

    return {
      ...curso,

      total_modulos:
        modulos.length,

      modulos
    }
  }


  /* ==========================================================
     LISTAR MODULOS DE UN CURSO
     ========================================================== */

  async listarModulos(cursoId) {
    /*
     * El administrador puede ver todos los
     * submodulos activos.
     */
    if (this.user.role === "admin") {
      const { data, error } = await this.db
        .from("curso_modulos")
        .select(MODULO_FIELDS)
        .eq("curso_id", cursoId)
        .eq("activo", true)
        .order("orden", { ascending: true })
        .order("nombre", { ascending: true })

      if (error) throw error

      return data || []
    }


    /*
     * Primero comprobamos que el usuario
     * tenga acceso al curso.
     */
    const accesoCurso =
      await this.tieneCurso(cursoId)

    if (!accesoCurso) {
      return []
    }


    /*
     * Obtenemos los submodulos que el
     * administrador le asigno.
     */
    const { data: permisos, error: permisoError } =
      await this.db
        .from("usuario_modulos")
        .select("modulo_id")
        .eq("user_id", this.user.id)
        .eq("activo", true)

    if (permisoError) throw permisoError


    const moduloIds = [
      ...new Set(
        (permisos || [])
          .map((item) => item.modulo_id)
          .filter(Boolean)
      )
    ]


    if (moduloIds.length === 0) {
      return []
    }


    const { data, error } = await this.db
      .from("curso_modulos")
      .select(MODULO_FIELDS)
      .eq("curso_id", cursoId)
      .in("id", moduloIds)
      .eq("activo", true)
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true })

    if (error) throw error

    return data || []
  }


  /* ==========================================================
     COMPROBAR ACCESO AL CURSO
     ========================================================== */

  async tieneCurso(cursoId) {
    /*
     * El administrador tiene acceso general.
     */
    if (this.user.role === "admin") {
      return true
    }


    const { data, error } = await this.db
      .from("usuario_cursos")
      .select("id")
      .eq("user_id", this.user.id)
      .eq("curso_id", cursoId)
      .eq("activo", true)
      .maybeSingle()

    if (error) throw error

    return Boolean(data)
  }


  /* ==========================================================
     COMPROBAR ACCESO A UN MODULO
     ========================================================== */

  /**
   * Ejemplo:
   *
   * await model.tieneModulo(
   *   "big_data.comparar"
   * )
   */
  async tieneModulo(clave) {
    /*
     * ADMIN tiene permiso total.
     */
    if (this.user.role === "admin") {
      return true
    }


    const claveNormalizada =
      String(clave || "")
        .trim()
        .toLowerCase()


    if (!claveNormalizada) {
      return false
    }


    const { data: modulo, error: moduloError } =
      await this.db
        .from("curso_modulos")
        .select(
          "id,curso_id,clave,activo"
        )
        .eq(
          "clave",
          claveNormalizada
        )
        .eq("activo", true)
        .maybeSingle()


    if (moduloError) {
      throw moduloError
    }


    if (!modulo) {
      return false
    }


    /*
     * Tener permiso al submodulo no es suficiente.
     *
     * También debe tener acceso al curso.
     */
    const accesoCurso =
      await this.tieneCurso(
        modulo.curso_id
      )


    if (!accesoCurso) {
      return false
    }


    const { data: permiso, error } =
      await this.db
        .from("usuario_modulos")
        .select("id")
        .eq(
          "user_id",
          this.user.id
        )
        .eq(
          "modulo_id",
          modulo.id
        )
        .eq("activo", true)
        .maybeSingle()


    if (error) throw error


    return Boolean(permiso)
  }


  /* ==========================================================
     OBTENER TODOS LOS PERMISOS DEL USUARIO
     ========================================================== */

  /**
   * Esta funcion sera muy importante para React.
   *
   * Devuelve algo como:
   *
   * [
   *   {
   *     nombre: "Big Data",
   *     slug: "big-data",
   *     modulos: [...]
   *   }
   * ]
   */
  async misPermisos() {
    const cursos =
      await this.listar()


    const resultado = []


    for (const curso of cursos) {
      const modulos =
        await this.listarModulos(
          curso.id
        )


      resultado.push({
        ...curso,
        total_modulos:
          modulos.length,
        modulos
      })
    }


    return resultado
  }


  /* ==========================================================
     BUSCAR CURSO
     ========================================================== */

  async buscarCurso(valor) {
    const texto =
      String(valor || "").trim()


    if (!texto) {
      return null
    }


    /*
     * Si es numero:
     *
     * /courses/1
     */
    if (/^\d+$/.test(texto)) {
      const { data, error } =
        await this.db
          .from("cursos")
          .select(CURSO_FIELDS)
          .eq("id", Number(texto))
          .eq("activo", true)
          .maybeSingle()


      if (error) throw error

      return data
    }


    /*
     * Si es texto:
     *
     * /courses/big-data
     */
    const { data, error } =
      await this.db
        .from("cursos")
        .select(CURSO_FIELDS)
        .eq(
          "slug",
          texto.toLowerCase()
        )
        .eq("activo", true)
        .maybeSingle()


    if (error) throw error


    return data
  }


  /* ==========================================================
     RESUMEN DE MODULOS
     ========================================================== */

  async agregarResumenModulos(cursos) {
    if (!cursos.length) {
      return []
    }


    const resultado = []


    for (const curso of cursos) {
      const modulos =
        await this.listarModulos(
          curso.id
        )


      resultado.push({
        ...curso,

        total_modulos:
          modulos.length,

        modulos
      })
    }


    return resultado
  }
}


export default CourseModel