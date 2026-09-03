import { adminClient } from "../config/supabase.js"

const TASK_FIELDS =
  "id,project_id,titulo,mensaje,nivel," +
  "columna_sugerida,tipo_sugerido,ejemplo,origen," +
  "tabla_destino,estado,prioridad,fecha_limite," +
  "asignada_a,asignada_por,created_at,updated_at," +
  "completada_at,cierre"

const PROJECT_FIELDS =
  "id,nombre,descripcion,estado,visibilidad,creado_por"

const ROLES_ADMINISTRACION = [
  "owner",
  "manager"
]

const ESTADOS_TERMINADOS = [
  "completada"
]

class ProjectTaskModel {
  constructor(user) {
    this.user = user
    this.db = adminClient()
  }

  /**
   * Busca el proyecto.
   */
  async buscarProyecto(projectId) {
    const {
      data,
      error
    } = await this.db
      .from("projects")
      .select(PROJECT_FIELDS)
      .eq("id", projectId)
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
  async rolEnProyecto(projectId) {
    const {
      data,
      error
    } = await this.db
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

  /**
   * Comprueba si el usuario puede
   * visualizar el proyecto.
   */
  async puedeVerProyecto(proyecto) {
    if (!proyecto) {
      return false
    }

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

  /**
   * Comprueba si puede crear,
   * editar y asignar actividades.
   *
   * Permitidos:
   * - administrador general
   * - creador del proyecto
   * - owner
   * - manager
   */
  async puedeAdministrarProyecto(
    proyecto
  ) {
    if (!proyecto) {
      return false
    }

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

    return ROLES_ADMINISTRACION.includes(
      rol
    )
  }

  /**
   * Lista las actividades
   * pertenecientes al proyecto.
   */
  async listar(projectId) {
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
      !(await this.puedeVerProyecto(
        proyecto
      ))
    ) {
      return {
        tipo: "forbidden"
      }
    }

    const {
      data,
      error
    } = await this.db
      .from("tareas")
      .select(TASK_FIELDS)
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

    const tareas = data || []

    const usuariosIds = [
      ...new Set(
        tareas
          .flatMap(
            (tarea) => [
              tarea.asignada_a,
              tarea.asignada_por
            ]
          )
          .filter(Boolean)
      )
    ]

    const perfiles =
      await this.obtenerPerfiles(
        usuariosIds
      )

    return {
      tipo: "ok",

      tareas:
        tareas.map(
          (tarea) => ({
            ...tarea,

            asignado:
              perfiles[
                tarea.asignada_a
              ] || null,

            creador:
              perfiles[
                tarea.asignada_por
              ] || null
          })
        )
    }
  }

  /**
   * Obtiene una actividad concreta.
   */
  async obtener(
    projectId,
    taskId
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
      !(await this.puedeVerProyecto(
        proyecto
      ))
    ) {
      return {
        tipo: "forbidden"
      }
    }

    const {
      data: tarea,
      error
    } = await this.db
      .from("tareas")
      .select(TASK_FIELDS)
      .eq(
        "project_id",
        projectId
      )
      .eq(
        "id",
        taskId
      )
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!tarea) {
      return {
        tipo: "not_found_task"
      }
    }

    const perfiles =
      await this.obtenerPerfiles(
        [
          tarea.asignada_a,
          tarea.asignada_por
        ].filter(Boolean)
      )

    return {
      tipo: "ok",

      tarea: {
        ...tarea,

        asignado:
          perfiles[
            tarea.asignada_a
          ] || null,

        creador:
          perfiles[
            tarea.asignada_por
          ] || null
      }
    }
  }

  /**
   * Lista miembros disponibles
   * para asignar actividades.
   */
  async miembrosAsignables(
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
      !(await this.puedeVerProyecto(
        proyecto
      ))
    ) {
      return {
        tipo: "forbidden"
      }
    }

    const {
      data: miembros,
      error
    } = await this.db
      .from("project_members")
      .select(
        "id,user_id,role,joined_at"
      )
      .eq(
        "project_id",
        projectId
      )
      .order(
        "joined_at",
        {
          ascending: true
        }
      )

    if (error) {
      throw error
    }

    if (!miembros?.length) {
      return {
        tipo: "ok",
        miembros: []
      }
    }

    const usuariosIds =
      miembros.map(
        (miembro) =>
          miembro.user_id
      )

    const perfiles =
      await this.obtenerPerfiles(
        usuariosIds
      )

    /**
     * viewer tiene acceso de lectura,
     * por eso no recibe actividades.
     */
    const asignables =
      miembros
        .filter(
          (miembro) =>
            miembro.role !== "viewer"
        )
        .map(
          (miembro) => ({
            id:
              miembro.user_id,

            membership_id:
              miembro.id,

            role:
              miembro.role,

            nombre:
              perfiles[
                miembro.user_id
              ]?.full_name ||
              perfiles[
                miembro.user_id
              ]?.email ||
              "Usuario",

            email:
              perfiles[
                miembro.user_id
              ]?.email ||
              "",

            empresa:
              perfiles[
                miembro.user_id
              ]?.empresa ||
              null
          })
        )

