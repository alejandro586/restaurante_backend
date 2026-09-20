import {
  adminClient
} from "../config/supabase.js"


class FacialModel {
  constructor(user) {
    this.user = user
    this.db = adminClient()
  }


  async guardarAnalisis({
    expressionKey,
    expressionLabel,
    confidence,
    source,
    provider,
    predictions
  }) {
    const payload = {
      user_id:
        this.user.id,

      user_email:
        this.user.email || null,

      user_name:
        this.user.full_name || null,

      user_role:
        this.user.role || null,

      empresa:
        this.user.empresa || null,

      expression_key:
        expressionKey,

      expression_label:
        expressionLabel,

      confidence:
        confidence,

      source,
      provider,

      predictions:
        Array.isArray(predictions)
          ? predictions
          : []
    }

    const {
      data,
      error
    } =
      await this.db
        .from("facial_analyses")
        .insert(payload)
        .select(
          "id,user_id,user_email,user_name,user_role,empresa,expression_key,expression_label,confidence,source,provider,created_at"
        )
        .single()

    if (error) {
      throw error
    }

    return data
  }


  async historial(
    limite = 100
  ) {
    const cantidad =
      Math.max(
        1,
        Math.min(
          200,
          Number(limite || 100)
        )
      )

    let consulta =
      this.db
        .from("facial_analyses")
        .select(
          "id,user_id,user_email,user_name,user_role,empresa,expression_key,expression_label,confidence,source,provider,created_at"
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(cantidad)

    if (
      this.user.role !==
      "admin"
    ) {
      consulta =
        consulta.eq(
          "user_id",
          this.user.id
        )
    }

    const {
      data,
      error
    } = await consulta

    if (error) {
      throw error
    }

    return data || []
  }


  async estadisticas() {
    let consulta =
      this.db
        .from("facial_analyses")
        .select(
          "user_id,expression_key,expression_label,confidence"
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(5000)

    if (
      this.user.role !==
      "admin"
    ) {
      consulta =
        consulta.eq(
          "user_id",
          this.user.id
        )
    }

    const {
      data,
      error
    } = await consulta

    if (error) {
      throw error
    }

    const filas =
      data || []

    const usuarios =
      new Set()

    const mapa =
      new Map()

    let sumaConfianza = 0

    for (const fila of filas) {
      if (fila.user_id) {
        usuarios.add(
          fila.user_id
        )
      }

      const clave =
        String(
          fila.expression_key ||
          "sin_clasificar"
        )

      if (!mapa.has(clave)) {
        mapa.set(
          clave,
          {
            expresion_key:
              clave,
            expresion_label:
              fila.expression_label ||
              clave,
            cantidad: 0
          }
        )
      }

      mapa.get(clave).cantidad += 1

      sumaConfianza +=
        Number(
          fila.confidence || 0
        )
    }

    return {
      total:
        filas.length,

      usuarios:
        usuarios.size,

      confianza_promedio:
        filas.length > 0
          ? sumaConfianza /
            filas.length
          : 0,

      distribucion:
        [
          ...mapa.values()
        ]
          .sort(
            (a, b) =>
              b.cantidad -
              a.cantidad
          )
    }
  }
}


export default FacialModel
