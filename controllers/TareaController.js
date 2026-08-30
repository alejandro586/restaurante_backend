import TareaModel from "../models/TareaModel.js"
import { sendError } from "../utils/apiError.js"

const NIVELES = ["oportunidad", "alerta", "info"]

class TareaController {
  /** GET /api/tareas/trabajadores */
  async trabajadores(req, res) {
    try {
      const model = new TareaModel(req.user)
      res.json(await model.trabajadores())
    } catch (error) {
      sendError(res, error)
    }
  }

  /** POST /api/tareas  -> convierte un insight en una orden para alguien */
  async crear(req, res) {
    const { titulo, mensaje, nivel, asignadaA, accion, origen } = req.body

    if (!titulo || !mensaje) {
      return res.status(400).json({ error: "La tarea necesita un titulo y un mensaje" })
    }

    if (!asignadaA) {
      return res.status(400).json({ error: "Elige a que trabajador se le asigna" })
    }

    try {
      const model = new TareaModel(req.user)

      // Que el destinatario exista y sea trabajador se verifica aqui: el
      // id llega del navegador y no se puede dar por bueno.
      const trabajadores = await model.trabajadores()

      if (!trabajadores.some((t) => t.id === asignadaA)) {
        return res.status(400).json({ error: "El trabajador indicado no existe" })
      }

      const tarea = await model.crear({
        titulo: String(titulo).slice(0, 300),
        mensaje: String(mensaje).slice(0, 2000),
        nivel: NIVELES.includes(nivel) ? nivel : "info",
        columna_sugerida: accion?.columna || null,
        tipo_sugerido: accion?.tipoDato || null,
        ejemplo: accion?.ejemplo || null,
        origen: origen ? String(origen).slice(0, 120) : null,
        asignada_a: asignadaA
      })

      res.json(tarea)
    } catch (error) {
      sendError(res, error)
    }
  }

  /** GET /api/tareas  -> avance de todo lo asignado */
  async listar(req, res) {
    try {
      const model = new TareaModel(req.user)
      const lista = await model.listar()
      const nombres = await model.nombres([...new Set(lista.map((t) => t.asignada_a))])

      res.json(
        lista.map((tarea) => ({
          ...tarea,
          destinatario: nombres[tarea.asignada_a] || "Desconocido"
        }))
      )
    } catch (error) {
      sendError(res, error)
    }
  }

  /** DELETE /api/tareas/:id */
  async eliminar(req, res) {
    try {
      const model = new TareaModel(req.user)
      await model.eliminar(req.params.id)
      res.json({ eliminado: true })
    } catch (error) {
      sendError(res, error)
    }
  }
}

const controller = new TareaController()

export default {
  trabajadores: controller.trabajadores.bind(controller),
  crear: controller.crear.bind(controller),
  listar: controller.listar.bind(controller),
  eliminar: controller.eliminar.bind(controller)
}
