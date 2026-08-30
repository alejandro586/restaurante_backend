import { detectarRoles, detectarCapacidades } from "./Mapeo.js"

const numero = (valor) => {
  const limpio = String(valor ?? "").trim().replace(/,/g, "")
  const resultado = Number(limpio)
  return Number.isFinite(resultado) ? resultado : 0
}

const redondear = (valor, decimales = 2) => Number((valor || 0).toFixed(decimales))

class Comparador {
  /**
   * Reduce un archivo importado, con las columnas que sea, a un mismo
   * conjunto de metricas. Solo asi se pueden comparar dos empresas que
   * usan estructuras distintas.
   */
  analizar(importacion, filas) {
    const columnas = importacion.columnas || []
    const roles = detectarRoles(columnas, filas)
    const capacidades = detectarCapacidades(columnas, filas)

    const ingresos = this.ingresos(filas, roles)
    const unidades = this.unidades(filas, roles)

    return {
      id: importacion.id,
      empresa: importacion.empresa,
      archivo: importacion.archivo,
      esPropia: importacion.es_propia,
      columnas,
      roles,
      capacidades: capacidades.map((c) => ({
        clave: c.clave,
        etiqueta: c.etiqueta,
        columna: c.columna,
        sugerencia: c.sugerencia
      })),
      totalFilas: filas.length,
      ingresos: redondear(ingresos),
      unidades,
      ticketPromedio: unidades > 0 ? redondear(ingresos / unidades) : 0,
      productos: this.productosDistintos(filas, roles),
      porCategoria: this.porCategoria(filas, roles),
      topProductos: this.topProductos(filas, roles),
      porPeriodo: this.porPeriodo(filas, roles),
      porCapacidad: this.porCapacidad(filas, roles, capacidades)
    }
  }

  /** Si no hay columna de ingresos, se reconstruye con precio por unidades. */
  ingresos(filas, roles) {
    if (roles.ingresos) {
      return filas.reduce((total, fila) => total + numero(fila[roles.ingresos]), 0)
    }

    if (roles.precio && roles.unidades) {
      return filas.reduce(
        (total, fila) => total + numero(fila[roles.precio]) * numero(fila[roles.unidades]),
        0
      )
    }

    return 0
  }

  unidades(filas, roles) {
    if (!roles.unidades) return 0
    return filas.reduce((total, fila) => total + numero(fila[roles.unidades]), 0)
  }

  productosDistintos(filas, roles) {
    if (!roles.producto) return 0
    const set = new Set(filas.map((fila) => String(fila[roles.producto] ?? "").trim()).filter(Boolean))
    return set.size
  }

  /** Agrupa por una columna sumando ingresos y unidades. */
  agrupar(filas, roles, columna) {
    const grupos = {}

    filas.forEach((fila) => {
      const clave = String(fila[columna] ?? "").trim() || "Sin dato"

      if (!grupos[clave]) grupos[clave] = { nombre: clave, ingresos: 0, unidades: 0 }

      grupos[clave].ingresos += roles.ingresos
        ? numero(fila[roles.ingresos])
        : numero(fila[roles.precio]) * numero(fila[roles.unidades])

      grupos[clave].unidades += numero(fila[roles.unidades])
    })

    return Object.values(grupos)
      .map((grupo) => ({ ...grupo, ingresos: redondear(grupo.ingresos) }))
      .sort((a, b) => b.ingresos - a.ingresos)
  }

  porCategoria(filas, roles) {
    if (!roles.categoria) return []
    return this.agrupar(filas, roles, roles.categoria)
  }

  topProductos(filas, roles) {
    if (!roles.producto) return []
    return this.agrupar(filas, roles, roles.producto).slice(0, 10)
  }

