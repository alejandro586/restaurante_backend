import crypto from "crypto"

import {
  adminClient
} from "../config/supabase.js"

const PROJECT_FIELDS =
  "id,nombre,descripcion,estado,visibilidad,creado_por"

const INVITATION_FIELDS =
  "id,project_id,email,role,estado,invitada_por," +
  "aceptada_por,expires_at,accepted_at,created_at,updated_at"

const ROLES_ADMINISTRACION = [
  "owner",
  "manager"
]

class ProjectInvitationModel {
  constructor(user = null) {
    this.user = user
    this.db = adminClient()
  }

  /**
   * Normaliza correos para evitar
   * diferencias por mayusculas.
   */
  normalizarEmail(email) {
    return String(
      email || ""
    )
      .trim()
      .toLowerCase()
  }

  /**
   * Convierte el token original
   * en SHA-256.
   *
   * El token real nunca se almacena.
   */
  hashToken(token) {
    return crypto
      .createHash("sha256")
      .update(
        String(token || "")
      )
      .digest("hex")
  }

  /**
   * Busca un proyecto.
   */
  async buscarProyecto(
    projectId
  ) {
    const {
      data,
      error
    } = await this.db
      .from("projects")
      .select(
        PROJECT_FIELDS
      )
      .eq(
        "id",
        projectId
      )
      .maybeSingle()

    if (error) {
      throw error
    }

    return data
  }

  /**
   * Obtiene el rol del usuario
   * dentro de un proyecto.
   */
  async rolEnProyecto(
    projectId
  ) {
    if (!this.user) {
      return null
    }

    const {
      data,
      error
    } = await this.db
      .from("project_members")
      .select("role")
      .eq(
        "project_id",
        projectId
      )
      .eq(
        "user_id",
        this.user.id
      )
      .maybeSingle()

    if (error) {
      throw error
    }

    if (data?.role) {
      return data.role
    }

    if (
      this.user.role === "admin"
    ) {
      return "admin"
    }

    return null
  }

  /**
   * Comprueba si el usuario
   * puede administrar miembros
   * e invitaciones del proyecto.
   */
  async puedeAdministrarProyecto(
    proyecto
  ) {
    if (
      !this.user ||
      !proyecto
    ) {
      return false
    }

    if (
      this.user.role === "admin"
    ) {
      return true
    }

    if (
      proyecto.creado_por ===
      this.user.id
    ) {
      return true
    }

    const rol =
      await this.rolEnProyecto(
        proyecto.id
      )

    return (
      ROLES_ADMINISTRACION.includes(
        rol
      )
    )
  }

  /**
   * Lista las invitaciones
   * de un proyecto.
   */
  async listar(
    projectId
  ) {
    const proyecto =
      await this.buscarProyecto(
        projectId
      )

    if (!proyecto) {
      return {
        tipo: "not_found"
      }
    }

    if (
      !(await this.puedeAdministrarProyecto(
        proyecto
      ))
    ) {
      return {
        tipo: "forbidden"
      }
    }

    /**
     * Expiramos automaticamente
     * invitaciones vencidas.
     */
    await this.db.rpc(
      "expirar_invitaciones"
    )

    const {
      data,
      error
    } = await this.db
      .from("invitations")
      .select(
        INVITATION_FIELDS
      )
      .eq(
        "project_id",
        projectId
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      )

    if (error) {
      throw error
    }

    return {
      tipo: "ok",
      invitaciones:
        data || []
    }
  }

