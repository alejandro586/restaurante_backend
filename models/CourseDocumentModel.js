import crypto from "node:crypto"

import {
  adminClient
} from "../config/supabase.js"


/* ==========================================================
   CONFIGURACION
   ========================================================== */

const STORAGE_BUCKET =
  "documentos-cursos"

const MAX_FILE_SIZE =
  25 * 1024 * 1024


const MIME_TYPES = {
  pdf:
    "application/pdf",

  doc:
    "application/msword",

  docx:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  xls:
    "application/vnd.ms-excel",

  xlsx:
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  ppt:
    "application/vnd.ms-powerpoint",

  pptx:
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
}


const EXTENSIONES_PERMITIDAS =
  new Set(
    Object.keys(
      MIME_TYPES
    )
  )


const DOCUMENT_FIELDS = [
  "id",
  "curso_id",
  "modulo_id",
  "user_id",
  "nombre_original",
  "nombre_archivo",
  "extension",
  "mime_type",
  "tamano_bytes",
  "storage_bucket",
  "storage_path",
  "descripcion",
  "activo",
  "created_at",
  "updated_at"
].join(",")


/* ==========================================================
   UTILIDADES
   ========================================================== */

const idValido = (valor) => {
  const numero =
    Number(valor)

  return (
    Number.isInteger(numero) &&
    numero > 0
  )
}


const obtenerExtension =
  (nombre = "") => {

    const limpio =
      String(nombre)
        .trim()

    const posicion =
      limpio.lastIndexOf(".")

    if (
      posicion <= 0 ||
      posicion ===
        limpio.length - 1
    ) {
      return ""
    }

    return limpio
      .slice(
        posicion + 1
      )
      .trim()
      .toLowerCase()
  }


const quitarExtension =
  (nombre = "") => {

    const limpio =
      String(nombre)
        .trim()

    const posicion =
      limpio.lastIndexOf(".")

    if (posicion <= 0) {
      return limpio
    }

    return limpio.slice(
      0,
      posicion
    )
  }


const normalizarNombreArchivo =
  (nombre = "") => {

    const base =
      quitarExtension(
        nombre
      )
        .normalize("NFD")
        .replace(
          /[\u0300-\u036f]/g,
          ""
        )
        .replace(
          /[^a-zA-Z0-9_-]+/g,
          "-"
        )
        .replace(
          /-+/g,
          "-"
        )
        .replace(
          /^[-_]+|[-_]+$/g,
          ""
        )
        .slice(
          0,
          80
        )

    return (
      base ||
      "documento"
    )
  }


const esAdmin =
  (usuario) =>
    usuario?.role ===
    "admin"


/* ==========================================================
   VALIDACION BASICA DEL CONTENIDO
   ========================================================== */

/**
 * Evita aceptar simplemente un archivo
 * cualquiera renombrado como .pdf/.docx/etc.
 *
 * No sustituye un antivirus, pero añade
 * una validación básica de formato.
 */
const validarFirmaArchivo =
  (
    extension,
    buffer
  ) => {

    if (
      !Buffer.isBuffer(
        buffer
      ) ||
      buffer.length <
        4
    ) {
      return false
    }


    /* --------------------------------------------------------
       PDF
       %PDF-
       -------------------------------------------------------- */

    if (
      extension ===
      "pdf"
    ) {

      return (
        buffer
          .subarray(
            0,
            5
          )
          .toString(
            "ascii"
          ) ===
        "%PDF-"
      )
    }


    /* --------------------------------------------------------
       DOC / XLS / PPT antiguos

       Formato OLE Compound File:

       D0 CF 11 E0 A1 B1 1A E1
       -------------------------------------------------------- */

    if (
      [
        "doc",
        "xls",
        "ppt"
      ].includes(
        extension
      )
    ) {

      if (
        buffer.length <
        8
      ) {
        return false
      }

      const firmaOle =
        Buffer.from([
          0xd0,
          0xcf,
          0x11,
          0xe0,
          0xa1,
          0xb1,
          0x1a,
          0xe1
        ])

      return buffer
        .subarray(
          0,
          8
        )
        .equals(
          firmaOle
        )
    }


    /* --------------------------------------------------------
       DOCX / XLSX / PPTX

       Son contenedores ZIP.
       -------------------------------------------------------- */

    if (
      [
        "docx",
        "xlsx",
        "pptx"
      ].includes(
        extension
      )
    ) {

      return (
        buffer[0] ===
          0x50 &&
        buffer[1] ===
          0x4b &&
        (
          (
            buffer[2] ===
              0x03 &&
            buffer[3] ===
              0x04
          ) ||
          (
            buffer[2] ===
              0x05 &&
            buffer[3] ===
              0x06
          ) ||
          (
            buffer[2] ===
              0x07 &&
            buffer[3] ===
              0x08
          )
        )
      )
    }


    return false
  }


