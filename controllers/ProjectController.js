import ProjectModel from "../models/ProjectModel.js"
import { sendError } from "../utils/apiError.js"

const ESTADOS = [
  "activo",
  "pausado",
  "completado",
  "archivado"
]

const VISIBILIDADES = [
  "privado",
  "interno"
]

const idValido = (id) => {
  return /^\d+$/.test(String(id || ""))
}

class ProjectController {
  /**
   * GET /api/projects
   * Lista todos los proyectos a los que
   * el usuario tiene acceso.
   */
  async listar(req, res) {
    try {
      const model = new ProjectModel(req.user)

      const proyectos = await model.listar()

      res.json(proyectos)
    } catch (error) {
      sendError(res, error)
    }
  }

  /**
   * GET /api/projects/:id
   * Obtiene un proyecto especifico.
   */
  async obtener(req, res) {
    if (!idValido(req.params.id)) {
      return res.status(400).json({
        error: "Proyecto no valido"
      })
    }

    try {
      const model = new ProjectModel(req.user)

      const proyecto = await model.obtener(
        Number(req.params.id)
      )

      if (!proyecto) {
        return res.status(404).json({
          error:
            "Proyecto no encontrado o sin acceso"
        })
      }

      res.json(proyecto)
    } catch (error) {
      sendError(res, error)
    }
  }

  /**
   * POST /api/projects
   * Crea un proyecto nuevo.
   */
  async crear(req, res) {
    const nombre = String(
      req.body.nombre || ""
    ).trim()

    const descripcion = String(
      req.body.descripcion || ""
    ).trim()

    const estado =
      req.body.estado || "activo"

    const visibilidad =
      req.body.visibilidad || "privado"

    if (nombre.length < 3) {
      return res.status(400).json({
        error:
          "El nombre del proyecto debe tener al menos 3 caracteres"
      })
    }

    if (nombre.length > 120) {
      return res.status(400).json({
        error:
          "El nombre del proyecto no puede superar 120 caracteres"
      })
    }

    if (descripcion.length > 2000) {
      return res.status(400).json({
        error:
          "La descripcion no puede superar 2000 caracteres"
      })
    }

    if (!ESTADOS.includes(estado)) {
      return res.status(400).json({
        error:
          "Estado de proyecto no valido"
      })
    }

    if (
      !VISIBILIDADES.includes(visibilidad)
    ) {
      return res.status(400).json({
        error:
          "Visibilidad no valida"
      })
    }

    try {
      const model = new ProjectModel(req.user)

      const proyecto = await model.crear({
        nombre,
        descripcion:
          descripcion || null,
        estado,
        visibilidad
      })

      res.status(201).json(proyecto)
    } catch (error) {
      sendError(res, error)
    }
  }

  /**
   * PATCH /api/projects/:id
   * Actualiza informacion del proyecto.
   */
  async actualizar(req, res) {
    if (!idValido(req.params.id)) {
      return res.status(400).json({
        error:
          "Proyecto no valido"
      })
    }

    const cambios = {}

    if (req.body.nombre !== undefined) {
      const nombre = String(
        req.body.nombre || ""
      ).trim()

      if (
        nombre.length < 3 ||
        nombre.length > 120
      ) {
        return res.status(400).json({
          error:
            "El nombre debe tener entre 3 y 120 caracteres"
        })
      }

      cambios.nombre = nombre
    }

    if (
      req.body.descripcion !== undefined
    ) {
      const descripcion = String(
        req.body.descripcion || ""
      ).trim()

      if (descripcion.length > 2000) {
        return res.status(400).json({
          error:
            "La descripcion no puede superar 2000 caracteres"
        })
      }

      cambios.descripcion =
        descripcion || null
    }

    if (
      req.body.estado !== undefined
    ) {
      if (
        !ESTADOS.includes(
          req.body.estado
        )
      ) {
        return res.status(400).json({
          error:
            "Estado de proyecto no valido"
        })
      }

      cambios.estado =
        req.body.estado
    }

    if (
      req.body.visibilidad !== undefined
    ) {
      if (
        !VISIBILIDADES.includes(
          req.body.visibilidad
        )
      ) {
        return res.status(400).json({
          error:
            "Visibilidad no valida"
        })
      }

      cambios.visibilidad =
        req.body.visibilidad
    }

    if (
      Object.keys(cambios).length === 0
    ) {
      return res.status(400).json({
        error:
          "No hay cambios para guardar"
      })
    }

    try {
      const model =
        new ProjectModel(req.user)

      const resultado =
        await model.actualizar(
          Number(req.params.id),
          cambios
        )

      if (
        resultado.tipo === "not_found"
      ) {
        return res.status(404).json({
          error:
            "Proyecto no encontrado"
        })
      }

      if (
        resultado.tipo === "forbidden"
      ) {
        return res.status(403).json({
          error:
            "No tienes permisos para modificar este proyecto"
        })
      }

      res.json(resultado.proyecto)
    } catch (error) {
      sendError(res, error)
    }
  }

  /**
   * DELETE /api/projects/:id
   * Elimina un proyecto.
   */
  async eliminar(req, res) {
    if (!idValido(req.params.id)) {
      return res.status(400).json({
        error:
          "Proyecto no valido"
      })
    }

    try {
      const model =
        new ProjectModel(req.user)

      const resultado =
        await model.eliminar(
          Number(req.params.id)
        )

      if (
        resultado.tipo === "not_found"
      ) {
        return res.status(404).json({
          error:
            "Proyecto no encontrado"
        })
      }

      if (
        resultado.tipo === "forbidden"
      ) {
        return res.status(403).json({
          error:
            "Solo el administrador o el creador puede eliminar el proyecto"
        })
      }

      res.json({
        eliminado: true
      })
    } catch (error) {
      sendError(res, error)
    }
  }

  /**
   * GET /api/projects/:id/members
   * Lista los miembros de un proyecto.
   */
  async miembros(req, res) {
    if (!idValido(req.params.id)) {
      return res.status(400).json({
        error:
          "Proyecto no valido"
      })
    }

    try {
      const model =
        new ProjectModel(req.user)

      const proyecto =
        await model.obtener(
          Number(req.params.id)
        )

      if (!proyecto) {
        return res.status(404).json({
          error:
            "Proyecto no encontrado o sin acceso"
        })
      }

      const miembros =
        await model.listarMiembros(
          Number(req.params.id)
        )

      res.json(miembros)
    } catch (error) {
      sendError(res, error)
    }
  }
}

const controller =
  new ProjectController()

export default {
  listar:
    controller.listar.bind(controller),

  obtener:
    controller.obtener.bind(controller),

  crear:
    controller.crear.bind(controller),

  actualizar:
    controller.actualizar.bind(controller),

  eliminar:
    controller.eliminar.bind(controller),

  miembros:
    controller.miembros.bind(controller)
}