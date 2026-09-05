import crypto from "node:crypto"

import {
  adminClient
} from "../config/supabase.js"

import MailService from "../services/MailService.js"


/* ==========================================================
   CONFIGURACION
   ========================================================== */

const RESET_CODE_MINUTES = 15
const MAX_ATTEMPTS = 5
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 128

const RESET_FIELDS = [
  "id",
  "user_id",
  "email",
  "estado",
  "codigo_hash",
  "expires_at",
  "approved_by",
  "approved_at",
  "rejected_by",
  "rejected_at",
  "used_at",
  "intentos",
  "created_at",
  "updated_at"
].join(",")

const PROFILE_FIELDS = [
  "id",
  "email",
  "full_name",
  "role",
  "empresa",
  "activo",
  "created_at"
].join(",")


/* ==========================================================
   UTILIDADES
   ========================================================== */

const normalizarCorreo = (email) =>
  String(email || "")
    .trim()
    .toLowerCase()

const correoValido = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    normalizarCorreo(email)
  )

const idSolicitudValido = (id) => {
  const numero = Number(id)

  return (
    Number.isInteger(numero) &&
    numero > 0
  )
}

const ahoraISO = () =>
  new Date().toISOString()

const obtenerPasswordResetSecret = () => {
  const secreto = String(
    process.env.PASSWORD_RESET_SECRET || ""
  ).trim()

  if (secreto.length < 32) {
    throw new Error(
      "PASSWORD_RESET_SECRET no está configurado correctamente"
    )
  }

  return secreto
}

const generarCodigo = () => {
  const numero = crypto.randomInt(
    0,
    1000000
  )

  return String(numero).padStart(
    6,
    "0"
  )
}

const crearHashCodigo = (codigo) => {
  const secreto =
    obtenerPasswordResetSecret()

  return crypto
    .createHmac(
      "sha256",
      secreto
    )
    .update(String(codigo))
    .digest("hex")
}

const hashCoincide = (
  hashGuardado,
  hashRecibido
) => {
  if (
    !hashGuardado ||
    !hashRecibido
  ) {
    return false
  }

  try {
    const guardado = Buffer.from(
      hashGuardado,
      "hex"
    )

    const recibido = Buffer.from(
      hashRecibido,
      "hex"
    )

    if (
      guardado.length !==
      recibido.length
    ) {
      return false
    }

    return crypto.timingSafeEqual(
      guardado,
      recibido
    )
  } catch {
    return false
  }
}


/* ==========================================================
   MODELO
   ========================================================== */

class PasswordResetModel {
  constructor() {
    this.db = adminClient()
  }


  /* ========================================================
     BUSCAR PERFIL POR CORREO
     ======================================================== */

  async buscarPerfilPorCorreo(email) {
    const correo =
      normalizarCorreo(email)

    const {
      data,
      error
    } =
      await this.db
        .from("profiles")
        .select(PROFILE_FIELDS)
        .ilike("email", correo)
        .maybeSingle()

    if (error) {
      throw error
    }

    return data
  }


  /* ========================================================
     BUSCAR PERFIL POR ID
     ======================================================== */

  async buscarPerfil(userId) {
    const {
      data,
      error
    } =
      await this.db
        .from("profiles")
        .select(PROFILE_FIELDS)
        .eq("id", userId)
        .maybeSingle()

    if (error) {
      throw error
    }

    return data
  }


  /* ========================================================
     MARCAR SOLICITUDES VENCIDAS
     ======================================================== */

  async marcarSolicitudesVencidas(
    email = null
  ) {
    let consulta =
      this.db
        .from(
          "password_reset_requests"
        )
        .update({
          estado: "vencido",
          codigo_hash: null,
          expires_at: null,
          updated_at: ahoraISO()
        })
        .eq(
          "estado",
          "aprobado"
        )
        .lt(
          "expires_at",
          ahoraISO()
        )

    if (email) {
      consulta = consulta.eq(
        "email",
        normalizarCorreo(email)
      )
    }

    const { error } =
      await consulta

    if (error) {
      throw error
    }
  }


  /* ========================================================
     BUSCAR SOLICITUD
     ======================================================== */

