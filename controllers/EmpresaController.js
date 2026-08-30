import ImportModel from "../models/ImportModel.js"
import Comparador from "../utils/Comparador.js"
import Insight from "../utils/Insight.js"
import { sendError } from "../utils/apiError.js"

/**
 * Lo unico que queda de este modulo en el backend.
 *
 * Las operaciones de estructura (ALTER TABLE, CREATE TABLE, edicion de
 * celdas) las ejecuta el navegador contra las funciones RPC de Postgres.
 * Esto no es una operacion de base: es el analisis que cruza los archivos
 * importados para saber que registra la competencia y la empresa no, y
 * necesita el motor de comparacion que vive aqui.
 */
class EmpresaController {
  /** GET /api/empresa/sugerencias */
  async sugerencias(req, res) {
    try {
      const model = new ImportModel(req.user)
      const lista = await model.listar()

      const propias = lista.filter((i) => i.es_propia)
      const ajenas = lista.filter((i) => !i.es_propia)

      if (propias.length === 0 || ajenas.length === 0) {
        return res.json({ sugerencias: [], motivo: "Faltan archivos propios o de la competencia" })
      }

      const analizar = async (importacion) =>
        Comparador.analizar(importacion, await model.filas(importacion.id))

      const nuestra = await analizar(propias[0])

      const vistas = new Set()
      const sugerencias = []

      for (const ajena of ajenas.slice(0, 5)) {
        const otra = await analizar(ajena)

        Insight.comparar(nuestra, otra)
          .filter((i) => i.accion && !vistas.has(i.accion.columna))
          .forEach((i) => {
            vistas.add(i.accion.columna)
            sugerencias.push({ ...i.accion, origen: otra.empresa, titulo: i.titulo, mensaje: i.mensaje })
          })
      }

      res.json({ sugerencias, empresa: nuestra.empresa })
    } catch (error) {
      sendError(res, error)
    }
  }
}

const controller = new EmpresaController()

export default {
  sugerencias: controller.sugerencias.bind(controller)
}
