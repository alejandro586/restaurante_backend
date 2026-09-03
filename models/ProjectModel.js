import { adminClient } from "../config/supabase.js"

const PROJECT_FIELDS =
  "id,nombre,descripcion,estado,visibilidad,creado_por,created_at,updated_at"

const MEMBER_FIELDS =
  "id,project_id,user_id,role,joined_at"

class ProjectModel {
  constructor(user) {
    this.user = user
    this.db = adminClient()
  }

  async listar() {
    if (this.user.role === "admin") {
      const { data, error } = await this.db
        .from("projects")
        .select(PROJECT_FIELDS)
        .order("updated_at", { ascending: false })

      if (error) throw error

      return this.conResumen(data || [])
    }

    const { data: membresias, error: memberError } = await this.db
      .from("project_members")
      .select("project_id")
      .eq("user_id", this.user.id)

    if (memberError) throw memberError

    const ids = [
      ...new Set((membresias || []).map((m) => m.project_id))
    ]

    const { data: propios, error: ownError } = await this.db
      .from("projects")
      .select(PROJECT_FIELDS)
      .eq("creado_por", this.user.id)

    if (ownError) throw ownError

    let compartidos = []

    if (ids.length > 0) {
      const { data, error } = await this.db
        .from("projects")
        .select(PROJECT_FIELDS)
        .in("id", ids)

      if (error) throw error

      compartidos = data || []
    }

    const mapa = new Map()

    for (const proyecto of [...(propios || []), ...compartidos]) {
      mapa.set(proyecto.id, proyecto)
    }

    const proyectos = [...mapa.values()].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() -
        new Date(a.updated_at).getTime()
    )

