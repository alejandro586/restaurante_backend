import { normalizeName } from "./normalize.js"

/**
 * Cada CSV nombra lo mismo de forma distinta: plato / producto / item /
 * nombre_plato. Este modulo traduce las columnas reales de un archivo a
 * los roles que el comparador necesita, para poder comparar dos empresas
 * que jamas se pusieron de acuerdo en como llamar a sus columnas.
 */

const PATRONES = {
  producto: [/^(nombre_?)?plato/, /producto/, /^item/, /articulo/, /^nombre/, /descripcion/],
  categoria: [/categoria/, /^tipo$/, /familia/, /seccion/, /^grupo/, /linea/, /rubro/],
  precio: [/precio_?unitario/, /precio_?final/, /precio_?venta/, /^precio/, /^pvp/, /^valor_?unit/],
  unidades: [/unidades?_?vendidas?/, /^unidades$/, /^cantidad/, /^vendidos/, /^cant$/, /^qty/, /platos_?vendidos/],
  ingresos: [/ingreso_?total/, /venta_?total/, /^ingresos?$/, /^total$/, /^monto/, /^importe/, /facturacion/],
  periodo: [/^mes$/, /^fecha/, /periodo/, /^dia$/, /^month$/, /^date$/, /^anio$/]
}

// Columnas que revelan una capacidad del negocio, no un dato de la venta.
// Son las que alimentan el insight "esto lo tienen ellos y nosotros no".
const CAPACIDADES = [
  {
    clave: "delivery",
    etiqueta: "Canal de delivery",
    columnas: [/canal/, /delivery/, /reparto/, /modalidad/, /despacho/],
    valores: [/delivery/, /reparto/, /domicilio/, /app/],
    sugerencia: { columna: "canal_venta", tipo: "texto", ejemplo: "Salon / Delivery / Para llevar" }
  },
  {
    clave: "promociones",
    etiqueta: "Promociones y descuentos",
    columnas: [/promocion/, /descuento/, /oferta/, /^promo/, /rebaja/],
    sugerencia: { columna: "en_promocion", tipo: "booleano", ejemplo: "SI / NO" }
  },
  {
    clave: "combos",
    etiqueta: "Combos y menus armados",
    columnas: [/combo/, /^menu_?dia/, /paquete/, /^pack/, /promocion_?armada/],
    sugerencia: { columna: "es_combo", tipo: "booleano", ejemplo: "SI / NO" }
  },
  {
    clave: "fidelizacion",
    etiqueta: "Programa de fidelizacion",
    columnas: [/socio/, /fidelizacion/, /club/, /^puntos/, /membresia/, /cliente_?frecuente/],
    sugerencia: { columna: "ventas_socios_club", tipo: "entero", ejemplo: "unidades vendidas a socios" }
  },
  {
    clave: "resenas",
    etiqueta: "Resenas de clientes",
    columnas: [/resena/, /calificacion/, /rating/, /puntaje/, /estrellas/, /valoracion/],
    sugerencia: { columna: "resena_promedio", tipo: "numero", ejemplo: "1.0 a 5.0" }
  },
  {
    clave: "costos",
    etiqueta: "Costo y margen por plato",
    columnas: [/costo/, /margen/, /utilidad/, /ganancia/, /food_?cost/],
    sugerencia: { columna: "costo_unitario", tipo: "moneda", ejemplo: "cuanto cuesta producir el plato" }
  }
]

const coincide = (columna, patrones) => {
  const limpia = normalizeName(columna).replace(/\s+/g, "_")
  return patrones.some((patron) => patron.test(limpia))
}

const esNumerica = (filas, columna) => {
  const valores = filas
    .map((fila) => String(fila[columna] ?? "").trim())
    .filter((valor) => valor !== "")
    .slice(0, 100)

  if (valores.length === 0) return false

  return valores.every((valor) => Number.isFinite(Number(valor.replace(/,/g, ""))))
}

/**
 * Devuelve que columna real cumple cada rol. Para precio, unidades e
 * ingresos exige ademas que la columna sea numerica, porque una columna
 * llamada "total" con texto adentro romperia todos los calculos.
 */
export const detectarRoles = (columnas, filas) => {
  const roles = {}
  const usadas = new Set()

  const numericos = ["precio", "unidades", "ingresos"]

  Object.keys(PATRONES).forEach((rol) => {
    // El orden de los patrones define la preferencia: precio_unitario
    // gana sobre precio a secas.
    for (const patron of PATRONES[rol]) {
      const encontrada = columnas.find(
        (columna) =>
          !usadas.has(columna) &&
          coincide(columna, [patron]) &&
          (!numericos.includes(rol) || esNumerica(filas, columna))
      )

      if (encontrada) {
        roles[rol] = encontrada
        usadas.add(encontrada)
        break
      }
    }
  })

  return roles
}

/** Capacidades que este archivo demuestra que el negocio tiene. */
export const detectarCapacidades = (columnas, filas) =>
  CAPACIDADES.filter((capacidad) => {
    const columna = columnas.find((nombre) => coincide(nombre, capacidad.columnas))
    if (!columna) return false

    // Una columna "canal" que solo dice "Salon" no prueba que haya delivery
    if (capacidad.valores) {
      return filas.some((fila) => coincide(String(fila[columna] ?? ""), capacidad.valores))
    }

    // Una columna booleana en la que nunca se dice que si tampoco cuenta
    const valores = filas.map((fila) => String(fila[columna] ?? "").trim().toLowerCase())
    const positivos = valores.filter((valor) => !["", "no", "false", "0", "n"].includes(valor))

    return positivos.length > 0
  }).map((capacidad) => ({
    ...capacidad,
    columna: columnas.find((nombre) => coincide(nombre, capacidad.columnas))
  }))

export const CAPACIDADES_CONOCIDAS = CAPACIDADES