    return {
      tipo: "ok",
      miembros: asignables
    }
  }

  /**
   * Crea una actividad.
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

    const miembroValido =
      await this.esMiembroAsignable(
        projectId,
        datos.asignada_a
      )

    if (!miembroValido) {
      return {
        tipo:
          "invalid_assignee"
      }
    }

    const {
      data: tarea,
      error
    } = await this.db
      .from("tareas")
      .insert({
        project_id:
          projectId,

        titulo:
          datos.titulo,

        mensaje:
          datos.mensaje,

        nivel:
          datos.nivel ||
          "info",

        estado:
          datos.estado ||
          "pendiente",

        prioridad:
          datos.prioridad ||
          "media",

        fecha_limite:
          datos.fecha_limite ||
          null,

        asignada_a:
          datos.asignada_a,

        asignada_por:
          this.user.id,

        origen:
          datos.origen ||
          "proyecto"
      })
      .select(TASK_FIELDS)
      .single()

    if (error) {
      throw error
    }

    const perfiles =
      await this.obtenerPerfiles(
        [
          tarea.asignada_a,
          tarea.asignada_por
        ]
      )

    return {
      tipo: "ok",

      tarea: {
        ...tarea,

        asignado:
          perfiles[
            tarea.asignada_a
          ] || null,

        creador:
          perfiles[
            tarea.asignada_por
          ] || null
      }
    }
  }

  /**
   * Actualiza una actividad.
   */
  async actualizar(
    projectId,
    taskId,
    cambios
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

    const {
      data: tareaActual,
      error: taskError
    } = await this.db
      .from("tareas")
      .select(TASK_FIELDS)
      .eq(
        "project_id",
        projectId
      )
      .eq(
        "id",
        taskId
      )
      .maybeSingle()

    if (taskError) {
      throw taskError
    }

    if (!tareaActual) {
      return {
        tipo: "not_found_task"
      }
    }

    const administra =
      await this.puedeAdministrarProyecto(
        proyecto
      )

    const esAsignado =
      tareaActual.asignada_a ===
      this.user.id

    /**
     * Administradores pueden modificar todo.
     *
     * El usuario asignado puede cambiar
     * solamente el estado.
     */
    if (
      !administra &&
      !esAsignado
    ) {
      return {
        tipo: "forbidden"
      }
    }

    if (
      !administra &&
      esAsignado
    ) {
      const campos =
        Object.keys(cambios)

      const permitidos = [
        "estado"
      ]

      const campoInvalido =
        campos.some(
          (campo) =>
            !permitidos.includes(
              campo
            )
        )

      if (campoInvalido) {
        return {
          tipo:
            "forbidden_fields"
        }
      }
    }

    if (
      cambios.asignada_a
    ) {
      const miembroValido =
        await this.esMiembroAsignable(
          projectId,
          cambios.asignada_a
        )

      if (!miembroValido) {
        return {
          tipo:
            "invalid_assignee"
        }
      }
    }

    /**
     * Control de fecha de finalizacion.
     */
    if (
      cambios.estado ===
      "completada"
    ) {
      cambios.completada_at =
        new Date().toISOString()

      cambios.cierre =
        "manual"
    }

    if (
      cambios.estado &&
      !ESTADOS_TERMINADOS.includes(
        cambios.estado
      )
    ) {
      cambios.completada_at =
        null

      cambios.cierre =
        null
    }

    const {
      data,
      error
    } = await this.db
      .from("tareas")
      .update(cambios)
      .eq(
        "project_id",
        projectId
      )
      .eq(
        "id",
        taskId
      )
      .select(TASK_FIELDS)
      .single()

    if (error) {
      throw error
    }

    const perfiles =
      await this.obtenerPerfiles(
        [
          data.asignada_a,
          data.asignada_por
        ]
      )

    return {
      tipo: "ok",

      tarea: {
        ...data,

        asignado:
          perfiles[
            data.asignada_a
          ] || null,

        creador:
          perfiles[
            data.asignada_por
          ] || null
      }
    }
  }

  /**
   * Elimina una actividad.
   */
  async eliminar(
    projectId,
    taskId
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

    const {
      data: tarea,
      error: findError
    } = await this.db
      .from("tareas")
      .select("id")
      .eq(
        "project_id",
        projectId
      )
      .eq(
        "id",
        taskId
      )
      .maybeSingle()

    if (findError) {
      throw findError
    }

    if (!tarea) {
      return {
        tipo:
          "not_found_task"
      }
    }

    const {
      error
    } = await this.db
      .from("tareas")
      .delete()
      .eq(
        "project_id",
        projectId
      )
      .eq(
        "id",
        taskId
      )

    if (error) {
      throw error
    }

    return {
      tipo: "ok"
    }
  }

  /**
   * Comprueba si el usuario
   * pertenece al proyecto y
   * puede recibir actividades.
   */
  async esMiembroAsignable(
    projectId,
    userId
  ) {
    if (!userId) {
      return false
    }

    const {
      data,
      error
    } = await this.db
      .from("project_members")
      .select(
        "user_id,role"
      )
      .eq(
        "project_id",
        projectId
      )
      .eq(
        "user_id",
        userId
      )
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return false
    }

    return (
      data.role !== "viewer"
    )
  }

  /**
   * Obtiene perfiles en formato:
   *
   * {
   *   userId: {
   *     id,
   *     email,
   *     full_name,
   *     role,
   *     empresa
   *   }
   * }
   */
  async obtenerPerfiles(ids) {
    const unicos = [
      ...new Set(
        (ids || []).filter(Boolean)
      )
    ]

    if (
      unicos.length === 0
    ) {
      return {}
    }

    const {
      data,
      error
    } = await this.db
      .from("profiles")
      .select(
        "id,email,full_name,role,empresa"
      )
      .in(
        "id",
        unicos
      )

    if (error) {
      throw error
    }

    const resultado = {}

    for (
      const perfil
      of data || []
    ) {
      resultado[
        perfil.id
      ] = perfil
    }

    return resultado
  }
}

export default ProjectTaskModel