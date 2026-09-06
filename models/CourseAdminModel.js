import {
  adminClient
} from "../config/supabase.js"


/* ==========================================================
   CAMPOS
   ========================================================== */

const CURSO_FIELDS =
  "id,nombre,slug,descripcion,orden,activo"

const MODULO_FIELDS =
  "id,curso_id,nombre,slug,clave,descripcion,orden,activo"


/* ==========================================================
   NORMALIZAR TEXTO
   ========================================================== */

const limpiarTexto = (
  valor
) =>
  String(
    valor ?? ""
  ).trim()


/* ==========================================================
   NORMALIZAR SLUG
   ========================================================== */

const crearSlug = (
  valor
) => {

  return limpiarTexto(
    valor
  )
    .normalize(
      "NFD"
    )
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    )
}


/* ==========================================================
   NORMALIZAR CLAVE DE PERMISO
   ========================================================== */

const crearParteClave = (
  valor
) => {

  return crearSlug(
    valor
  )
    .replace(
      /-/g,
      "_"
    )
}


/* ==========================================================
   ENTERO
   ========================================================== */

const enteroSeguro = (
  valor,
  respaldo = 0
) => {

  const numero =
    Number(
      valor
    )


  if (
    !Number.isFinite(
      numero
    )
  ) {

    return respaldo
  }


  return Math.max(
    0,
    Math.trunc(
      numero
    )
  )
}


/* ==========================================================
   BOOLEANO
   ========================================================== */

const booleanoSeguro = (
  valor,
  respaldo = true
) => {

  if (
    typeof valor ===
    "boolean"
  ) {

    return valor
  }


  return respaldo
}


/* ==========================================================
   MODELO
   ========================================================== */

class CourseAdminModel {

  constructor(
    adminUser
  ) {

    this.adminUser =
      adminUser

    this.db =
      adminClient()
  }


  /* ========================================================
     LISTAR CATALOGO COMPLETO
     ======================================================== */

  /*
   * A diferencia del catálogo usado para permisos,
   * este método NO filtra activo=true.
   *
   * El administrador necesita ver:
   *
   * - cursos activos
   * - cursos desactivados
   * - módulos activos
   * - módulos desactivados
   */

  async listarCatalogoCompleto() {

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
        .order(
          "orden",
          {
            ascending:
              true
          }
        )
        .order(
          "id",
          {
            ascending:
              true
          }
        )


    if (
      cursosError
    ) {

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
        .order(
          "orden",
          {
            ascending:
              true
          }
        )
        .order(
          "id",
          {
            ascending:
              true
          }
        )


    if (
      modulosError
    ) {

      throw modulosError
    }


    const modulosPorCurso =
      new Map()


    for (
      const modulo
      of modulos || []
    ) {

      const cursoId =
        String(
          modulo.curso_id
        )


      if (
        !modulosPorCurso.has(
          cursoId
        )
      ) {

        modulosPorCurso.set(
          cursoId,
          []
        )
      }


      modulosPorCurso
        .get(
          cursoId
        )
        .push(
          modulo
        )
    }


    return (
      cursos || []
    ).map(
      (
        curso
      ) => ({

        ...curso,

        modulos:
          modulosPorCurso.get(
            String(
              curso.id
            )
          ) || []

      })
    )
  }


  /* ========================================================
     BUSCAR CURSO
     ======================================================== */

  async buscarCurso(
    cursoId
  ) {

    const id =
      Number(
        cursoId
      )


    if (
      !Number.isInteger(
        id
      ) ||
      id <= 0
    ) {

      return null
    }


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
          id
        )
        .maybeSingle()


    if (
      error
    ) {

      throw error
    }


    return data
  }


  /* ========================================================
     BUSCAR MODULO
     ======================================================== */

  async buscarModulo(
    moduloId
  ) {

    const id =
      Number(
        moduloId
      )


    if (
      !Number.isInteger(
        id
      ) ||
      id <= 0
    ) {

      return null
    }


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
          id
        )
        .maybeSingle()


    if (
      error
    ) {

      throw error
    }