/* ==========================================================
   MODELO
   ========================================================== */

class CourseDocumentModel {

  constructor() {
    this.db =
      adminClient()
  }


  /* ========================================================
     BUSCAR CURSO
     ======================================================== */

  async buscarCurso(
    cursoId
  ) {

    if (
      !idValido(
        cursoId
      )
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
          "id,nombre,slug,activo"
        )
        .eq(
          "id",
          Number(
            cursoId
          )
        )
        .maybeSingle()


    if (error) {
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

    if (
      !idValido(
        moduloId
      )
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
          "id,curso_id,nombre,slug,clave,activo"
        )
        .eq(
          "id",
          Number(
            moduloId
          )
        )
        .maybeSingle()


    if (error) {
      throw error
    }


    return data
  }


  /* ========================================================
     COMPROBAR ACCESO AL CURSO
     ======================================================== */

  async tieneAccesoCurso(
    usuario,
    cursoId
  ) {

    if (
      !usuario?.id
    ) {
      return false
    }


    if (
      esAdmin(
        usuario
      )
    ) {
      return true
    }


    const {
      data,
      error
    } =
      await this.db
        .from(
          "usuario_cursos"
        )
        .select(
          "id"
        )
        .eq(
          "user_id",
          usuario.id
        )
        .eq(
          "curso_id",
          Number(
            cursoId
          )
        )
        .eq(
          "activo",
          true
        )
        .maybeSingle()


    if (error) {
      throw error
    }


    return Boolean(
      data
    )
  }


  /* ========================================================
     COMPROBAR ACCESO AL MODULO
     ======================================================== */

  async tieneAccesoModulo(
    usuario,
    cursoId,
    moduloId
  ) {

    if (
      !usuario?.id
    ) {
      return false
    }


    const modulo =
      await this
        .buscarModulo(
          moduloId
        )


    if (
      !modulo ||
      Number(
        modulo.curso_id
      ) !==
        Number(
          cursoId
        ) ||
      modulo.activo ===
        false
    ) {
      return false
    }


    if (
      esAdmin(
        usuario
      )
    ) {
      return true
    }


    const accesoCurso =
      await this
        .tieneAccesoCurso(
          usuario,
          cursoId
        )


    if (
      !accesoCurso
    ) {
      return false
    }


    const {
      data,
      error
    } =
      await this.db
        .from(
          "usuario_modulos"
        )
        .select(
          "id"
        )
        .eq(
          "user_id",
          usuario.id
        )
        .eq(
          "modulo_id",
          Number(
            moduloId
          )
        )
        .eq(
          "activo",
          true
        )
        .maybeSingle()


    if (error) {
      throw error
    }


    return Boolean(
      data
    )
  }


  /* ========================================================
     MODULOS PERMITIDOS DEL USUARIO
     ======================================================== */

  async obtenerModulosPermitidos(
    usuario,
    cursoId
  ) {

    if (
      esAdmin(
        usuario
      )
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
            "id"
          )
          .eq(
            "curso_id",
            Number(
              cursoId
            )
          )
          .eq(
            "activo",
            true
          )


      if (error) {
        throw error
      }


      return (
        data ||
        []
      ).map(
        (item) =>
          Number(
            item.id
          )
      )
    }


    const {
      data:
        asignaciones,
      error:
        asignacionesError
    } =
      await this.db
        .from(
          "usuario_modulos"
        )
        .select(
          "modulo_id"
        )
        .eq(
          "user_id",
          usuario.id
        )
        .eq(
          "activo",
          true
        )


    if (
      asignacionesError
    ) {
      throw asignacionesError
    }


    const ids =
      [
        ...new Set(
          (
            asignaciones ||
            []
          )
            .map(
              (item) =>
                Number(
                  item.modulo_id
                )
            )
            .filter(
              (id) =>
                Number.isInteger(
                  id
                ) &&
                id > 0
            )
        )
      ]


    if (
      ids.length ===
      0
    ) {
      return []
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
          Number(
            cursoId
          )
        )
        .eq(
          "activo",
          true
        )
        .in(
          "id",
          ids
        )


    if (
      modulosError
    ) {
      throw modulosError
    }


    return (
      modulos ||
      []
    ).map(
      (item) =>
        Number(
          item.id
        )
    )
  }