  async obtenerSolicitud(
    solicitudId
  ) {
    if (
      !idSolicitudValido(
        solicitudId
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
          "password_reset_requests"
        )
        .select(RESET_FIELDS)
        .eq(
          "id",
          Number(solicitudId)
        )
        .maybeSingle()

    if (error) {
      throw error
    }

    return data
  }


  /* ========================================================
     SOLICITAR RECUPERACION
     ======================================================== */

  async solicitarRecuperacion(email) {
    const correo =
      normalizarCorreo(email)

    if (
      !correo ||
      !correoValido(correo)
    ) {
      return {
        tipo: "invalid_email"
      }
    }

    await this
      .marcarSolicitudesVencidas(
        correo
      )

    const perfil =
      await this
        .buscarPerfilPorCorreo(
          correo
        )

    /*
     * Respuesta neutra para no revelar
     * si una cuenta existe o no.
     */
    if (!perfil) {
      return {
        tipo: "ok",
        solicitud_creada: false
      }
    }

    const {
      data: solicitudActiva,
      error: errorSolicitudActiva
    } =
      await this.db
        .from(
          "password_reset_requests"
        )
        .select(RESET_FIELDS)
        .eq(
          "user_id",
          perfil.id
        )
        .in(
          "estado",
          [
            "pendiente",
            "aprobado"
          ]
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(1)
        .maybeSingle()

    if (errorSolicitudActiva) {
      throw errorSolicitudActiva
    }

    if (solicitudActiva) {
      return {
        tipo: "ok",
        solicitud_creada: false
      }
    }

    const fecha = ahoraISO()

    const {
      data: solicitud,
      error
    } =
      await this.db
        .from(
          "password_reset_requests"
        )
        .insert({
          user_id: perfil.id,
          email: correo,
          estado: "pendiente",
          codigo_hash: null,
          expires_at: null,
          approved_by: null,
          approved_at: null,
          rejected_by: null,
          rejected_at: null,
          used_at: null,
          intentos: 0,
          created_at: fecha,
          updated_at: fecha
        })
        .select(RESET_FIELDS)
        .single()

    if (error) {
      throw error
    }

    return {
      tipo: "ok",
      solicitud_creada: true,
      solicitud: {
        id: solicitud.id,
        estado: solicitud.estado,
        created_at:
          solicitud.created_at
      }
    }
  }


  /* ========================================================
     LISTAR SOLICITUDES
     ======================================================== */

  async listarSolicitudes({
    estado = null
  } = {}) {
    await this
      .marcarSolicitudesVencidas()

    let consulta =
      this.db
        .from(
          "password_reset_requests"
        )
        .select(RESET_FIELDS)
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(200)

    if (estado) {
      consulta = consulta.eq(
        "estado",
        String(estado)
          .trim()
          .toLowerCase()
      )
    }

    const {
      data: solicitudes,
      error
    } =
      await consulta

    if (error) {
      throw error
    }

    const lista =
      solicitudes || []

    if (
      lista.length === 0
    ) {
      return []
    }

    const ids = [
      ...new Set(
        lista
          .flatMap(
            (solicitud) => [
              solicitud.user_id,
              solicitud.approved_by,
              solicitud.rejected_by
            ]
          )
          .filter(Boolean)
      )
    ]

    let perfiles = []

    if (ids.length > 0) {
      const {
        data,
        error: profilesError
      } =
        await this.db
          .from("profiles")
          .select(PROFILE_FIELDS)
          .in("id", ids)

      if (profilesError) {
        throw profilesError
      }

      perfiles = data || []
    }

    const mapaPerfiles =
      new Map(
        perfiles.map(
          (perfil) => [
            String(perfil.id),
            perfil
          ]
        )
      )

    return lista.map(
      (solicitud) => ({
        ...solicitud,

        codigo_hash: undefined,

        usuario:
          mapaPerfiles.get(
            String(
              solicitud.user_id
            )
          ) || null,

        aprobado_por:
          solicitud.approved_by
            ? mapaPerfiles.get(
                String(
                  solicitud.approved_by
                )
              ) || null
            : null,

        rechazado_por:
          solicitud.rejected_by
            ? mapaPerfiles.get(
                String(
                  solicitud.rejected_by
                )
              ) || null
            : null
      })
    )
  }


  /* ========================================================
     APROBAR SOLICITUD
     ======================================================== */

  /**
   * El administrador solamente autoriza.
   *
   * El backend genera un código de 6 dígitos,
   * guarda únicamente su hash y envía el código
   * automáticamente al correo del usuario.
   *
   * El código NO se devuelve al administrador.
   */
  async aprobarSolicitud(
    solicitudId,
    adminId
  ) {
    if (
      !idSolicitudValido(
        solicitudId
      )
    ) {
      return {
        tipo: "invalid_id"
      }
    }

    const solicitud =
      await this
        .obtenerSolicitud(
          solicitudId
        )

    if (!solicitud) {
      return {
        tipo: "not_found"
      }
    }

    if (
      solicitud.estado ===
      "aprobado"
    ) {
      return {
        tipo: "already_approved"
      }
    }

    if (
      solicitud.estado !==
      "pendiente"
    ) {
      return {
        tipo: "invalid_state",
        estado: solicitud.estado
      }
    }

    const perfil =
      await this
        .buscarPerfil(
          solicitud.user_id
        )

    if (!perfil) {
      return {
        tipo: "user_not_found"
      }
    }

    const codigo =
      generarCodigo()

    const codigoHash =
      crearHashCodigo(codigo)

    const fechaAprobacion =
      new Date()

    const fechaVencimiento =
      new Date(
        fechaAprobacion.getTime() +
          RESET_CODE_MINUTES *
            60 *
            1000
      )

    /*
     * Reservamos la aprobación antes de enviar
     * el correo para evitar que dos administradores
     * generen dos códigos simultáneamente.
     */
    const {
      data,
      error
    } =
      await this.db
        .from(
          "password_reset_requests"
        )
        .update({
          estado: "aprobado",
          codigo_hash: codigoHash,
          expires_at:
            fechaVencimiento
              .toISOString(),
          approved_by: adminId,
          approved_at:
            fechaAprobacion
              .toISOString(),
          rejected_by: null,
          rejected_at: null,
          used_at: null,
          intentos: 0,
          updated_at:
            fechaAprobacion
              .toISOString()
        })
        .eq(
          "id",
          Number(solicitudId)
        )
        .eq(
          "estado",
          "pendiente"
        )
        .select(RESET_FIELDS)
        .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return {
        tipo: "state_changed"
      }
    }

    let correoEnviado = null

    try {
      correoEnviado =
        await MailService
          .enviarCodigoRecuperacion({
            email: data.email,
            nombre:
              perfil.full_name ||
              perfil.email ||
              "Usuario",
            codigo,
            venceEnMinutos:
              RESET_CODE_MINUTES
          })
    } catch (mailError) {
      console.error(
        "No se pudo enviar el código de recuperación:",
        mailError
      )

      /*
       * Si SMTP falla, la solicitud vuelve a pendiente
       * y el código queda invalidado.
       */
      try {
        const {
          data: solicitudRestaurada,
          error: rollbackError
        } =
          await this.db
            .from(
              "password_reset_requests"
            )
            .update({
              estado: "pendiente",
              codigo_hash: null,
              expires_at: null,
              approved_by: null,
              approved_at: null,
              rejected_by: null,
              rejected_at: null,
              used_at: null,
              intentos: 0,
              updated_at: ahoraISO()
            })
            .eq(
              "id",
              data.id
            )
            .eq(
              "estado",
              "aprobado"
            )
            .eq(
              "approved_by",
              adminId
            )
            .eq(
              "codigo_hash",
              codigoHash
            )
            .select("id,estado")
            .maybeSingle()

        if (rollbackError) {
          throw rollbackError
        }

        if (!solicitudRestaurada) {
          throw new Error(
            "La solicitud cambió de estado antes de completar el rollback"
          )
        }
      } catch (rollbackError) {
        console.error(
          "No se pudo restaurar la solicitud después del fallo de correo:",
          rollbackError
        )

        throw new Error(
          "No se pudo enviar el código y tampoco se pudo restaurar la solicitud"
        )
      }

      return {
        tipo: "mail_error"
      }
    }

    return {
      tipo: "ok",

      solicitud: {
        id: data.id,
        user_id: data.user_id,
        email: data.email,
        estado: data.estado,
        expires_at: data.expires_at,
        approved_at: data.approved_at
      },

      email_enviado:
        Boolean(
          correoEnviado?.enviado
        ),

      vence_en_minutos:
        RESET_CODE_MINUTES
    }
  }


  /* ========================================================
     RECHAZAR SOLICITUD
     ======================================================== */

  async rechazarSolicitud(
    solicitudId,
    adminId
  ) {
    if (
      !idSolicitudValido(
        solicitudId
      )
    ) {
      return {
        tipo: "invalid_id"
      }
    }

    const solicitud =
      await this
        .obtenerSolicitud(
          solicitudId
        )

    if (!solicitud) {
      return {
        tipo: "not_found"
      }
    }

    if (
      ![
        "pendiente",
        "aprobado"
      ].includes(
        solicitud.estado
      )
    ) {
      return {
        tipo: "invalid_state",
        estado: solicitud.estado
      }
    }

    const fecha = ahoraISO()

    const {
      data,
      error
    } =
      await this.db
        .from(
          "password_reset_requests"
        )
        .update({
          estado: "rechazado",
          codigo_hash: null,
          expires_at: null,
          rejected_by: adminId,
          rejected_at: fecha,
          used_at: null,
          updated_at: fecha
        })
        .eq(
          "id",
          Number(solicitudId)
        )
        .in(
          "estado",
          [
            "pendiente",
            "aprobado"
          ]
        )
        .select(RESET_FIELDS)
        .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return {
        tipo: "state_changed"
      }
    }

    return {
      tipo: "ok",
      solicitud: {
        id: data.id,
        email: data.email,
        estado: data.estado,
        rejected_at:
          data.rejected_at
      }
    }
  }