    return data
  }


  /* ========================================================
     SIGUIENTE ORDEN DE CURSO
     ======================================================== */

  async siguienteOrdenCurso() {

    const {
      data,
      error
    } =
      await this.db
        .from(
          "cursos"
        )
        .select(
          "orden"
        )
        .order(
          "orden",
          {
            ascending:
              false
          }
        )
        .limit(
          1
        )


    if (
      error
    ) {

      throw error
    }


    const ultimo =
      Array.isArray(
        data
      ) &&
      data.length > 0
        ? Number(
            data[0]?.orden || 0
          )
        : 0


    return ultimo + 1
  }


  /* ========================================================
     SIGUIENTE ORDEN DE MODULO
     ======================================================== */

  async siguienteOrdenModulo(
    cursoId
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
          "orden"
        )
        .eq(
          "curso_id",
          cursoId
        )
        .order(
          "orden",
          {
            ascending:
              false
          }
        )
        .limit(
          1
        )


    if (
      error
    ) {

      throw error
    }


    const ultimo =
      Array.isArray(
        data
      ) &&
      data.length > 0
        ? Number(
            data[0]?.orden || 0
          )
        : 0


    return ultimo + 1
  }


  /* ========================================================
     COMPROBAR SLUG DE CURSO
     ======================================================== */

  async comprobarSlugCurso(
    slug,
    ignorarId = null
  ) {

    let consulta =
      this.db
        .from(
          "cursos"
        )
        .select(
          "id,slug"
        )
        .eq(
          "slug",
          slug
        )


    if (
      ignorarId
    ) {

      consulta =
        consulta.neq(
          "id",
          ignorarId
        )
    }


    const {
      data,
      error
    } =
      await consulta
        .limit(
          1
        )


    if (
      error
    ) {

      throw error
    }


    return (
      data || []
    ).length > 0
  }


  /* ========================================================
     COMPROBAR SLUG DE MODULO
     ======================================================== */

  async comprobarSlugModulo(
    cursoId,
    slug,
    ignorarId = null
  ) {

    let consulta =
      this.db
        .from(
          "curso_modulos"
        )
        .select(
          "id,slug"
        )
        .eq(
          "curso_id",
          cursoId
        )
        .eq(
          "slug",
          slug
        )


    if (
      ignorarId
    ) {

      consulta =
        consulta.neq(
          "id",
          ignorarId
        )
    }


    const {
      data,
      error
    } =
      await consulta
        .limit(
          1
        )


    if (
      error
    ) {

      throw error
    }


    return (
      data || []
    ).length > 0
  }


  /* ========================================================
     COMPROBAR CLAVE DE MODULO
     ======================================================== */

  async comprobarClaveModulo(
    clave,
    ignorarId = null
  ) {

    let consulta =
      this.db
        .from(
          "curso_modulos"
        )
        .select(
          "id,clave"
        )
        .eq(
          "clave",
          clave
        )


    if (
      ignorarId
    ) {

      consulta =
        consulta.neq(
          "id",
          ignorarId
        )
    }


    const {
      data,
      error
    } =
      await consulta
        .limit(
          1
        )


    if (
      error
    ) {

      throw error
    }


    return (
      data || []
    ).length > 0
  }


  /* ========================================================
     CREAR CURSO
     ======================================================== */

  async crearCurso({
    nombre,
    slug,
    descripcion,
    orden,
    activo
  }) {

    const nombreFinal =
      limpiarTexto(
        nombre
      )


    if (
      !nombreFinal
    ) {

      throw new Error(
        "El nombre del curso es obligatorio"
      )
    }


    const slugFinal =
      crearSlug(
        slug ||
        nombreFinal
      )


    if (
      !slugFinal
    ) {

      throw new Error(
        "No se pudo generar un slug válido para el curso"
      )
    }


    const slugExiste =
      await this
        .comprobarSlugCurso(
          slugFinal
        )


    if (
      slugExiste
    ) {

      throw new Error(
        "Ya existe un curso con ese slug"
      )
    }


    let ordenFinal


    if (
      orden ===
        undefined ||
      orden ===
        null ||
      orden ===
        ""
    ) {

      ordenFinal =
        await this
          .siguienteOrdenCurso()

    } else {

      ordenFinal =
        enteroSeguro(
          orden,
          0
        )
    }


    const {
      data,
      error
    } =
      await this.db
        .from(
          "cursos"
        )
        .insert({
          nombre:
            nombreFinal,

          slug:
            slugFinal,

          descripcion:
            limpiarTexto(
              descripcion
            ) || null,

          orden:
            ordenFinal,

          activo:
            booleanoSeguro(
              activo,
              true
            )
        })
        .select(
          CURSO_FIELDS
        )
        .single()


    if (
      error
    ) {

      throw error
    }


    return data
  }


  /* ========================================================
     ACTUALIZAR CURSO
     ======================================================== */

  async actualizarCurso(
    cursoId,
    cambios = {}
  ) {

    const curso =
      await this.buscarCurso(
        cursoId
      )


    if (
      !curso
    ) {

      throw new Error(
        "Curso no encontrado"
      )
    }


    const actualizacion =
      {}


    /* ======================================================
       NOMBRE
       ====================================================== */

    if (
      Object.prototype.hasOwnProperty.call(
        cambios,
        "nombre"
      )
    ) {

      const nombreFinal =
        limpiarTexto(
          cambios.nombre
        )


      if (
        !nombreFinal
      ) {

        throw new Error(
          "El nombre del curso es obligatorio"
        )
      }


      actualizacion.nombre =
        nombreFinal
    }


    /* ======================================================
       SLUG
       ====================================================== */

    if (
      Object.prototype.hasOwnProperty.call(
        cambios,
        "slug"
      )
    ) {

      const slugFinal =
        crearSlug(
          cambios.slug
        )


      if (
        !slugFinal
      ) {

        throw new Error(
          "El slug del curso no es válido"
        )
      }


      const existe =
        await this
          .comprobarSlugCurso(
            slugFinal,
            curso.id
          )


      if (
        existe
      ) {

        throw new Error(
          "Ya existe otro curso con ese slug"
        )
      }


      actualizacion.slug =
        slugFinal
    }


    /* ======================================================
       DESCRIPCION
       ====================================================== */

    if (
      Object.prototype.hasOwnProperty.call(
        cambios,
        "descripcion"
      )
    ) {

      actualizacion.descripcion =
        limpiarTexto(
          cambios.descripcion
        ) || null
    }


    /* ======================================================
       ORDEN
       ====================================================== */

    if (
      Object.prototype.hasOwnProperty.call(
        cambios,
        "orden"
      )
    ) {

      actualizacion.orden =
        enteroSeguro(
          cambios.orden,
          curso.orden || 0
        )
    }


    if (
      Object.keys(
        actualizacion
      ).length === 0
    ) {

      return curso
    }


    const {
      data,
      error
    } =
      await this.db
        .from(
          "cursos"
        )
        .update(
          actualizacion
        )
        .eq(
          "id",
          curso.id
        )
        .select(
          CURSO_FIELDS
        )
        .single()


    if (
      error
    ) {

      throw error
    }


    return data
  }


  /* ========================================================
     CAMBIAR ESTADO DE CURSO
     ======================================================== */

  async cambiarEstadoCurso(
    cursoId,
    activo
  ) {

    if (
      typeof activo !==
      "boolean"
    ) {

      throw new Error(
        "El estado del curso debe ser true o false"
      )
    }


    const curso =
      await this.buscarCurso(
        cursoId
      )


    if (
      !curso
    ) {

      throw new Error(
        "Curso no encontrado"
      )
    }


    const {
      data,
      error
    } =
      await this.db
        .from(
          "cursos"
        )
        .update({
          activo
        })
        .eq(
          "id",
          curso.id
        )
        .select(
          CURSO_FIELDS
        )
        .single()


    if (
      error
    ) {

      throw error
    }


    /*
     * NO desactivamos físicamente los módulos.
     *
     * Si el curso está desactivado,
     * el middleware de permisos ya bloquea
     * el acceso al curso completo.
     *
     * Esto permite reactivar posteriormente
     * el curso conservando su configuración.
     */

    return data
  }


  /* ========================================================
     CREAR MODULO
     ======================================================== */

  async crearModulo(
    cursoId,
    {
      nombre,
      slug,
      clave,
      descripcion,
      orden,
      activo
    }
  ) {

    const curso =
      await this.buscarCurso(
        cursoId
      )


    if (
      !curso
    ) {

      throw new Error(
        "Curso no encontrado"
      )
    }


    const nombreFinal =
      limpiarTexto(
        nombre
      )


    if (
      !nombreFinal
    ) {

      throw new Error(
        "El nombre del módulo es obligatorio"
      )
    }


    const slugFinal =
      crearSlug(
        slug ||
        nombreFinal
      )


    if (
      !slugFinal
    ) {

      throw new Error(
        "No se pudo generar un slug válido para el módulo"
      )
    }


    const slugExiste =
      await this
        .comprobarSlugModulo(
          curso.id,
          slugFinal
        )


    if (
      slugExiste
    ) {

      throw new Error(
        "Ya existe un módulo con ese slug dentro del curso"
      )
    }


    /* ======================================================
       CLAVE DE PERMISO
       ====================================================== */

    const claveFinal =
      limpiarTexto(
        clave
      ) ||
      `${crearParteClave(
        curso.slug
      )}.${crearParteClave(
        slugFinal
      )}`


    if (
      !claveFinal
    ) {

      throw new Error(
        "La clave del módulo es obligatoria"
      )
    }


    const claveExiste =
      await this
        .comprobarClaveModulo(
          claveFinal
        )


    if (
      claveExiste
    ) {

      throw new Error(
        "Ya existe un módulo con esa clave de permiso"
      )
    }


    let ordenFinal


    if (
      orden ===
        undefined ||
      orden ===
        null ||
      orden ===
        ""
    ) {

      ordenFinal =
        await this
          .siguienteOrdenModulo(
            curso.id
          )

    } else {

      ordenFinal =
        enteroSeguro(
          orden,
          0
        )
    }


    const {
      data,
      error
    } =
      await this.db
        .from(
          "curso_modulos"
        )
        .insert({
          curso_id:
            curso.id,

          nombre:
            nombreFinal,

          slug:
            slugFinal,

          clave:
            claveFinal,

          descripcion:
            limpiarTexto(
              descripcion
            ) || null,

          orden:
            ordenFinal,

          activo:
            booleanoSeguro(
              activo,
              true
            )
        })
        .select(
          MODULO_FIELDS
        )
        .single()


    if (
      error
    ) {

      throw error
    }


    return data
  }


  /* ========================================================
     ACTUALIZAR MODULO
     ======================================================== */

  async actualizarModulo(
    moduloId,
    cambios = {}
  ) {

    const modulo =
      await this.buscarModulo(
        moduloId
      )


    if (
      !modulo
    ) {

      throw new Error(
        "Módulo no encontrado"
      )
    }


    const actualizacion =
      {}


    /* ======================================================
       NOMBRE
       ====================================================== */

    if (
      Object.prototype.hasOwnProperty.call(
        cambios,
        "nombre"
      )
    ) {

      const nombreFinal =
        limpiarTexto(
          cambios.nombre
        )


      if (
        !nombreFinal
      ) {

        throw new Error(
          "El nombre del módulo es obligatorio"
        )
      }


      actualizacion.nombre =
        nombreFinal
    }


    /* ======================================================
       SLUG
       ====================================================== */

    if (
      Object.prototype.hasOwnProperty.call(
        cambios,
        "slug"
      )
    ) {

      const slugFinal =
        crearSlug(
          cambios.slug
        )


      if (
        !slugFinal
      ) {

        throw new Error(
          "El slug del módulo no es válido"
        )
      }


      const existe =
        await this
          .comprobarSlugModulo(
            modulo.curso_id,
            slugFinal,
            modulo.id
          )


      if (
        existe
      ) {

        throw new Error(
          "Ya existe otro módulo con ese slug dentro del curso"
        )
      }


      actualizacion.slug =
        slugFinal
    }


    /* ======================================================
       CLAVE
       ====================================================== */

    if (
      Object.prototype.hasOwnProperty.call(
        cambios,
        "clave"
      )
    ) {

      const claveFinal =
        limpiarTexto(
          cambios.clave
        )


      if (
        !claveFinal
      ) {

        throw new Error(
          "La clave del módulo es obligatoria"
        )
      }


      const existe =
        await this
          .comprobarClaveModulo(
            claveFinal,
            modulo.id
          )


      if (
        existe
      ) {

        throw new Error(
          "Ya existe otro módulo con esa clave de permiso"
        )
      }


      actualizacion.clave =
        claveFinal
    }


    /* ======================================================
       DESCRIPCION
       ====================================================== */

    if (
      Object.prototype.hasOwnProperty.call(
        cambios,
        "descripcion"
      )
    ) {

      actualizacion.descripcion =
        limpiarTexto(
          cambios.descripcion
        ) || null
    }


    /* ======================================================
       ORDEN
       ====================================================== */

    if (
      Object.prototype.hasOwnProperty.call(
        cambios,
        "orden"
      )
    ) {

      actualizacion.orden =
        enteroSeguro(
          cambios.orden,
          modulo.orden || 0
        )
    }


    if (
      Object.keys(
        actualizacion
      ).length === 0
    ) {

      return modulo
    }


    const {
      data,
      error
    } =
      await this.db
        .from(
          "curso_modulos"
        )
        .update(
          actualizacion
        )
        .eq(
          "id",
          modulo.id
        )
        .select(
          MODULO_FIELDS
        )
        .single()


    if (
      error
    ) {

      throw error
    }


    return data
  }


  /* ========================================================
     CAMBIAR ESTADO DE MODULO
     ======================================================== */

  async cambiarEstadoModulo(
    moduloId,
    activo
  ) {

    if (
      typeof activo !==
      "boolean"
    ) {

      throw new Error(
        "El estado del módulo debe ser true o false"
      )
    }


    const modulo =
      await this.buscarModulo(
        moduloId
      )


    if (
      !modulo
    ) {

      throw new Error(
        "Módulo no encontrado"
      )
    }


    const {
      data,
      error
    } =
      await this.db
        .from(
          "curso_modulos"
        )
        .update({
          activo
        })
        .eq(
          "id",
          modulo.id
        )
        .select(
          MODULO_FIELDS
        )
        .single()


    if (
      error
    ) {

      throw error
    }


    return data
  }
}


export default CourseAdminModel