  /* ========================================================
     OBTENER DOCUMENTO
     ======================================================== */

  async obtenerDocumento(
    documentoId
  ) {

    if (
      !idValido(
        documentoId
      )
    ) {
      return null
    }


    const {
      data,
      error
    } =
      await this.db
        .from(
          "documentos_curso"
        )
        .select(
          DOCUMENT_FIELDS
        )
        .eq(
          "id",
          Number(
            documentoId
          )
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


  /* ========================================================
     COMPROBAR ACCESO A UN DOCUMENTO
     ======================================================== */

  async puedeAccederDocumento(
    usuario,
    documento
  ) {

    if (
      !usuario ||
      !documento
    ) {
      return false
    }


    if (
      esAdmin(
        usuario
      )
    ) {
      return true
    }


    const accesoCurso =
      await this
        .tieneAccesoCurso(
          usuario,
          documento.curso_id
        )


    if (
      !accesoCurso
    ) {
      return false
    }


    /*
     * Documento general del curso.
     */
    if (
      documento.modulo_id ===
        null ||
      documento.modulo_id ===
        undefined
    ) {
      return true
    }


    return this
      .tieneAccesoModulo(
        usuario,
        documento.curso_id,
        documento.modulo_id
      )
  }


  /* ========================================================
     LISTAR DOCUMENTOS
     ======================================================== */

  async listar({
    usuario,
    cursoId,
    moduloId = null
  }) {

    if (
      !idValido(
        cursoId
      )
    ) {
      return {
        tipo:
          "invalid_course"
      }
    }


    const curso =
      await this
        .buscarCurso(
          cursoId
        )


    if (
      !curso ||
      curso.activo ===
        false
    ) {
      return {
        tipo:
          "course_not_found"
      }
    }


    const accesoCurso =
      await this
        .tieneAccesoCurso(
          usuario,
          cursoId
        )


    if (
      !accesoCurso
    ) {
      return {
        tipo:
          "forbidden"
      }
    }


    /*
     * Si se solicita específicamente
     * un módulo, exigimos acceso al mismo.
     */
    if (
      moduloId !==
        null &&
      moduloId !==
        undefined &&
      moduloId !==
        ""
    ) {

      if (
        !idValido(
          moduloId
        )
      ) {
        return {
          tipo:
            "invalid_module"
        }
      }


      const accesoModulo =
        await this
          .tieneAccesoModulo(
            usuario,
            cursoId,
            moduloId
          )


      if (
        !accesoModulo
      ) {
        return {
          tipo:
            "forbidden"
        }
      }


      const {
        data,
        error
      } =
        await this.db
          .from(
            "documentos_curso"
          )
          .select(
            DOCUMENT_FIELDS
          )
          .eq(
            "curso_id",
            Number(
              cursoId
            )
          )
          .eq(
            "modulo_id",
            Number(
              moduloId
            )
          )
          .eq(
            "activo",
            true
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


      return {
        tipo:
          "ok",

        curso,

        documentos:
          data ||
          []
      }
    }


    /*
     * Administrador:
     * puede ver todos los documentos
     * del curso.
     */
    if (
      esAdmin(
        usuario
      )
    ) {

      const {
        data,
        error
      } =
        await this.db
          .from(
            "documentos_curso"
          )
          .select(
            DOCUMENT_FIELDS
          )
          .eq(
            "curso_id",
            Number(
              cursoId
            )
          )
          .eq(
            "activo",
            true
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


      return {
        tipo:
          "ok",

        curso,

        documentos:
          data ||
          []
      }
    }


    /*
     * Usuario:
     *
     * - puede ver documentos generales
     * - puede ver documentos de módulos
     *   que tenga asignados
     */
    const modulosPermitidos =
      await this
        .obtenerModulosPermitidos(
          usuario,
          cursoId
        )


    let consulta =
      this.db
        .from(
          "documentos_curso"
        )
        .select(
          DOCUMENT_FIELDS
        )
        .eq(
          "curso_id",
          Number(
            cursoId
          )
        )
        .eq(
          "activo",
          true
        )


    if (
      modulosPermitidos.length ===
      0
    ) {

      consulta =
        consulta.is(
          "modulo_id",
          null
        )

    } else {

      consulta =
        consulta.or(
          `modulo_id.is.null,modulo_id.in.(${modulosPermitidos.join(",")})`
        )
    }


    const {
      data,
      error
    } =
      await consulta
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


    return {
      tipo:
        "ok",

      curso,

      documentos:
        data ||
        []
    }
  }


  /* ========================================================
     SUBIR DOCUMENTO
     ======================================================== */

  async subir({
    usuario,
    cursoId,
    moduloId = null,
    archivo,
    descripcion = null
  }) {

    if (
      !usuario?.id
    ) {
      return {
        tipo:
          "forbidden"
      }
    }


    if (
      !idValido(
        cursoId
      )
    ) {
      return {
        tipo:
          "invalid_course"
      }
    }


    const curso =
      await this
        .buscarCurso(
          cursoId
        )


    if (
      !curso ||
      curso.activo ===
        false
    ) {
      return {
        tipo:
          "course_not_found"
      }
    }


    const accesoCurso =
      await this
        .tieneAccesoCurso(
          usuario,
          cursoId
        )


    if (
      !accesoCurso
    ) {
      return {
        tipo:
          "forbidden"
      }
    }


    let moduloFinal =
      null


    if (
      moduloId !==
        null &&
      moduloId !==
        undefined &&
      moduloId !==
        ""
    ) {

      if (
        !idValido(
          moduloId
        )
      ) {
        return {
          tipo:
            "invalid_module"
        }
      }


      const accesoModulo =
        await this
          .tieneAccesoModulo(
            usuario,
            cursoId,
            moduloId
          )


      if (
        !accesoModulo
      ) {
        return {
          tipo:
            "forbidden"
        }
      }


      moduloFinal =
        Number(
          moduloId
        )
    }


    if (
      !archivo ||
      !Buffer.isBuffer(
        archivo.buffer
      )
    ) {
      return {
        tipo:
          "file_required"
      }
    }


    if (
      archivo.size <=
        0 ||
      archivo.size >
        MAX_FILE_SIZE
    ) {
      return {
        tipo:
          "invalid_file_size"
      }
    }


    const nombreOriginal =
      String(
        archivo.originalname ||
        ""
      )
        .trim()


    const extension =
      obtenerExtension(
        nombreOriginal
      )


    if (
      !EXTENSIONES_PERMITIDAS
        .has(
          extension
        )
    ) {
      return {
        tipo:
          "invalid_file_type"
      }
    }


    if (
      !validarFirmaArchivo(
        extension,
        archivo.buffer
      )
    ) {
      return {
        tipo:
          "invalid_file_content"
      }
    }


    const mimeType =
      MIME_TYPES[
        extension
      ]


    const nombreSeguro =
      normalizarNombreArchivo(
        nombreOriginal
      )


    const nombreArchivo =
      `${nombreSeguro}-${crypto.randomUUID()}.${extension}`


    const carpetaModulo =
      moduloFinal
        ? `modulo-${moduloFinal}`
        : "general"


    const storagePath =
      `curso-${Number(
        cursoId
      )}/${carpetaModulo}/${nombreArchivo}`


    /* --------------------------------------------------------
       SUBIR A STORAGE
       -------------------------------------------------------- */

    const {
      error:
        storageError
    } =
      await this.db
        .storage
        .from(
          STORAGE_BUCKET
        )
        .upload(
          storagePath,
          archivo.buffer,
          {
            contentType:
              mimeType,

            cacheControl:
              "3600",

            upsert:
              false
          }
        )


    if (
      storageError
    ) {
      throw storageError
    }


    /* --------------------------------------------------------
       GUARDAR METADATOS
       -------------------------------------------------------- */

    try {

      const descripcionFinal =
        String(
          descripcion ||
          ""
        )
          .trim()
          .slice(
            0,
            1000
          ) ||
        null


      const {
        data,
        error
      } =
        await this.db
          .from(
            "documentos_curso"
          )
          .insert({
            curso_id:
              Number(
                cursoId
              ),

            modulo_id:
              moduloFinal,

            user_id:
              usuario.id,

            nombre_original:
              nombreOriginal,

            nombre_archivo:
              nombreArchivo,

            extension,

            mime_type:
              mimeType,

            tamano_bytes:
              archivo.size,

            storage_bucket:
              STORAGE_BUCKET,

            storage_path:
              storagePath,

            descripcion:
              descripcionFinal,

            activo:
              true
          })
          .select(
            DOCUMENT_FIELDS
          )
          .single()


      if (error) {
        throw error
      }


      return {
        tipo:
          "ok",

        documento:
          data
      }

    } catch (
      databaseError
    ) {

      /*
       * Si Storage funcionó pero la tabla falló,
       * eliminamos el archivo para evitar
       * dejar archivos huérfanos.
       */
      try {

        await this.db
          .storage
          .from(
            STORAGE_BUCKET
          )
          .remove([
            storagePath
          ])

      } catch (
        rollbackError
      ) {

        console.error(
          "No se pudo eliminar el archivo después del fallo de base de datos:",
          rollbackError
        )
      }


      throw databaseError
    }
  }


  /* ========================================================
     CREAR URL PRIVADA DE DESCARGA / VISTA
     ======================================================== */

  async crearUrlFirmada({
    usuario,
    documentoId
  }) {

    const documento =
      await this
        .obtenerDocumento(
          documentoId
        )


    if (
      !documento
    ) {
      return {
        tipo:
          "not_found"
      }
    }


    const permitido =
      await this
        .puedeAccederDocumento(
          usuario,
          documento
        )


    if (
      !permitido
    ) {
      return {
        tipo:
          "forbidden"
      }
    }


    /*
     * La URL solamente dura 5 minutos.
     */
    const {
      data,
      error
    } =
      await this.db
        .storage
        .from(
          documento.storage_bucket ||
          STORAGE_BUCKET
        )
        .createSignedUrl(
          documento.storage_path,
          300
        )


    if (
      error
    ) {
      throw error
    }


    if (
      !data?.signedUrl
    ) {
      throw new Error(
        "Supabase no devolvió una URL firmada"
      )
    }


    return {
      tipo:
        "ok",

      documento,

      url:
        data.signedUrl,

      expires_in:
        300
    }
  }


  /* ========================================================
     ELIMINAR DOCUMENTO
     ======================================================== */

  async eliminar({
    usuario,
    documentoId
  }) {

    const documento =
      await this
        .obtenerDocumento(
          documentoId
        )


    if (
      !documento
    ) {
      return {
        tipo:
          "not_found"
      }
    }


    const permitido =
      await this
        .puedeAccederDocumento(
          usuario,
          documento
        )


    if (
      !permitido
    ) {
      return {
        tipo:
          "forbidden"
      }
    }


    /*
     * Un usuario normal solo puede eliminar
     * los documentos que él mismo subió.
     *
     * El administrador puede eliminar
     * cualquier documento.
     */
    if (
      !esAdmin(
        usuario
      ) &&
      String(
        documento.user_id
      ) !==
        String(
          usuario.id
        )
    ) {
      return {
        tipo:
          "forbidden"
      }
    }


    /* --------------------------------------------------------
       DESACTIVAR REGISTRO
       -------------------------------------------------------- */

    const {
      data:
        registroDesactivado,
      error:
        updateError
    } =
      await this.db
        .from(
          "documentos_curso"
        )
        .update({
          activo:
            false
        })
        .eq(
          "id",
          documento.id
        )
        .eq(
          "activo",
          true
        )
        .select(
          DOCUMENT_FIELDS
        )
        .maybeSingle()


    if (
      updateError
    ) {
      throw updateError
    }


    if (
      !registroDesactivado
    ) {
      return {
        tipo:
          "state_changed"
      }
    }


    /* --------------------------------------------------------
       ELIMINAR ARCHIVO DE STORAGE
       -------------------------------------------------------- */

    const {
      error:
        storageError
    } =
      await this.db
        .storage
        .from(
          documento.storage_bucket ||
          STORAGE_BUCKET
        )
        .remove([
          documento.storage_path
        ])


    if (
      storageError
    ) {

      /*
       * Si Storage falla restauramos
       * el registro para que el documento
       * no desaparezca del ERP.
       */
      try {

        await this.db
          .from(
            "documentos_curso"
          )
          .update({
            activo:
              true
          })
          .eq(
            "id",
            documento.id
          )

      } catch (
        rollbackError
      ) {

        console.error(
          "No se pudo restaurar el documento después del fallo de Storage:",
          rollbackError
        )
      }


      throw storageError
    }


    return {
      tipo:
        "ok",

      documento: {
        id:
          documento.id,

        nombre_original:
          documento.nombre_original,

        curso_id:
          documento.curso_id,

        modulo_id:
          documento.modulo_id
      }
    }
  }
}


/* ==========================================================
   EXPORTS
   ========================================================== */

export {
  STORAGE_BUCKET,
  MAX_FILE_SIZE,
  MIME_TYPES,
  EXTENSIONES_PERMITIDAS
}


export default CourseDocumentModel