  /**
   * Crea una nueva invitacion.
   *
   * tokenHash debe ser el hash
   * del token generado por el
   * controlador.
   */
  async crear(
    projectId,
    datos
  ) {
    const proyecto =
      await this.buscarProyecto(
        projectId
      )

    if (!proyecto) {
      return {
        tipo: "not_found"
      }
    }

    if (
      !(await this.puedeAdministrarProyecto(
        proyecto
      ))
    ) {
      return {
        tipo: "forbidden"
      }
    }

    const email =
      this.normalizarEmail(
        datos.email
      )

    /**
     * Revisamos si ese correo
     * ya pertenece a un usuario
     * registrado.
     */
    const {
      data: perfilExistente,
      error: profileError
    } = await this.db
      .from("profiles")
      .select(
        "id,email,full_name,role"
      )
      .ilike(
        "email",
        email
      )
      .maybeSingle()

    if (profileError) {
      throw profileError
    }

    /**
     * Si existe el usuario,
     * comprobamos que no pertenezca
     * ya al proyecto.
     */
    if (
      perfilExistente?.id
    ) {
      const {
        data: membresia,
        error: memberError
      } = await this.db
        .from("project_members")
        .select(
          "id,role"
        )
        .eq(
          "project_id",
          projectId
        )
        .eq(
          "user_id",
          perfilExistente.id
        )
        .maybeSingle()

      if (memberError) {
        throw memberError
      }

      if (membresia) {
        return {
          tipo:
            "already_member"
        }
      }
    }

    /**
     * Revisamos si ya existe
     * una invitacion pendiente.
     */
    const {
      data: pendiente,
      error: pendingError
    } = await this.db
      .from("invitations")
      .select(
        "id,email,estado,expires_at"
      )
      .eq(
        "project_id",
        projectId
      )
      .ilike(
        "email",
        email
      )
      .eq(
        "estado",
        "pendiente"
      )
      .maybeSingle()

    if (pendingError) {
      throw pendingError
    }

    if (pendiente) {
      /**
       * Si ya vencio, la marcamos
       * como expirada para permitir
       * una nueva invitacion.
       */
      const vencida =
        new Date(
          pendiente.expires_at
        ).getTime() <
        Date.now()

      if (vencida) {
        const {
          error
        } = await this.db
          .from("invitations")
          .update({
            estado:
              "expirada"
          })
          .eq(
            "id",
            pendiente.id
          )

        if (error) {
          throw error
        }
      } else {
        return {
          tipo:
            "already_invited"
        }
      }
    }

    const {
      data: invitacion,
      error
    } = await this.db
      .from("invitations")
      .insert({
        project_id:
          projectId,

        email,

        role:
          datos.role,

        token_hash:
          datos.tokenHash,

        estado:
          "pendiente",

        invitada_por:
          this.user.id,

        expires_at:
          datos.expiresAt
      })
      .select(
        INVITATION_FIELDS
      )
      .single()

    if (error) {
      throw error
    }

    return {
      tipo: "ok",

      invitacion,

      proyecto,

      usuario_existente:
        perfilExistente || null
    }
  }

  /**
   * Obtiene informacion publica
   * limitada de una invitacion.
   *
   * Se utiliza al abrir el enlace
   * enviado por correo.
   */
  async obtenerPorToken(
    token
  ) {
    if (!token) {
      return {
        tipo: "invalid_token"
      }
    }

    const tokenHash =
      this.hashToken(token)

    const {
      data: invitacion,
      error
    } = await this.db
      .from("invitations")
      .select(
        INVITATION_FIELDS
      )
      .eq(
        "token_hash",
        tokenHash
      )
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!invitacion) {
      return {
        tipo: "invalid_token"
      }
    }

    /**
     * Invitacion vencida.
     */
    if (
      invitacion.estado ===
        "pendiente" &&
      new Date(
        invitacion.expires_at
      ).getTime() <
        Date.now()
    ) {
      await this.db
        .from("invitations")
        .update({
          estado:
            "expirada"
        })
        .eq(
          "id",
          invitacion.id
        )

      invitacion.estado =
        "expirada"
    }

    const proyecto =
      await this.buscarProyecto(
        invitacion.project_id
      )

    if (!proyecto) {
      return {
        tipo:
          "project_not_found"
      }
    }

    /**
     * Obtenemos informacion
     * basica de quien invito.
     */
    const {
      data: invitador
    } = await this.db
      .from("profiles")
      .select(
        "id,full_name,email"
      )
      .eq(
        "id",
        invitacion.invitada_por
      )
      .maybeSingle()

