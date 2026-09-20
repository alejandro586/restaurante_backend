import FacialModel
  from "../models/FacialModel.js"

import RoboflowWorkflowService
  from "../services/RoboflowWorkflowService.js"


const NODOS = [
  "Entrada de imagen",
  "Detección de rostro",
  "Filtro de confianza",
  "Recorte facial",
  "Clasificación de expresión",
  "Etiqueta y confianza",
  "Salida del Workflow"
]


const responderError = (
  res,
  error
) => {
  console.error(
    "Error en reconocimiento facial:",
    error
  )

  const status =
    Number(
      error?.statusCode ||
      error?.status ||
      500
    )

  return res
    .status(
      status >= 400 &&
      status <= 599
        ? status
        : 500
    )
    .json({
      error:
        error?.message ||
        "No se pudo completar el análisis facial"
    })
}


class FacialController {
  status(req, res) {
    const service =
      new RoboflowWorkflowService()

    return res.json({
      ...service.configStatus(),
      nodos: NODOS,
      total_nodos:
        NODOS.length,
      guarda_imagenes:
        false
    })
  }


  async analizar(req, res) {
    const image =
      String(
        req.body?.image ||
        ""
      ).trim()

    const source =
      String(
        req.body?.source ||
        "archivo"
      )
        .trim()
        .toLowerCase()

    if (!image) {
      return res
        .status(400)
        .json({
          error:
            "Debes enviar una imagen"
        })
    }

    if (
      ![
        "camara",
        "archivo"
      ].includes(source)
    ) {
      return res
        .status(400)
        .json({
          error:
            "La fuente de la imagen no es válida"
        })
    }

    if (
      image.length >
      8_000_000
    ) {
      return res
        .status(413)
        .json({
          error:
            "La imagen es demasiado grande. Usa una imagen de hasta 5 MB."
        })
    }

    try {
      const service =
        new RoboflowWorkflowService()

      const resultado =
        await service.analyzeBase64(
          image
        )

      const model =
        new FacialModel(
          req.user
        )

      const registro =
        await model.guardarAnalisis({
          ...resultado,
          source
        })

      return res.json({
        id:
          registro.id,

        expresion:
          resultado.expressionLabel,

        expresion_clave:
          resultado.expressionKey,

        confianza:
          resultado.confidence,

        predicciones:
          resultado.predictions,

        proveedor:
          resultado.provider,

        fuente:
          source,

        guarda_imagen:
          false,

        usuario: {
          id:
            req.user.id,

          nombre:
            req.user.full_name ||
            null,

          email:
            req.user.email ||
            null,

          rol:
            req.user.role ||
            null,

          empresa:
            req.user.empresa ||
            null
        },

        created_at:
          registro.created_at
      })

    } catch (error) {
      return responderError(
        res,
        error
      )
    }
  }


  async historial(req, res) {
    try {
      const model =
        new FacialModel(
          req.user
        )

      const registros =
        await model.historial(
          req.query?.limit
        )

      return res.json({
        total:
          registros.length,
        registros
      })

    } catch (error) {
      return responderError(
        res,
        error
      )
    }
  }


  async estadisticas(req, res) {
    try {
      const model =
        new FacialModel(
          req.user
        )

      const resultado =
        await model.estadisticas()

      return res.json(
        resultado
      )

    } catch (error) {
      return responderError(
        res,
        error
      )
    }
  }
}


const controller =
  new FacialController()


export default {
  status:
    controller.status.bind(
      controller
    ),

  analizar:
    controller.analizar.bind(
      controller
    ),

  historial:
    controller.historial.bind(
      controller
    ),

  estadisticas:
    controller.estadisticas.bind(
      controller
    )
}