  porPeriodo(filas, roles) {
    if (!roles.periodo) return []
    return this.agrupar(filas, roles, roles.periodo).sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    )
  }

  /**
   * Desglose de ingresos por cada capacidad detectada (canal, combo, etc).
   * Marca que grupos cuentan como uso real de la capacidad: en una columna
   * "canal" con Salon, Delivery y Para llevar, solo Delivery prueba que el
   * negocio reparte a domicilio.
   */
  porCapacidad(filas, roles, capacidades) {
    const NEGATIVOS = ["sin dato", "no", "false", "0", "n", "ninguno"]

    const salida = {}

    capacidades.forEach((capacidad) => {
      const columna = capacidad.columna
      const todos = this.agrupar(filas, roles, columna)

      // Una columna como ventas_socios_club es una medida, no una etiqueta:
      // agruparla por valor daria grupos sin sentido ("102", "133", "77").
      // En ese caso se mide cuanto ingreso viene de las filas con registro.
      const esMedida =
        todos.length > 8 && todos.every((g) => g.nombre === "Sin dato" || Number.isFinite(Number(g.nombre)))

      if (esMedida) {
        const conRegistro = filas.filter((fila) => numero(fila[columna]) > 0)
        const ingreso = conRegistro.reduce(
          (total, fila) =>
            total +
            (roles.ingresos
              ? numero(fila[roles.ingresos])
              : numero(fila[roles.precio]) * numero(fila[roles.unidades])),
          0
        )

        salida[capacidad.clave] = {
          etiqueta: capacidad.etiqueta,
          columna,
          esMedida: true,
          suma: redondear(filas.reduce((total, fila) => total + numero(fila[columna]), 0)),
          filasConRegistro: conRegistro.length,
          grupos: [{ nombre: "Con registro", ingresos: redondear(ingreso), unidades: conRegistro.length, usa: true }],
          ingresoQueUsa: redondear(ingreso)
        }

        return
      }

      const grupos = todos.slice(0, 6).map((grupo) => ({
        ...grupo,
        usa: capacidad.valores
          ? capacidad.valores.some((patron) => patron.test(grupo.nombre.toLowerCase()))
          : !NEGATIVOS.includes(grupo.nombre.trim().toLowerCase())
      }))

      salida[capacidad.clave] = {
        etiqueta: capacidad.etiqueta,
        columna,
        esMedida: false,
        grupos,
        ingresoQueUsa: redondear(
          grupos.filter((g) => g.usa).reduce((total, g) => total + g.ingresos, 0)
        )
      }
    })

    return salida
  }

  /**
   * Arma las series que el frontend grafica. Cuando hay dos empresas, las
   * categorias y periodos se alinean para que las barras sean comparables.
   */
  series(a, b) {
    if (!b) {
      return {
        categorias: a.porCategoria.map((c) => ({ nombre: c.nombre, [a.empresa]: c.ingresos })),
        periodos: a.porPeriodo.map((p) => ({ nombre: p.nombre, [a.empresa]: p.ingresos })),
        resumen: [
          { indicador: "Ingresos", [a.empresa]: a.ingresos },
          { indicador: "Unidades", [a.empresa]: a.unidades },
          { indicador: "Ticket promedio", [a.empresa]: a.ticketPromedio }
        ]
      }
    }

    const unir = (listaA, listaB) => {
      const nombres = [...new Set([...listaA.map((x) => x.nombre), ...listaB.map((x) => x.nombre)])]

      return nombres.map((nombre) => ({
        nombre,
        [a.empresa]: listaA.find((x) => x.nombre === nombre)?.ingresos || 0,
        [b.empresa]: listaB.find((x) => x.nombre === nombre)?.ingresos || 0
      }))
    }

    return {
      categorias: unir(a.porCategoria, b.porCategoria),
      periodos: unir(a.porPeriodo, b.porPeriodo).sort((x, y) => x.nombre.localeCompare(y.nombre)),
      resumen: [
        { indicador: "Ingresos", [a.empresa]: a.ingresos, [b.empresa]: b.ingresos },
        { indicador: "Unidades", [a.empresa]: a.unidades, [b.empresa]: b.unidades },
        { indicador: "Ticket promedio", [a.empresa]: a.ticketPromedio, [b.empresa]: b.ticketPromedio },
        { indicador: "Productos", [a.empresa]: a.productos, [b.empresa]: b.productos }
      ]
    }
  }
}

export default new Comparador()