    return {
      tipo: "ok",

      invitacion: {
        id:
          invitacion.id,

        email:
          invitacion.email,

        role:
          invitacion.role,

        estado:
          invitacion.estado,

        expires_at:
          invitacion.expires_at,

        created_at:
          invitacion.created_at
      },

      proyecto: {
        id:
          proyecto.id,

        nombre:
          proyecto.nombre,

        descripcion:
          proyecto.descripcion
      },

      invitador:
        invitador || null
    }
  }

  /**
   * Acepta una invitacion.
   *
   * Requiere usuario autenticado.
   */
  async aceptar(
    token
  ) {
    if (!this.user) {
      return {
        tipo:
          "unauthenticated"
      }
    }

    const tokenHash =
      this.hashToken(token)

    const {
      data: invitacion,
      error
    } = await this.db
      .from("invitations")
      .select(
        INVITATION_FIELDS
      )
      .eq(
        "token_hash",
        tokenHash
      )
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!invitacion) {
      return {
        tipo:
          "invalid_token"
      }
    }

    if (
      invitacion.estado ===
      "aceptada"
    ) {
      return {
        tipo:
          "already_accepted"
      }
    }

    if (
      invitacion.estado !==
      "pendiente"
    ) {
      return {
        tipo:
          "not_pending"
      }
    }

    if (
      new Date(
        invitacion.expires_at
      ).getTime() <
      Date.now()
    ) {
      await this.db
        .from("invitations")
        .update({
          estado:
            "expirada"
        })
        .eq(
          "id",
          invitacion.id
        )

      return {
        tipo:
          "expired"
      }
    }

    const emailUsuario =
      this.normalizarEmail(
        this.user.email
      )

    const emailInvitacion =
      this.normalizarEmail(
        invitacion.email
      )

    /**
     * La cuenta que acepta debe
     * utilizar exactamente el correo
     * al que se envio la invitacion.
     */
    if (
      emailUsuario !==
      emailInvitacion
    ) {
      return {
        tipo:
          "wrong_email",

        expected_email:
          emailInvitacion
      }
    }

    const proyecto =
      await this.buscarProyecto(
        invitacion.project_id
      )

    if (!proyecto) {
      return {
        tipo:
          "project_not_found"
      }
    }

    /**
     * Comprobamos membresia actual.
     */
    const {
      data: membresiaActual,
      error: memberFindError
    } = await this.db
      .from("project_members")
      .select(
        "id,role"
      )
      .eq(
        "project_id",
        invitacion.project_id
      )
      .eq(
        "user_id",
        this.user.id
      )
      .maybeSingle()

    if (memberFindError) {
      throw memberFindError
    }

    if (
      membresiaActual
    ) {
      /**
       * Nunca cambiamos owner
       * mediante una invitacion.
       */
      if (
        membresiaActual.role !==
        "owner"
      ) {
        const {
          error:
            updateMemberError
        } = await this.db
          .from(
            "project_members"
          )
          .update({
            role:
              invitacion.role
          })
          .eq(
            "id",
            membresiaActual.id
          )

        if (
          updateMemberError
        ) {
          throw updateMemberError
        }
      }
    } else {
      const {
        error:
          insertMemberError
      } = await this.db
        .from(
          "project_members"
        )
        .insert({
          project_id:
            invitacion.project_id,

          user_id:
            this.user.id,

          role:
            invitacion.role
        })

      if (
        insertMemberError
      ) {
        throw insertMemberError
      }
    }

    /**
     * Marcamos invitacion aceptada.
     */
    const ahora =
      new Date().toISOString()

    const {
      error:
        invitationUpdateError
    } = await this.db
      .from("invitations")
      .update({
        estado:
          "aceptada",

        aceptada_por:
          this.user.id,

        accepted_at:
          ahora
      })
      .eq(
        "id",
        invitacion.id
      )

    if (
      invitationUpdateError
    ) {
      throw invitationUpdateError
    }

    return {
      tipo: "ok",

      project_id:
        invitacion.project_id,

      role:
        membresiaActual?.role ===
        "owner"
          ? "owner"
          : invitacion.role,

      proyecto
    }
  }

  /**
   * Rechaza una invitacion.
   */
  async rechazar(
    token
  ) {
    if (!this.user) {
      return {
        tipo:
          "unauthenticated"
      }
    }

    const tokenHash =
      this.hashToken(token)

    const {
      data: invitacion,
      error
    } = await this.db
      .from("invitations")
      .select(
        INVITATION_FIELDS
      )
      .eq(
        "token_hash",
        tokenHash
      )
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!invitacion) {
      return {
        tipo:
          "invalid_token"
      }
    }

    if (
      invitacion.estado !==
      "pendiente"
    ) {
      return {
        tipo:
          "not_pending"
      }
    }

    if (
      this.normalizarEmail(
        invitacion.email
      ) !==
      this.normalizarEmail(
        this.user.email
      )
    ) {
      return {
        tipo:
          "wrong_email"
      }
    }

    const {
      error: updateError
    } = await this.db
      .from("invitations")
      .update({
        estado:
          "rechazada"
      })
      .eq(
        "id",
        invitacion.id
      )

    if (updateError) {
      throw updateError
    }

    return {
      tipo: "ok"
    }
  }

  /**
   * Revoca una invitacion pendiente.
   *
   * Solo owner, manager o admin.
   */
  async revocar(
    projectId,
    invitationId
  ) {
    const proyecto =
      await this.buscarProyecto(
        projectId
      )

    if (!proyecto) {
      return {
        tipo:
          "not_found"
      }
    }

    if (
      !(await this.puedeAdministrarProyecto(
        proyecto
      ))
    ) {
      return {
        tipo:
          "forbidden"
      }
    }

    const {
      data: invitacion,
      error
    } = await this.db
      .from("invitations")
      .select(
        "id,project_id,estado"
      )
      .eq(
        "id",
        invitationId
      )
      .eq(
        "project_id",
        projectId
      )
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!invitacion) {
      return {
        tipo:
          "invitation_not_found"
      }
    }

    if (
      invitacion.estado !==
      "pendiente"
    ) {
      return {
        tipo:
          "not_pending"
      }
    }

    const {
      error: updateError
    } = await this.db
      .from("invitations")
      .update({
        estado:
          "revocada"
      })
      .eq(
        "id",
        invitationId
      )

    if (updateError) {
      throw updateError
    }

    return {
      tipo: "ok"
    }
  }
}

export default ProjectInvitationModel