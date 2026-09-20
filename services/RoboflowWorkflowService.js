const DEFAULT_API_URL =
  "https://serverless.roboflow.com"


const EXPRESIONES = {
  happy:
    "Sonrisa / expresión positiva",
  neutral:
    "Expresión neutral",
  angry:
    "Expresión asociada a enojo",
  sad:
    "Expresión asociada a tristeza",
  surprise:
    "Expresión de sorpresa",
  surprised:
    "Expresión de sorpresa",
  disgust:
    "Expresión asociada a disgusto",
  disgusted:
    "Expresión asociada a disgusto",
  fear:
    "Expresión asociada a temor"
}


const normalizarNumero = (
  valor
) => {
  const numero =
    Number(valor)

  if (!Number.isFinite(numero)) {
    return 0
  }

  if (numero > 1 && numero <= 100) {
    return Math.min(
      1,
      numero / 100
    )
  }

  return Math.max(
    0,
    Math.min(1, numero)
  )
}


const limpiarBase64 = (
  valor
) => {
  const texto =
    String(valor || "").trim()

  const coincidencia =
    texto.match(
      /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/s
    )

  return coincidencia
    ? coincidencia[1]
    : texto
}


const titulo = (
  valor
) =>
    String(valor || "")
      .replace(/[_-]+/g, " ")
      .trim()
      .replace(
        /\b\w/g,
        (letra) => letra.toUpperCase()
      )


const buscarClasificacion = (
  valor,
  encontrados = []
) => {
  if (
    valor === null ||
    valor === undefined
  ) {
    return encontrados
  }

  if (Array.isArray(valor)) {
    for (const item of valor) {
      buscarClasificacion(
        item,
        encontrados
      )
    }

    return encontrados
  }

  if (typeof valor !== "object") {
    return encontrados
  }

  const top =
    typeof valor.top === "string"
      ? valor.top.trim()
      : ""

  const tipo =
    String(
      valor.prediction_type ||
      valor.type ||
      ""
    )
      .toLowerCase()

  if (top) {
    encontrados.push({
      clase: top,
      confianza:
        normalizarNumero(
          valor.confidence
        ),
      predictions:
        Array.isArray(
          valor.predictions
        )
          ? valor.predictions
          : []
    })
  } else if (
    tipo.includes("classification") &&
    Array.isArray(valor.predictions)
  ) {
    const predicciones =
      valor.predictions
        .filter(
          (item) =>
            item &&
            typeof item === "object" &&
            typeof item.class === "string"
        )
        .sort(
          (a, b) =>
            Number(b.confidence || 0) -
            Number(a.confidence || 0)
        )

    if (predicciones.length > 0) {
      encontrados.push({
        clase:
          predicciones[0].class,
        confianza:
          normalizarNumero(
            predicciones[0].confidence
          ),
        predictions:
          predicciones
      })
    }
  }

  for (const item of Object.values(valor)) {
    buscarClasificacion(
      item,
      encontrados
    )
  }

  return encontrados
}


const obtenerResultado = (
  respuesta
) => {
  const candidatos =
    buscarClasificacion(
      respuesta
    )

  if (candidatos.length === 0) {
    throw new Error(
      "El Workflow no devolvió una clasificación facial. Revisa que su salida incluya el resultado del modelo de clasificación."
    )
  }

  const conocidos =
    candidatos.filter(
      (item) =>
        Object.prototype.hasOwnProperty.call(
          EXPRESIONES,
          String(item.clase || "")
            .trim()
            .toLowerCase()
        )
    )

  const candidato =
    (conocidos.length > 0
      ? conocidos
      : candidatos
    )
      .sort(
        (a, b) =>
          Number(b.confianza || 0) -
          Number(a.confianza || 0)
      )[0]

  const clave =
    String(candidato.clase || "")
      .trim()
      .toLowerCase()

  const predicciones =
    (candidato.predictions || [])
      .map((item) => ({
        class:
          String(item?.class || "")
            .trim(),
        confidence:
          normalizarNumero(
            item?.confidence
          )
      }))
      .filter(
        (item) => item.class
      )
      .sort(
        (a, b) =>
          b.confidence -
          a.confidence
      )
      .slice(0, 7)

  return {
    expressionKey:
      clave || "sin_clasificar",

    expressionLabel:
      EXPRESIONES[clave] ||
      titulo(clave) ||
      "Sin clasificar",

    confidence:
      normalizarNumero(
        candidato.confianza
      ),

    predictions:
      predicciones
  }
}


class RoboflowWorkflowService {
  constructor() {
    this.apiUrl =
      String(
        process.env.ROBOFLOW_API_URL ||
        DEFAULT_API_URL
      )
        .trim()
        .replace(/\/+$/, "")

    this.apiKey =
      String(
        process.env.ROBOFLOW_API_KEY ||
        ""
      ).trim()

    this.workspace =
      String(
        process.env.ROBOFLOW_WORKSPACE ||
        ""
      ).trim()

    this.workflowId =
      String(
        process.env.ROBOFLOW_WORKFLOW_ID ||
        ""
      ).trim()
  }


  isConfigured() {
    return Boolean(
      this.apiKey &&
      this.workspace &&
      this.workflowId
    )
  }


  configStatus() {
    return {
      configurado:
        this.isConfigured(),

      proveedor:
        "Roboflow Workflows",

      workspace_configurado:
        Boolean(this.workspace),

      workflow_configurado:
        Boolean(this.workflowId),

      api_key_configurada:
        Boolean(this.apiKey)
    }
  }


  async analyzeBase64(
    imageBase64
  ) {
    if (!this.isConfigured()) {
      const error =
        new Error(
          "El Workflow visual no está configurado en el servidor."
        )

      error.statusCode = 503
      throw error
    }

    const base64 =
      limpiarBase64(
        imageBase64
      )

    if (!base64) {
      const error =
        new Error(
          "La imagen está vacía."
        )

      error.statusCode = 400
      throw error
    }

    const endpoint =
      `${this.apiUrl}/${encodeURIComponent(
        this.workspace
      )}/workflows/${encodeURIComponent(
        this.workflowId
      )}`

    const response =
      await fetch(
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify({
              api_key:
                this.apiKey,

              inputs: {
                image: {
                  type: "base64",
                  value: base64
                }
              }
            })
        }
      )

    let body = null

    try {
      body = await response.json()
    } catch {
      body = null
    }

    if (!response.ok) {
      const detalle =
        String(
          body?.message ||
          body?.error ||
          body?.detail ||
          ""
        ).trim()

      const error =
        new Error(
          detalle
            ? `Roboflow rechazó el análisis: ${detalle}`
            : `Roboflow rechazó el análisis con estado ${response.status}.`
        )

      error.statusCode =
        response.status >= 400 &&
        response.status < 500
          ? 400
          : 502

      throw error
    }

    return {
      ...obtenerResultado(body),
      provider:
        "roboflow-workflow"
    }
  }
}


export default RoboflowWorkflowService
