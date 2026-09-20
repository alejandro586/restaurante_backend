import crypto from "node:crypto"

import { adminClient } from "../config/supabase.js"

/* ==========================================================
   CONFIGURACION
   ========================================================== */

const DIAS_EXPIRACION = 7
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 128

const PROFILE_FIELDS =
  "id,email,full_name,role,empresa,activo,created_at"

/* ==========================================================
   UTILIDADES
   ========================================================== */

const ahoraISO = () => new Date().toISOString()

/**
 * Token de alta entropia (32 bytes).
 *
 * Este SI se manda por correo, pero
 * NUNCA se guarda en la base tal cual.
 */
const generarToken = () =>
  crypto.randomBytes(32).toString("base64url")

/**
 * Hash del token para guardarlo.
 *
 * A diferencia del codigo de 6 digitos de
 * PasswordResetModel, aqui no hace falta HMAC
 * con secreto: el token ya trae 256 bits propios
 * de entropia, asi que un SHA-256 simple alcanza
 * para que la base nunca guarde el valor usable.
 */
const hashToken = (token) =>
  crypto
    .createHash("sha256")
    .update(String(token || ""))
    .digest("hex")

const generarExpiracion = () => {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + DIAS_EXPIRACION)
  return fecha.toISOString()
}

/* ==========================================================
   MODELO
   ========================================================== */

class AccountActivationModel {
  constructor() {
    this.db = adminClient()
  }

  /* ========================================================
     CREAR TOKEN DE ACTIVACION
     ========================================================

     La llama UserAdminModel.crearUsuario justo despues
     de crear la cuenta en Supabase Auth y el perfil.

     Devuelve el token EN CRUDO una sola vez, para que
     el llamador se lo pase a MailService. No queda
     guardado en ningun lado despues de esto.
  */
  async crear({ userId, email }) {
    const token = generarToken()
    const tokenHash = hashToken(token)
    const expiresAt = generarExpiracion()

    /*
     * Si el admin ya habia creado una activacion
     * pendiente para este usuario (por ejemplo, va a
     * reenviar el correo), invalidamos las anteriores
     * para que solo el ultimo link funcione.
     */
    const { error: invalidarError } = await this.db
      .from("account_activations")
      .update({ used_at: ahoraISO() })
      .eq("user_id", userId)
      .is("used_at", null)

    if (invalidarError) {
      throw invalidarError
    }

    const { data, error } = await this.db
      .from("account_activations")
      .insert({
        user_id: userId,
        email,
        token_hash: tokenHash,
        expires_at: expiresAt,
        used_at: null,
        created_at: ahoraISO()
      })
      .select("id,expires_at")
      .single()

    if (error) {
      throw error
    }

    return {
      token,
      expiresAt: data.expires_at
    }
  }

  /* ========================================================
     BUSCAR POR TOKEN (VALIDACION COMPARTIDA)
     ======================================================== */

  async buscarPorToken(token) {
    const tokenHash = hashToken(token)

    const { data, error } = await this.db
      .from("account_activations")
      .select("id,user_id,email,expires_at,used_at,created_at")
      .eq("token_hash", tokenHash)
      .maybeSingle()

    if (error) {
      throw error
    }

    return data
  }

  /* ========================================================
     CONSULTA PUBLICA
     ========================================================

     GET /api/activation/:token

     Permite al frontend mostrar el correo asignado
     antes de pedir la contraseña, sin exponer nada
     sensible.
  */
  async obtenerPorToken(token) {
  const activacion = await this.buscarPorToken(token)

  if (!activacion) {
    return { tipo: "invalid_token" }
  }

  if (activacion.used_at) {
    return { tipo: "already_used" }
  }

  if (new Date(activacion.expires_at).getTime() <= Date.now()) {
    return { tipo: "expired" }
  }

  const { data: perfil, error } = await this.db
    .from("profiles")
    .select("email")
    .eq("id", activacion.user_id)
    .maybeSingle()

  if (error) {
    throw error
  }

  return {
    tipo: "ok",
    email: perfil?.email || activacion.email
  }
}

  /* ========================================================
     COMPLETAR ACTIVACION
     ========================================================

     POST /api/activation/:token/complete

     - valida el token
     - fija la contraseña elegida por el empleado
     - marca profiles.activo = true
     - consume el token
  */
  async completar({ token, password, passwordConfirm }) {
    const nuevaPassword = String(password ?? "")
    const confirmacion = String(passwordConfirm ?? "")

    if (nuevaPassword.length < MIN_PASSWORD_LENGTH) {
      return { tipo: "password_too_short" }
    }

    if (nuevaPassword.length > MAX_PASSWORD_LENGTH) {
      return { tipo: "password_too_long" }
    }

    if (nuevaPassword !== confirmacion) {
      return { tipo: "password_mismatch" }
    }

    const activacion = await this.buscarPorToken(token)

    if (!activacion) {
      return { tipo: "invalid_token" }
    }

    if (activacion.used_at) {
      return { tipo: "already_used" }
    }

    if (new Date(activacion.expires_at).getTime() <= Date.now()) {
      return { tipo: "expired" }
    }

    /*
     * Consumimos el token ANTES de tocar Auth, igual que
     * hace PasswordResetModel, para impedir que el mismo
     * link se use dos veces en simultaneo.
     */
    const fechaUso = ahoraISO()

    const { data: consumido, error: consumirError } = await this.db
      .from("account_activations")
      .update({ used_at: fechaUso })
      .eq("id", activacion.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle()

    if (consumirError) {
      throw consumirError
    }

    if (!consumido) {
      return { tipo: "already_used" }
    }

    const { data: authData, error: authError } = await this.db.auth.admin
      .updateUserById(activacion.user_id, { password: nuevaPassword })

    if (authError || !authData?.user) {
      /*
       * Si Auth falla, devolvemos el token a su estado
       * usable para que el empleado pueda reintentar
       * con el mismo link.
       */
      try {
        await this.db
          .from("account_activations")
          .update({ used_at: null })
          .eq("id", activacion.id)
          .eq("used_at", fechaUso)
      } catch (rollbackError) {
        console.error(
          "No se pudo restaurar el token de activacion tras el fallo de Auth:",
          rollbackError
        )
      }

      if (authError) {
        throw authError
      }

      throw new Error("Supabase no pudo actualizar la contraseña")
    }

    const { data: perfil, error: perfilError } = await this.db
      .from("profiles")
      .update({ activo: true })
      .eq("id", activacion.user_id)
      .select(PROFILE_FIELDS)
      .single()

    if (perfilError) {
      throw perfilError
    }

    return {
      tipo: "ok",
      perfil
    }
  }
}

export { hashToken, generarToken }
export default AccountActivationModel