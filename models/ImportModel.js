import {
  adminClient
} from "../config/supabase.js"


const LOTE = 500


const CAMPOS =
  "id,archivo,empresa,es_propia,formato,columnas,total_filas,tabla_fisica,user_id,created_at"


/* ==========================================================
   MODELO
   ========================================================== */

class ImportModel {

  constructor(user) {
    this.user = user
    this.db = adminClient()

    /*
     * Cache simple para no consultar
     * varias veces los usuarios de la
     * misma empresa durante una petición.
     */
    this._usuariosEmpresa = null
  }


  /* ========================================================
     USUARIOS DE LA MISMA EMPRESA
     ======================================================== */

  async usuariosMismaEmpresa() {

    /*
     * ADMIN:
     * no necesita esta comprobación porque
     * conserva acceso global.
     */
    if (
      this.user.role ===
      "admin"
    ) {
      return []
    }


    if (
      this._usuariosEmpresa
    ) {
      return this._usuariosEmpresa
    }


    const empresa =
      String(
        this.user?.empresa || ""
      ).trim()


    /*
     * Si por algún motivo el perfil no tiene
     * empresa, usamos solamente su propio ID.
     *
     * Es más seguro que abrir información.
     */
    if (!empresa) {

      this._usuariosEmpresa = [
        this.user.id
      ]

      return this._usuariosEmpresa
    }


    const {
      data,
      error
    } =
      await this.db
        .from(
          "profiles"
        )
        .select(
          "id"
        )
        .eq(
          "empresa",
          empresa
        )


    if (error) {
      throw error
    }


    const ids =
      [
        ...new Set(
          [
            this.user.id,

            ...(
              data || []
            ).map(
              (perfil) =>
                perfil.id
            )
          ]
        )
      ]


    this._usuariosEmpresa =
      ids


    return ids
  }


  /* ========================================================
     DATOS PROPIOS DE LA EMPRESA
     ======================================================== */

