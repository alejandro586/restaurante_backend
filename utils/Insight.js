const PESO = { oportunidad: 0, alerta: 1, info: 2 }

const soles = (valor) =>
  `S/ ${Number(valor || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const miles = (valor) => Number(valor || 0).toLocaleString("es-PE")

const porcentaje = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : 0)

/**
 * Genera las observaciones de la comparacion. Todas las reglas reciben
 * "nuestra" (la empresa propia) y "otra" (con la que se compara), y solo
 * hablan cuando la diferencia es lo bastante grande como para importar.
 */
class Insight {
  comparar(nuestra, otra) {
    if (!otra) return this.individual(nuestra)

    // El peso del canal ya explica el delivery con numeros propios, asi que
    // la regla generica de capacidades no vuelve a mencionarlo.
    const canal = this.pesoDelCanal(nuestra, otra)
    const yaCubiertas = canal.length > 0 ? ["delivery"] : []

    const lista = [
      ...this.brechaIngresos(nuestra, otra),
      ...this.capacidadesFaltantes(nuestra, otra, yaCubiertas),
      ...canal,
      ...this.ticketPromedio(nuestra, otra),
      ...this.amplitudCatalogo(nuestra, otra),
      ...this.categoriasFaltantes(nuestra, otra),
      ...this.concentracion(nuestra, otra),
      ...this.tendencia(nuestra, otra)
    ]

    if (lista.length === 0) {
      return [
        {
          nivel: "info",
          titulo: "Rendimiento equiparable",
          mensaje:
            `${nuestra.empresa} y ${otra.empresa} muestran cifras muy similares en ingresos, ` +
            `ticket promedio y amplitud de catalogo. No se detectan diferencias estructurales ` +
            `que expliquen una ventaja de una sobre otra.`
        }
      ]
    }

    return lista.sort((a, b) => PESO[a.nivel] - PESO[b.nivel]).slice(0, 6)
  }

  /** Cuando se elige un solo archivo no hay contra que comparar. */
  individual(datos) {
    const lista = []

    if (datos.topProductos.length > 0) {
      const lider = datos.topProductos[0]
      const share = porcentaje(lider.ingresos, datos.ingresos)

      if (share >= 15) {
        lista.push({
          nivel: "alerta",
          titulo: "Ingresos concentrados en un producto",
          mensaje:
            `${lider.nombre} genera ${soles(lider.ingresos)}, el ${share} por ciento de todo el ` +
            `ingreso registrado. Depender tanto de un solo plato es un riesgo: si sube el costo ` +
            `de su insumo principal o sale de carta, cae la facturacion completa.`
        })
      }
    }

    if (datos.porCategoria.length > 1) {
      const mayor = datos.porCategoria[0]
      const menor = datos.porCategoria[datos.porCategoria.length - 1]

      lista.push({
        nivel: "info",
        titulo: "Distribucion por categoria",
        mensaje:
          `${mayor.nombre} aporta ${soles(mayor.ingresos)} (${porcentaje(mayor.ingresos, datos.ingresos)} ` +
          `por ciento) y ${menor.nombre} apenas ${soles(menor.ingresos)}. ` +
          `Compara este archivo con el de otro restaurante para ver si esa diferencia es normal del rubro.`
      })
    }

    lista.push({
      nivel: "info",
      titulo: "Resumen del archivo",
      mensaje:
        `${miles(datos.totalFilas)} filas, ${datos.productos} productos distintos, ` +
        `${miles(datos.unidades)} unidades y ${soles(datos.ingresos)} de ingreso. ` +
        `Ticket promedio de ${soles(datos.ticketPromedio)}.`
    })

    return lista.slice(0, 4)
  }

  brechaIngresos(nuestra, otra) {
    if (nuestra.ingresos <= 0 || otra.ingresos <= 0) return []

    const veces = otra.ingresos / nuestra.ingresos
    if (veces < 1.15) return []

    const diferencia = otra.ingresos - nuestra.ingresos

    const causa =
      otra.unidades > nuestra.unidades
        ? `Vende ${miles(otra.unidades - nuestra.unidades)} unidades mas, asi que la brecha es de volumen, no solo de precio.`
        : `Lo hace con menos unidades vendidas, asi que la brecha viene del precio y no del volumen.`

    return [
      {
        nivel: "alerta",
        titulo: `${otra.empresa} factura ${veces.toFixed(1)} veces mas`,
        mensaje:
          `${otra.empresa} registra ${soles(otra.ingresos)} frente a ${soles(nuestra.ingresos)} de ` +
          `${nuestra.empresa}: una diferencia de ${soles(diferencia)} en el mismo periodo. ${causa}`
      }
    ]
  }

  /**
   * La regla central del sistema: que hace la competencia que nosotros ni
   * siquiera registramos. Cada hallazgo trae la accion concreta para el
   * modulo del trabajador.
   */
  capacidadesFaltantes(nuestra, otra, excluir = []) {
    const propias = new Set(nuestra.capacidades.map((c) => c.clave))
    const faltantes = otra.capacidades.filter(
      (c) => !propias.has(c.clave) && !excluir.includes(c.clave)
    )

    if (faltantes.length === 0) return []

    return faltantes.slice(0, 3).map((capacidad) => {
      const desglose = otra.porCapacidad[capacidad.clave]
      let detalle = ""

      // Solo cuentan los grupos que demuestran uso real de la capacidad:
      // en una columna canal, "Salon" no prueba nada sobre el delivery.
      const usados = desglose ? desglose.grupos.filter((g) => g.usa) : []

      if (usados.length > 0) {
        const suma = desglose.ingresoQueUsa
        const share = porcentaje(suma, otra.ingresos)

        detalle = desglose.esMedida
          ? ` Lo registra en ${miles(desglose.filasConRegistro)} de sus ventas, que suman ${soles(suma)}: ` +
            `el ${share} por ciento de su facturacion.`
          : ` En su archivo eso representa ${soles(suma)}, el ${share} por ciento de su facturacion, ` +
            `sobre ${usados.map((g) => g.nombre).join(", ")}.`
      }

      return {
        nivel: "oportunidad",
        titulo: `${capacidad.etiqueta}: lo tiene ${otra.empresa}, nosotros no`,
        mensaje:
          `${otra.empresa} registra la columna "${capacidad.columna}" y ${nuestra.empresa} no tiene ` +
          `nada equivalente.${detalle} Sin ese dato no se puede medir el impacto ni decidir si conviene ` +
          `implementarlo. El primer paso es empezar a registrarlo.`,
        accion: {
          tipo: "agregar_columna",
          columna: capacidad.sugerencia.columna,
          tipoDato: capacidad.sugerencia.tipo,
          ejemplo: capacidad.sugerencia.ejemplo
        }
      }
    })
  }

  /** Si la competencia tiene delivery, cuanto le aporta realmente. */
  pesoDelCanal(nuestra, otra) {
    const desglose = otra.porCapacidad.delivery
    if (!desglose) return []

    const propio = nuestra.porCapacidad.delivery
    if (propio) return []

    const delivery = desglose.grupos.filter((g) => g.usa)
    if (delivery.length === 0) return []

    const ingreso = desglose.ingresoQueUsa
    const share = porcentaje(ingreso, otra.ingresos)

    if (share < 8) return []

    return [
      {
        nivel: "oportunidad",
        titulo: `El delivery le aporta el ${share} por ciento a ${otra.empresa}`,
        mensaje:
          `De los ${soles(otra.ingresos)} que factura ${otra.empresa}, ${soles(ingreso)} salen del canal ` +
          `de reparto. ${nuestra.empresa} vende unicamente en salon, de modo que esa porcion del mercado ` +
          `hoy no se disputa. Aun capturando la mitad de esa proporcion, el ingreso subiria alrededor de ` +
          `${soles(nuestra.ingresos * (share / 200))}.`
      }
    ]
  }

  ticketPromedio(nuestra, otra) {
    if (nuestra.ticketPromedio <= 0 || otra.ticketPromedio <= 0) return []

    const diferencia = otra.ticketPromedio - nuestra.ticketPromedio
    const share = porcentaje(Math.abs(diferencia), nuestra.ticketPromedio)

    if (share < 10) return []

    if (diferencia > 0) {
      return [
        {
          nivel: "oportunidad",
          titulo: `Ticket promedio ${share} por ciento por debajo`,
          mensaje:
            `Cada venta de ${otra.empresa} deja ${soles(otra.ticketPromedio)} y cada venta de ` +
            `${nuestra.empresa} deja ${soles(nuestra.ticketPromedio)}. Con las ${miles(nuestra.unidades)} ` +
            `unidades que ya se venden, igualar ese ticket significaria ` +
            `${soles(diferencia * nuestra.unidades)} adicionales sin vender un plato mas.`
        }
      ]
    }

    return [
      {
        nivel: "info",
        titulo: `Ticket promedio ${share} por ciento por encima`,
        mensaje:
          `${nuestra.empresa} cobra ${soles(nuestra.ticketPromedio)} por venta contra ` +
          `${soles(otra.ticketPromedio)} de ${otra.empresa}. La desventaja no esta en el precio: ` +
          `revisa volumen y variedad antes de tocar la carta.`
      }
    ]
  }

  amplitudCatalogo(nuestra, otra) {
    if (nuestra.productos === 0 || otra.productos === 0) return []
    if (otra.productos < nuestra.productos * 1.25) return []

    return [
      {
        nivel: "info",
        titulo: "Catalogo mas amplio en la competencia",
        mensaje:
          `${otra.empresa} mueve ${otra.productos} productos distintos y ${nuestra.empresa} solo ` +
          `${nuestra.productos}. Una carta mas amplia capta ocasiones de consumo que hoy se pierden, ` +
          `aunque tambien sube la complejidad de cocina: conviene ampliar por categoria y medir.`
      }
    ]
  }

  categoriasFaltantes(nuestra, otra) {
    if (nuestra.porCategoria.length === 0 || otra.porCategoria.length === 0) return []

    const propias = new Set(nuestra.porCategoria.map((c) => c.nombre.toLowerCase()))
    const faltantes = otra.porCategoria.filter((c) => !propias.has(c.nombre.toLowerCase()))

    if (faltantes.length === 0) return []

    const ingreso = faltantes.reduce((total, c) => total + c.ingresos, 0)
    const share = porcentaje(ingreso, otra.ingresos)

    if (share < 5) return []

    return [
      {
        nivel: "oportunidad",
        titulo: `Categorias sin cubrir: ${faltantes.map((c) => c.nombre).join(", ")}`,
        mensaje:
          `${otra.empresa} factura ${soles(ingreso)} en categorias que ${nuestra.empresa} no trabaja, ` +
          `el ${share} por ciento de su ingreso. Cada categoria ausente es una venta que no se pierde ` +
          `frente a un competidor: directamente no existe la oportunidad de hacerla.`
      }
    ]
  }

  concentracion(nuestra) {
    if (nuestra.topProductos.length === 0 || nuestra.ingresos <= 0) return []

    const lider = nuestra.topProductos[0]
    const share = porcentaje(lider.ingresos, nuestra.ingresos)

    if (share < 18) return []

    return [
      {
        nivel: "alerta",
        titulo: "Dependencia de un solo plato",
        mensaje:
          `${lider.nombre} concentra el ${share} por ciento del ingreso de ${nuestra.empresa} ` +
          `(${soles(lider.ingresos)}). Un quiebre de stock o una subida del insumo golpea toda la ` +
          `facturacion. Conviene impulsar el segundo y tercer plato antes de ampliar la carta.`
      }
    ]
  }

  tendencia(nuestra, otra) {
    if (nuestra.porPeriodo.length < 3 || otra.porPeriodo.length < 3) return []

    const crecimiento = (serie) => {
      const mitad = Math.floor(serie.length / 2)
      const inicio = serie.slice(0, mitad).reduce((t, p) => t + p.ingresos, 0)
      const fin = serie.slice(mitad).reduce((t, p) => t + p.ingresos, 0)
      return inicio > 0 ? ((fin - inicio) / inicio) * 100 : 0
    }

    const nuestro = crecimiento(nuestra.porPeriodo)
    const ajeno = crecimiento(otra.porPeriodo)

    if (Math.abs(ajeno - nuestro) < 12) return []

    if (ajeno > nuestro) {
      return [
        {
          nivel: "alerta",
          titulo: "La brecha se esta ampliando",
          mensaje:
            `En la segunda mitad del periodo ${otra.empresa} crecio ${ajeno.toFixed(0)} por ciento y ` +
            `${nuestra.empresa} ${nuestro.toFixed(0)} por ciento. No es una ventaja estatica: la distancia ` +
            `aumenta mes a mes, asi que postergar la reaccion la vuelve mas cara.`
        }
      ]
    }

    return [
      {
        nivel: "info",
        titulo: "Cerrando la brecha",
        mensaje:
          `${nuestra.empresa} crecio ${nuestro.toFixed(0)} por ciento en la segunda mitad del periodo ` +
          `contra ${ajeno.toFixed(0)} por ciento de ${otra.empresa}. La tendencia favorece a la empresa: ` +
          `conviene sostener lo que se cambio ultimamente.`
      }
    ]
  }
}

export default new Insight()