    return this.conResumen(proyectos)
  }

  async obtener(id) {
    const proyecto = await this.buscarProyecto(id)

    if (!proyecto) {
      return null
    }

    const tieneAcceso = await this.puedeVer(proyecto)

    if (!tieneAcceso) {
      return null
    }

    const [miembros, tareas] = await Promise.all([
      this.listarMiembros(id),
      this.contarTareas(id)
    ])

    return {
      ...proyecto,
      total_miembros: miembros.length,
      total_tareas: tareas.total,
      tareas_pendientes: tareas.pendientes,
      mi_rol: await this.rolEnProyecto(id)
    }
  }

  async crear(payload) {
    const { data: proyecto, error } = await this.db
      .from("projects")
      .insert({
        nombre: payload.nombre,
        descripcion: payload.descripcion || null,
        estado: payload.estado || "activo",
        visibilidad: payload.visibilidad || "privado",
        creado_por: this.user.id
      })
      .select(PROJECT_FIELDS)
      .single()

    if (error) {
      throw error
    }

    const { error: memberError } = await this.db
      .from("project_members")
      .insert({
        project_id: proyecto.id,
        user_id: this.user.id,
        role: "owner"
      })

    if (memberError) {
      await this.db
        .from("projects")
        .delete()
        .eq("id", proyecto.id)

      throw memberError
    }

    return {
      ...proyecto,
      total_miembros: 1,
      total_tareas: 0,
      tareas_pendientes: 0,
      mi_rol: "owner"
    }
  }

  async actualizar(id, cambios) {
    const proyecto = await this.buscarProyecto(id)

    if (!proyecto) {
      return {
        tipo: "not_found"
      }
    }

    const puedeAdministrar =
      await this.puedeAdministrar(proyecto)

    if (!puedeAdministrar) {
      return {
        tipo: "forbidden"
      }
    }

    const { data, error } = await this.db
      .from("projects")
      .update(cambios)
      .eq("id", id)
      .select(PROJECT_FIELDS)
      .single()

    if (error) {
      throw error
    }

    return {
      tipo: "ok",
      proyecto: data
    }
  }

  async eliminar(id) {
    const proyecto = await this.buscarProyecto(id)

    if (!proyecto) {
      return {
        tipo: "not_found"
      }
    }

    if (
      this.user.role !== "admin" &&
      proyecto.creado_por !== this.user.id
    ) {
      return {
        tipo: "forbidden"
      }
    }

    const { error } = await this.db
      .from("projects")
      .delete()
      .eq("id", id)

    if (error) {
      throw error
    }

    return {
      tipo: "ok"
    }
  }

  async listarMiembros(projectId) {
    const { data: members, error } = await this.db
      .from("project_members")
      .select(MEMBER_FIELDS)
      .eq("project_id", projectId)
      .order("joined_at", { ascending: true })

    if (error) {
      throw error
    }

    if (!members?.length) {
      return []
    }

    const userIds = [
      ...new Set(
        members.map((member) => member.user_id)
      )
    ]

    const { data: perfiles, error: profileError } =
      await this.db
        .from("profiles")
        .select(
          "id,email,full_name,role,empresa"
        )
        .in("id", userIds)

    if (profileError) {
      throw profileError
    }

    const perfilesPorId = new Map(
      (perfiles || []).map((perfil) => [
        perfil.id,
        perfil
      ])
    )

    return members.map((member) => ({
      ...member,
      perfil:
        perfilesPorId.get(member.user_id) ||
        null
    }))
  }

  async conResumen(proyectos) {
    if (proyectos.length === 0) {
      return []
    }

    const ids = proyectos.map(
      (proyecto) => proyecto.id
    )

    const [
      {
        data: miembros,
        error: memberError
      },
      {
        data: tareas,
        error: taskError
      }
    ] = await Promise.all([
      this.db
        .from("project_members")
        .select("project_id,user_id")
        .in("project_id", ids),

      this.db
        .from("tareas")
        .select("project_id,estado")
        .in("project_id", ids)
    ])

    if (memberError) {
      throw memberError
    }

    if (taskError) {
      throw taskError
    }

    const resumen = new Map()

    for (const id of ids) {
      resumen.set(id, {
        miembros: 0,
        tareas: 0,
        pendientes: 0
      })
    }

    for (const miembro of miembros || []) {
      const item = resumen.get(
        miembro.project_id
      )

      if (item) {
        item.miembros += 1
      }
    }

    for (const tarea of tareas || []) {
      const item = resumen.get(
        tarea.project_id
      )

      if (!item) {
        continue
      }

      item.tareas += 1

      const terminada = [
        "completada",
        "cerrada",
        "finalizada"
      ].includes(tarea.estado)

      if (!terminada) {
        item.pendientes += 1
      }
    }

    return Promise.all(
      proyectos.map(async (proyecto) => {
        const item = resumen.get(
          proyecto.id
        )

        return {
          ...proyecto,

          total_miembros:
            item?.miembros || 0,

          total_tareas:
            item?.tareas || 0,

          tareas_pendientes:
            item?.pendientes || 0,

          mi_rol:
            await this.rolEnProyecto(
              proyecto.id
            )
        }
      })
    )
  }

  async contarTareas(projectId) {
    const { data, error } = await this.db
      .from("tareas")
      .select("estado")
      .eq("project_id", projectId)

    if (error) {
      throw error
    }

    const lista = data || []

    const pendientes = lista.filter(
      (tarea) =>
        ![
          "completada",
          "cerrada",
          "finalizada"
        ].includes(tarea.estado)
    ).length

    return {
      total: lista.length,
      pendientes
    }
  }

  async buscarProyecto(id) {
    const { data, error } = await this.db
      .from("projects")
      .select(PROJECT_FIELDS)
      .eq("id", id)
      .maybeSingle()

    if (error) {
      throw error
    }

    return data
  }

  async rolEnProyecto(projectId) {
    const { data, error } = await this.db
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", this.user.id)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (data?.role) {
      return data.role
    }

    if (this.user.role === "admin") {
      return "admin"
    }

    return null
  }

  async puedeVer(proyecto) {
    if (this.user.role === "admin") {
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

    return Boolean(rol)
  }

  async puedeAdministrar(proyecto) {
    if (this.user.role === "admin") {
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

    return [
      "owner",
      "manager"
    ].includes(rol)
  }
}

export default ProjectModel