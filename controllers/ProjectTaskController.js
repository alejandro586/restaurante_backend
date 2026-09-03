import ProjectTaskModel from "../models/ProjectTaskModel.js"
import { sendError } from "../utils/apiError.js"

/**
 * Estados permitidos para las actividades
 * del sistema colaborativo.
 */
const ESTADOS = [
  "pendiente",
  "en_progreso",
  "en_revision",
  "completada"
]

/**
 * Prioridades permitidas.
 */
const PRIORIDADES = [
  "baja",
  "media",
  "alta",
  "urgente"
]

/**
 * Se mantienen los niveles originales
 * de la tabla tareas.
 */
const NIVELES = [
  "oportunidad",
  "alerta",
  "info"
]

/**
 * Comprueba IDs numericos.
 *
 * projects.id y tareas.id son bigint,
 * por eso aqui esperamos numeros.
 */
const idValido = (valor) => {
  return /^\d+$/.test(
    String(valor || "")
  )
}

/**
 * Convierte valores vacios en null.
 */
const textoONull = (
  valor
) => {
  if (
    valor === undefined ||
    valor === null
  ) {
    return null
  }

  const texto =
    String(valor).trim()

  return texto || null
}

/**
 * Respuestas comunes provenientes
 * del modelo.
 */
const responderResultadoError = (
  res,
  resultado
) => {
  switch (
    resultado?.tipo
  ) {
    case "not_found":
      res.status(404).json({
        error:
          "Proyecto no encontrado"
      })

      return true

    case "not_found_task":
      res.status(404).json({
        error:
          "Actividad no encontrada"
      })

      return true

    case "forbidden":
      res.status(403).json({
        error:
          "No tienes permisos para realizar esta accion"
      })

      return true

    case "forbidden_fields":
      res.status(403).json({
        error:
          "Solo puedes cambiar el estado de esta actividad"
      })

      return true

    case "invalid_assignee":
      res.status(400).json({
        error:
          "El usuario seleccionado no pertenece al proyecto o no puede recibir actividades"
      })

      return true

    default:
      return false
  }
}

class ProjectTaskController {
  /**
   * GET
   * /api/projects/:id/tasks
   *
   * Lista todas las actividades
   * de un proyecto.
   */
  async listar(
    req,
    res
  ) {
    if (
      !idValido(
        req.params.id
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Proyecto no valido"
        })
    }