  /**
   * Los archivos con:
   *
   * es_propia = true
   *
   * son datos compartidos de la empresa.
   *
   * Se muestran aunque otro usuario de
   * la misma empresa los haya cargado.
   */
  async listarPropiasCompartidas() {

    const usuariosEmpresa =
      await this
        .usuariosMismaEmpresa()


    if (
      usuariosEmpresa.length ===
      0
    ) {
      return []
    }


    const {
      data,
      error
    } =
      await this.db
        .from(
          "imports"
        )
        .select(
          CAMPOS
        )
        .eq(
          "es_propia",
          true
        )
        .in(
          "user_id",
          usuariosEmpresa
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


  /* ========================================================
     DATOS EXTERNOS PRIVADOS
     ======================================================== */

  /**
   * Los archivos con:
   *
   * es_propia = false
   *
   * pertenecen al usuario que los subió.
   *
   * No se comparten automáticamente con
   * los demás trabajadores.
   */
  async listarExternasPrivadas() {

    const {
      data,
      error
    } =
      await this.db
        .from(
          "imports"
        )
        .select(
          CAMPOS
        )
        .eq(
          "es_propia",
          false
        )
        .eq(
          "user_id",
          this.user.id
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


  /* ========================================================
     LISTAR
     ======================================================== */

  async listar({
    soloPropias = null
  } = {}) {

    /* ======================================================
       ADMIN
       ====================================================== */

    if (
      this.user.role ===
      "admin"
    ) {

      let query =
        this.db
          .from(
            "imports"
          )
          .select(
            CAMPOS
          )
          .order(
            "created_at",
            {
              ascending:
                false
            }
          )


      if (
        soloPropias === true
      ) {
        query =
          query.eq(
            "es_propia",
            true
          )
      }


      if (
        soloPropias === false
      ) {
        query =
          query.eq(
            "es_propia",
            false
          )
      }


      const {
        data,
        error
      } =
        await query


      if (error) {
        throw error
      }


      return data || []
    }


    /* ======================================================
       SOLO DATOS DE MI EMPRESA
       ====================================================== */

    if (
      soloPropias === true
    ) {
      return await this
        .listarPropiasCompartidas()
    }


    /* ======================================================
       SOLO MIS DATOS EXTERNOS
       ====================================================== */

    if (
      soloPropias === false
    ) {
      return await this
        .listarExternasPrivadas()
    }


    /* ======================================================
       TODOS LOS DATASETS DISPONIBLES PARA MI
       ====================================================== */

    const [
      propias,
      externas
    ] =
      await Promise.all([
        this.listarPropiasCompartidas(),
        this.listarExternasPrivadas()
      ])


    /*
     * Mezclamos ambas listas y ordenamos
     * por fecha.
     */
    return [
      ...propias,
      ...externas
    ].sort(
      (a, b) =>
        new Date(
          b.created_at
        ).getTime() -
        new Date(
          a.created_at
        ).getTime()
    )
  }


  /* ========================================================
     COMPROBAR ACCESO A UN DATASET
     ======================================================== */

  async puedeAcceder(
    importacion
  ) {

    if (!importacion) {
      return false
    }


    /* ======================================================
       ADMIN
       ====================================================== */

    if (
      this.user.role ===
      "admin"
    ) {
      return true
    }


    /* ======================================================
       ARCHIVO EXTERNO
       ====================================================== */

    if (
      importacion.es_propia ===
      false
    ) {

      /*
       * Solamente quien lo subió.
       */
      return (
        importacion.user_id ===
        this.user.id
      )
    }


    /* ======================================================
       ARCHIVO DE LA EMPRESA
       ====================================================== */

    const usuariosEmpresa =
      await this
        .usuariosMismaEmpresa()


    /*
     * Si quien lo subió pertenece a
     * mi misma empresa, puedo usarlo.
     */
    return usuariosEmpresa.includes(
      importacion.user_id
    )
  }


  /* ========================================================
     BUSCAR
     ======================================================== */

  async buscar(id) {

    const {
      data,
      error
    } =
      await this.db
        .from(
          "imports"
        )
        .select(
          CAMPOS
        )
        .eq(
          "id",
          id
        )
        .maybeSingle()


    if (error) {
      throw error
    }


    if (!data) {
      return null
    }


    const permitido =
      await this
        .puedeAcceder(
          data
        )


    if (!permitido) {
      return null
    }


    return data
  }


  /* ========================================================
     CREAR
     ======================================================== */

  async crear(datos) {

    const {
      data,
      error
    } =
      await this.db
        .from(
          "imports"
        )
        .insert({
          ...datos,

          /*
           * Se mantiene para saber quién
           * realizó originalmente la carga.
           */
          user_id:
            this.user.id
        })
        .select(
          CAMPOS
        )
        .single()


    if (error) {
      throw error
    }


    return data
  }


  /* ========================================================
     GUARDAR FILAS
     ======================================================== */

  async guardarFilas(
    importId,
    filas
  ) {

    for (
      let i = 0;
      i < filas.length;
      i += LOTE
    ) {

      const lote =
        filas
          .slice(
            i,
            i + LOTE
          )
          .map(
            (
              data,
              indice
            ) => ({
              import_id:
                importId,

              fila:
                i +
                indice +
                1,

              data
            })
          )


      const {
        error
      } =
        await this.db
          .from(
            "import_rows"
          )
          .insert(
            lote
          )


      if (error) {
        throw error
      }
    }


    return filas.length
  }


  /* ========================================================
     FILAS
     ======================================================== */

  async filas(
    importId,
    {
      limite = null,
      desde = 0
    } = {}
  ) {

    let query =
      this.db
        .from(
          "import_rows"
        )
        .select(
          "fila,data"
        )
        .eq(
          "import_id",
          importId
        )
        .order(
          "fila",
          {
            ascending:
              true
          }
        )


    if (limite) {

      query =
        query.range(
          desde,
          desde +
            limite -
            1
        )
    }


    const {
      data,
      error
    } =
      await query


    if (error) {
      throw error
    }


    return (
      data || []
    ).map(
      (registro) =>
        registro.data
    )
  }


  /* ========================================================
     CONTAR FILAS
     ======================================================== */

  async contarFilas(
    importId
  ) {

    const {
      count,
      error
    } =
      await this.db
        .from(
          "import_rows"
        )
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true
          }
        )
        .eq(
          "import_id",
          importId
        )


    if (error) {
      throw error
    }


    return count || 0
  }


  /* ========================================================
     ELIMINAR
     ======================================================== */

  async eliminar(id) {

    /*
     * De momento conservamos el comportamiento
     * existente.
     *
     * En el siguiente paso protegeremos DELETE
     * mediante permisos para evitar que cualquier
     * usuario pueda eliminar datos compartidos.
     */

    const {
      error
    } =
      await this.db
        .from(
          "imports"
        )
        .delete()
        .eq(
          "id",
          id
        )


    if (error) {
      throw error
    }


    return true
  }


  /* ========================================================
     ACTUALIZAR
     ======================================================== */

  async actualizar(
    id,
    datos
  ) {

    const {
      data,
      error
    } =
      await this.db
        .from(
          "imports"
        )
        .update(
          datos
        )
        .eq(
          "id",
          id
        )
        .select(
          CAMPOS
        )
        .single()


    if (error) {
      throw error
    }


    return data
  }


  /* ========================================================
     AUTORES
     ======================================================== */

  async autores(ids) {

    const idsValidos =
      [
        ...new Set(
          (
            ids || []
          ).filter(Boolean)
        )
      ]


    if (
      idsValidos.length ===
      0
    ) {
      return {}
    }


    const {
      data,
      error
    } =
      await this.db
        .from(
          "profiles"
        )
        .select(
          "id,full_name,email"
        )
        .in(
          "id",
          idsValidos
        )


    if (error) {
      throw error
    }


    const mapa = {}


    ;(
      data || []
    ).forEach(
      (perfil) => {

        mapa[
          perfil.id
        ] =
          perfil.full_name ||
          perfil.email

      }
    )


    return mapa
  }
}


export default ImportModel