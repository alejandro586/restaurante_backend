import { adminClient } from "../config/supabase.js"

const CAMPOS =
  "id,titulo,mensaje,nivel,columna_sugerida,tipo_sugerido,ejemplo,origen," +
  "tabla_destino,estado,asignada_a,asignada_por,created_at,completada_at,cierre"

/**
 * Tareas que el administrador asigna. El trabajador las lee y las cierra
 * desde su propio modulo, contra la base; aqui solo esta el lado del
 * administrador, que es quien las crea y sigue su avance.
 */
class TareaModel {
  constructor(user) {
    this.user = user
    this.db = adminClient()
  }

  /** Trabajadores a los que se puede asignar. */
  async trabajadores() {
    const { data, error } = await this.db
      .from("profiles")
      .select("id,email,full_name,empresa")
      .eq("role", "trabajador")
      .order("full_name", { ascending: true })

    if (error) throw error

    return data.map((perfil) => ({
      id: perfil.id,
      nombre: perfil.full_name || perfil.email.split("@")[0],
      email: perfil.email,
      empresa: perfil.empresa
    }))
  }

  async crear(tarea) {
    const { data, error } = await this.db
      .from("tareas")
      .insert({ ...tarea, asignada_por: this.user.id })
      .select(CAMPOS)
      .single()

    if (error) throw error
    return data
  }

  /** Todas las tareas asignadas, para que el admin vea el avance. */
  async listar() {
    const { data, error } = await this.db
      .from("tareas")
      .select(CAMPOS)
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) throw error
    return data
  }

  async eliminar(id) {
    const { error } = await this.db.from("tareas").delete().eq("id", id)
    if (error) throw error
    return true
  }

  /** Nombres de los destinatarios, para mostrarlos junto a cada tarea. */
  async nombres(ids) {
    if (ids.length === 0) return {}

    const { data, error } = await this.db
      .from("profiles")
      .select("id,full_name,email")
      .in("id", ids)

    if (error) throw error

    const mapa = {}
    data.forEach((perfil) => {
      mapa[perfil.id] = perfil.full_name || perfil.email
    })

    return mapa
  }
}

export default TareaModel