    try {
      const model =
        new ProjectTaskModel(
          req.user
        )

      const resultado =
        await model.listar(
          Number(
            req.params.id
          )
        )

      if (
        responderResultadoError(
          res,
          resultado
        )
      ) {
        return
      }

      res.json(
        resultado.tareas
      )
    } catch (error) {
      console.error(
        "Error listando actividades:",
        error
      )

      sendError(
        res,
        error
      )
    }
  }

  /**
   * GET
   * /api/projects/:id/tasks/members
   *
   * Lista los miembros que pueden
   * recibir actividades.
   */
  async miembros(
    req,
    res
  ) {
    if (
      !idValido(
        req.params.id
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Proyecto no valido"
        })
    }

    try {
      const model =
        new ProjectTaskModel(
          req.user
        )

      const resultado =
        await model.miembrosAsignables(
          Number(
            req.params.id
          )
        )

      if (
        responderResultadoError(
          res,
          resultado
        )
      ) {
        return
      }

      res.json(
        resultado.miembros
      )
    } catch (error) {
      console.error(
        "Error obteniendo miembros asignables:",
        error
      )

      sendError(
        res,
        error
      )
    }
  }

  /**
   * GET
   * /api/projects/:id/tasks/:taskId
   *
   * Obtiene una actividad concreta.
   */
  async obtener(
    req,
    res
  ) {
    const {
      id,
      taskId
    } = req.params

    if (
      !idValido(id) ||
      !idValido(taskId)
    ) {
      return res
        .status(400)
        .json({
          error:
            "Proyecto o actividad no validos"
        })
    }

    try {
      const model =
        new ProjectTaskModel(
          req.user
        )

      const resultado =
        await model.obtener(
          Number(id),
          Number(taskId)
        )

      if (
        responderResultadoError(
          res,
          resultado
        )
      ) {
        return
      }

      res.json(
        resultado.tarea
      )
    } catch (error) {
      console.error(
        "Error obteniendo actividad:",
        error
      )

      sendError(
        res,
        error
      )
    }
  }

  /**
   * POST
   * /api/projects/:id/tasks
   *
   * Crea una actividad nueva.
   */
  async crear(
    req,
    res
  ) {
    const projectId =
      req.params.id

    if (
      !idValido(
        projectId
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Proyecto no valido"
        })
    }

    /**
     * Permitimos ambos formatos:
     *
     * asignada_a
     * asignadaA
     *
     * para evitar problemas entre
     * frontend y backend.
     */
    const asignadaA =
      req.body.asignada_a ||
      req.body.asignadaA

    const titulo =
      String(
        req.body.titulo || ""
      ).trim()

    const mensaje =
      String(
        req.body.mensaje ||
        req.body.descripcion ||
        ""
      ).trim()

    const prioridad =
      req.body.prioridad ||
      "media"

    const estado =
      req.body.estado ||
      "pendiente"

    const nivel =
      req.body.nivel ||
      "info"

    const fechaLimite =
      req.body.fecha_limite ||
      req.body.fechaLimite ||
      null

    /**
     * Validaciones.
     */
    if (
      titulo.length < 3
    ) {
      return res
        .status(400)
        .json({
          error:
            "El titulo debe tener al menos 3 caracteres"
        })
    }

    if (
      titulo.length > 300
    ) {
      return res
        .status(400)
        .json({
          error:
            "El titulo no puede superar 300 caracteres"
        })
    }

    if (
      mensaje.length < 3
    ) {
      return res
        .status(400)
        .json({
          error:
            "La actividad necesita una descripcion"
        })
    }

    if (
      mensaje.length > 2000
    ) {
      return res
        .status(400)
        .json({
          error:
            "La descripcion no puede superar 2000 caracteres"
        })
    }

    if (
      !asignadaA
    ) {
      return res
        .status(400)
        .json({
          error:
            "Selecciona a quien se asignara la actividad"
        })
    }

    if (
      !PRIORIDADES.includes(
        prioridad
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Prioridad no valida"
        })
    }

    if (
      !ESTADOS.includes(
        estado
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Estado no valido"
        })
    }

    if (
      !NIVELES.includes(
        nivel
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Nivel no valido"
        })
    }

    /**
     * Validamos la fecha cuando
     * se proporciona.
     */
    let fechaNormalizada =
      null

    if (
      fechaLimite
    ) {
      const fecha =
        new Date(
          fechaLimite
        )

      if (
        Number.isNaN(
          fecha.getTime()
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Fecha limite no valida"
          })
      }

      fechaNormalizada =
        fecha.toISOString()
    }

    try {
      const model =
        new ProjectTaskModel(
          req.user
        )

      const resultado =
        await model.crear(
          Number(
            projectId
          ),
          {
            titulo,

            mensaje,

            prioridad,

            estado,

            nivel,

            asignada_a:
              asignadaA,

            fecha_limite:
              fechaNormalizada,

            origen:
              "proyecto"
          }
        )

      if (
        responderResultadoError(
          res,
          resultado
        )
      ) {
        return
      }

      res
        .status(201)
        .json(
          resultado.tarea
        )
    } catch (error) {
      console.error(
        "Error creando actividad:",
        error
      )

      sendError(
        res,
        error
      )
    }
  }

  /**
   * PATCH
   * /api/projects/:id/tasks/:taskId
   *
   * Modifica una actividad existente.
   */
  async actualizar(
    req,
    res
  ) {
    const {
      id,
      taskId
    } = req.params

    if (
      !idValido(id) ||
      !idValido(taskId)
    ) {
      return res
        .status(400)
        .json({
          error:
            "Proyecto o actividad no validos"
        })
    }

    const cambios = {}

    /**
     * TITULO
     */
    if (
      req.body.titulo !==
      undefined
    ) {
      const titulo =
        String(
          req.body.titulo ||
          ""
        ).trim()

      if (
        titulo.length < 3 ||
        titulo.length > 300
      ) {
        return res
          .status(400)
          .json({
            error:
              "El titulo debe tener entre 3 y 300 caracteres"
          })
      }

      cambios.titulo =
        titulo
    }

    /**
     * MENSAJE / DESCRIPCION
     */
    if (
      req.body.mensaje !==
        undefined ||
      req.body.descripcion !==
        undefined
    ) {
      const mensaje =
        String(
          req.body.mensaje ??
          req.body.descripcion ??
          ""
        ).trim()

      if (
        mensaje.length < 3 ||
        mensaje.length > 2000
      ) {
        return res
          .status(400)
          .json({
            error:
              "La descripcion debe tener entre 3 y 2000 caracteres"
          })
      }

      cambios.mensaje =
        mensaje
    }

    /**
     * ESTADO
     */
    if (
      req.body.estado !==
      undefined
    ) {
      if (
        !ESTADOS.includes(
          req.body.estado
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Estado no valido"
          })
      }

      cambios.estado =
        req.body.estado
    }

    /**
     * PRIORIDAD
     */
    if (
      req.body.prioridad !==
      undefined
    ) {
      if (
        !PRIORIDADES.includes(
          req.body.prioridad
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Prioridad no valida"
          })
      }

      cambios.prioridad =
        req.body.prioridad
    }

    /**
     * NIVEL
     */
    if (
      req.body.nivel !==
      undefined
    ) {
      if (
        !NIVELES.includes(
          req.body.nivel
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Nivel no valido"
          })
      }

      cambios.nivel =
        req.body.nivel
    }

    /**
     * USUARIO ASIGNADO
     */
    const tieneAsignado =
      req.body.asignada_a !==
        undefined ||
      req.body.asignadaA !==
        undefined

    if (
      tieneAsignado
    ) {
      const asignadaA =
        req.body.asignada_a ||
        req.body.asignadaA

      if (
        !asignadaA
      ) {
        return res
          .status(400)
          .json({
            error:
              "Selecciona un miembro para asignar la actividad"
          })
      }

      cambios.asignada_a =
        asignadaA
    }

    /**
     * FECHA LIMITE
     */
    const tieneFecha =
      req.body.fecha_limite !==
        undefined ||
      req.body.fechaLimite !==
        undefined

    if (
      tieneFecha
    ) {
      const valor =
        req.body.fecha_limite ??
        req.body.fechaLimite

      if (
        valor === null ||
        valor === ""
      ) {
        cambios.fecha_limite =
          null
      } else {
        const fecha =
          new Date(
            valor
          )

        if (
          Number.isNaN(
            fecha.getTime()
          )
        ) {
          return res
            .status(400)
            .json({
              error:
                "Fecha limite no valida"
            })
        }

        cambios.fecha_limite =
          fecha.toISOString()
      }
    }

    if (
      Object.keys(
        cambios
      ).length === 0
    ) {
      return res
        .status(400)
        .json({
          error:
            "No hay cambios para guardar"
        })
    }

    try {
      const model =
        new ProjectTaskModel(
          req.user
        )

      const resultado =
        await model.actualizar(
          Number(id),
          Number(taskId),
          cambios
        )

      if (
        responderResultadoError(
          res,
          resultado
        )
      ) {
        return
      }

      res.json(
        resultado.tarea
      )
    } catch (error) {
      console.error(
        "Error actualizando actividad:",
        error
      )

      sendError(
        res,
        error
      )
    }
  }

  /**
   * DELETE
   * /api/projects/:id/tasks/:taskId
   */
  async eliminar(
    req,
    res
  ) {
    const {
      id,
      taskId
    } = req.params

    if (
      !idValido(id) ||
      !idValido(taskId)
    ) {
      return res
        .status(400)
        .json({
          error:
            "Proyecto o actividad no validos"
        })
    }

    try {
      const model =
        new ProjectTaskModel(
          req.user
        )

      const resultado =
        await model.eliminar(
          Number(id),
          Number(taskId)
        )

      if (
        responderResultadoError(
          res,
          resultado
        )
      ) {
        return
      }

      res.json({
        eliminado: true
      })
    } catch (error) {
      console.error(
        "Error eliminando actividad:",
        error
      )

      sendError(
        res,
        error
      )
    }
  }
}

const controller =
  new ProjectTaskController()

export default {
  listar:
    controller.listar.bind(
      controller
    ),

  miembros:
    controller.miembros.bind(
      controller
    ),

  obtener:
    controller.obtener.bind(
      controller
    ),

  crear:
    controller.crear.bind(
      controller
    ),

  actualizar:
    controller.actualizar.bind(
      controller
    ),

  eliminar:
    controller.eliminar.bind(
      controller
    )
}