  /* ========================================================
     BUSCAR SOLICITUD APROBADA
     ======================================================== */

  async buscarSolicitudAprobada(
    email
  ) {
    const correo =
      normalizarCorreo(email)

    const {
      data,
      error
    } =
      await this.db
        .from(
          "password_reset_requests"
        )
        .select(RESET_FIELDS)
        .eq("email", correo)
        .eq(
          "estado",
          "aprobado"
        )
        .order(
          "approved_at",
          {
            ascending: false
          }
        )
        .limit(1)
        .maybeSingle()

    if (error) {
      throw error
    }

    return data
  }


  /* ========================================================
     REGISTRAR INTENTO INCORRECTO
     ======================================================== */

  async registrarIntentoIncorrecto(
    solicitud
  ) {
    const intentos =
      Number(
        solicitud.intentos || 0
      ) + 1

    const superoLimite =
      intentos >= MAX_ATTEMPTS

    const cambios = {
      intentos,
      updated_at: ahoraISO()
    }

    if (superoLimite) {
      cambios.estado = "vencido"
      cambios.codigo_hash = null
      cambios.expires_at = null
    }

    const { error } =
      await this.db
        .from(
          "password_reset_requests"
        )
        .update(cambios)
        .eq(
          "id",
          solicitud.id
        )
        .eq(
          "estado",
          "aprobado"
        )

    if (error) {
      throw error
    }

    return {
      intentos,
      intentos_restantes:
        Math.max(
          0,
          MAX_ATTEMPTS -
            intentos
        ),
      vencido: superoLimite
    }
  }


