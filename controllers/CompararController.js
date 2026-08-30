import ImportModel from "../models/ImportModel.js"
import Comparador from "../utils/Comparador.js"
import Insight from "../utils/Insight.js"
import { sendError } from "../utils/apiError.js"

class CompararController {
  /**
   * POST /api/comparar { ids: [a] | [a, b] }
   * Con un id devuelve el analisis del archivo. Con dos, los grafica
   * enfrentados y explica la diferencia.
   */
  async comparar(req, res) {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.slice(0, 2) : []

    if (ids.length === 0) {
      return res.status(400).json({ error: "Selecciona al menos un archivo" })
    }

    try {
      const model = new ImportModel(req.user)

      const importaciones = []

      for (const id of ids) {
        const importacion = await model.buscar(id)

        if (!importacion) {
          return res.status(404).json({ error: `La importacion ${id} no existe o no tienes acceso` })
        }

        const filas = await model.filas(importacion.id)
        importaciones.push(Comparador.analizar(importacion, filas))
      }

      if (importaciones.length === 1) {
        const unico = importaciones[0]

        return res.json({
          modo: "individual",
          empresas: [unico],
          series: Comparador.series(unico, null),
          insights: Insight.comparar(unico, null)
        })
      }

      // La empresa propia siempre va primera: los insights estan escritos
      // desde su punto de vista ("nosotros no lo tenemos").
      const ordenadas = [...importaciones].sort((a, b) => Number(b.esPropia) - Number(a.esPropia))
      const [nuestra, otra] = ordenadas

      res.json({
        modo: "comparacion",
        empresas: ordenadas,
        series: Comparador.series(nuestra, otra),
        insights: Insight.comparar(nuestra, otra),
        advertencia: nuestra.esPropia
          ? null
          : "Ninguno de los archivos elegidos es de la empresa. La lectura se hace tomando el primero como referencia."
      })
    } catch (error) {
      sendError(res, error)
    }
  }
}

const controller = new CompararController()

export default {
  comparar: controller.comparar.bind(controller)
}