  /* ========================================================
     COMPLETAR RECUPERACION
     ======================================================== */

  async completarRecuperacion({
    email,
    codigo,
    password
  }) {
    const correo =
      normalizarCorreo(email)

    const codigoFinal =
      String(codigo || "").trim()

    const nuevaPassword =
      String(password || "")

    if (
      !correo ||
      !correoValido(correo)
    ) {
      return {
        tipo: "invalid_email"
      }
    }

    if (
      !/^\d{6}$/.test(
        codigoFinal
      )
    ) {
      return {
        tipo:
          "invalid_code_format"
      }
    }

    if (
      nuevaPassword.length <
      MIN_PASSWORD_LENGTH
    ) {
      return {
        tipo: "password_too_short"
      }
    }

    if (
      nuevaPassword.length >
      MAX_PASSWORD_LENGTH
    ) {
      return {
        tipo: "password_too_long"
      }
    }

    await this
      .marcarSolicitudesVencidas(
        correo
      )

    const solicitud =
      await this
        .buscarSolicitudAprobada(
          correo
        )

    if (!solicitud) {
      return {
        tipo: "invalid_or_expired"
      }
    }

    const vence =
      solicitud.expires_at
        ? new Date(
            solicitud.expires_at
          )
        : null

    if (
      !vence ||
      Number.isNaN(
        vence.getTime()
      ) ||
      vence.getTime() <=
        Date.now()
    ) {
      const {
        error: expireError
      } =
        await this.db
          .from(
            "password_reset_requests"
          )
          .update({
            estado: "vencido",
            codigo_hash: null,
            expires_at: null,
            updated_at: ahoraISO()
          })
          .eq(
            "id",
            solicitud.id
          )
          .eq(
            "estado",
            "aprobado"
          )

      if (expireError) {
        throw expireError
      }

      return {
        tipo: "invalid_or_expired"
      }
    }

    if (
      Number(
        solicitud.intentos || 0
      ) >= MAX_ATTEMPTS
    ) {
      return {
        tipo: "max_attempts"
      }
    }

    const hashRecibido =
      crearHashCodigo(
        codigoFinal
      )

    const codigoCorrecto =
      hashCoincide(
        solicitud.codigo_hash,
        hashRecibido
      )

    if (!codigoCorrecto) {
      const intento =
        await this
          .registrarIntentoIncorrecto(
            solicitud
          )

      if (intento.vencido) {
        return {
          tipo: "max_attempts",
          intentos_restantes: 0
        }
      }

      return {
        tipo: "invalid_code",
        intentos_restantes:
          intento.intentos_restantes
      }
    }

    const perfil =
      await this
        .buscarPerfil(
          solicitud.user_id
        )

    if (!perfil) {
      return {
        tipo: "invalid_or_expired"
      }
    }

    /*
     * Reservamos/consumimos la solicitud antes
     * de cambiar la contraseña para impedir que
     * el mismo código se use simultáneamente.
     */
    const fechaUso = ahoraISO()

    const hashAnterior =
      solicitud.codigo_hash

    const expiracionAnterior =
      solicitud.expires_at

    const {
      data: solicitudConsumida,
      error: consumirError
    } =
      await this.db
        .from(
          "password_reset_requests"
        )
        .update({
          estado: "completado",
          used_at: fechaUso,
          codigo_hash: null,
          expires_at: null,
          updated_at: fechaUso
        })
        .eq(
          "id",
          solicitud.id
        )
        .eq(
          "estado",
          "aprobado"
        )
        .select(RESET_FIELDS)
        .maybeSingle()

    if (consumirError) {
      throw consumirError
    }

    if (!solicitudConsumida) {
      return {
        tipo: "already_used"
      }
    }

    const {
      data: authData,
      error: authError
    } =
      await this.db
        .auth
        .admin
        .updateUserById(
          solicitud.user_id,
          {
            password:
              nuevaPassword
          }
        )

    if (
      authError ||
      !authData?.user
    ) {
      try {
        const {
          error: rollbackError
        } =
          await this.db
            .from(
              "password_reset_requests"
            )
            .update({
              estado: "aprobado",
              used_at: null,
              codigo_hash:
                hashAnterior,
              expires_at:
                expiracionAnterior,
              updated_at: ahoraISO()
            })
            .eq(
              "id",
              solicitud.id
            )
            .eq(
              "estado",
              "completado"
            )

        if (rollbackError) {
          throw rollbackError
        }
      } catch (rollbackError) {
        console.error(
          "No se pudo restaurar la solicitud de recuperación:",
          rollbackError
        )
      }

      if (authError) {
        throw authError
      }

      throw new Error(
        "Supabase no pudo actualizar la contraseña"
      )
    }

    return {
      tipo: "ok",
      user_id: solicitud.user_id,
      email: correo,
      completed_at: fechaUso
    }
  }
}


export {
  RESET_CODE_MINUTES,
  MAX_ATTEMPTS,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH
}

export default PasswordResetModel