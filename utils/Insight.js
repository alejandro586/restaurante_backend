const ORDER = { warning: 0, info: 1 }

class Insight {
  generate(data) {
    const context = this.prepare(data)

    const list = [
      ...this.catalogBalance(context),
      ...this.menuBalance(context),
      ...this.missingCategory(context),
      ...this.repeatedInMenu(context),
      ...this.emptySections(context),
      ...this.longSections(context),
      ...this.itemsWithoutPrice(context),
      ...this.priceOutlier(context),
      ...this.priceJumps(context),
      ...this.priceDrops(context),
      ...this.priceGap(context),
      ...this.featuredBalance(context),
      ...this.missingDescription(context),
      ...this.unusedDishes(context),
      ...this.inactiveDishes(context),
      ...this.menuAging(context),
      ...this.draftMenus(context),
      ...this.noSales(context),
      ...this.salesConcentration(context),
      ...this.dishesWithoutSales(context),
      ...this.categoryWithoutSales(context),
      ...this.pendingOrders(context),
      ...this.discountImpact(context),
      ...this.salesTrend(context)
    ]

    if (list.length === 0) {
      return [
        {
          level: "info",
          title: "Todo en orden",
          message:
            "Las cartas estan equilibradas y no se detectan situaciones que requieran atencion."
        }
      ]
    }

    return list.sort((a, b) => ORDER[a.level] - ORDER[b.level]).slice(0, 3)
  }

  count(value, singular, plural) {
    return `${value} ${value === 1 ? singular : plural}`
  }

  prepare({ dishes = [], categories = [], items = [], orders = [], menus = [], pages = [] }) {
    const dishName = {}
    const dishCategory = {}

    dishes.forEach((dish) => {
      dishName[dish.id] = dish.name
      dishCategory[dish.id] = dish.category_id
    })

    const categoryName = {}
    categories.forEach((category) => {
      categoryName[category.id] = category.name
    })

    const publishedMenus = menus.filter((menu) => menu.status === "published")

    return {
      dishes,
      categories,
      items,
      orders,
      menus,
      pages,
      publishedMenus,
      dishName,
      dishCategory,
      categoryName
    }
  }

  catalogBalance({ dishes, categories, categoryName }) {
    if (categories.length < 2 || dishes.length < 10) return []

    const count = {}
    categories.forEach((category) => {
      count[category.id] = 0
    })

    dishes.forEach((dish) => {
      if (count[dish.category_id] !== undefined) count[dish.category_id] += 1
    })

    const values = categories.map((category) => ({
      name: categoryName[category.id],
      total: count[category.id]
    }))

    const max = values.reduce((a, b) => (a.total > b.total ? a : b))
    const min = values.reduce((a, b) => (a.total < b.total ? a : b))

    if (max.total < min.total * 3 || max.total < 5) return []

    const share = Math.round((max.total / dishes.length) * 100)

    return [
      {
        level: "warning",
        title: "Catalogo desbalanceado",
        message:
          `La categoria ${max.name} concentra ${max.total} platos, el ${share} por ciento del catalogo, ` +
          `mientras que ${min.name} ${min.total === 0 ? "no tiene ninguno" : `solo tiene ${min.total}`}. ` +
          `Un catalogo cargado hacia una sola categoria ` +
          `limita las opciones al armar cartas variadas. Se recomienda ampliar la oferta de ${min.name} ` +
          `antes de seguir sumando platos de ${max.name}.`
      }
    ]
  }

  menuBalance({ items, dishCategory, categoryName, publishedMenus }) {
    const alerts = []

    publishedMenus.forEach((menu) => {
      const own = items.filter((item) => item.menu_pages.menus.id === menu.id)
      if (own.length < 5) return

      const count = {}

      own.forEach((item) => {
        const category = dishCategory[item.dish_id]
        if (!category) return
        count[category] = (count[category] || 0) + 1
      })

      const keys = Object.keys(count)
      if (keys.length < 2) return

      const top = keys.reduce((a, b) => (count[a] > count[b] ? a : b))
      const low = keys.reduce((a, b) => (count[a] < count[b] ? a : b))
      const share = Math.round((count[top] / own.length) * 100)

      if (share < 55) return

      alerts.push({
        level: "warning",
        title: `Carta desbalanceada en ${menu.name}`,
        message:
          `El ${share} por ciento de los platos de esta carta son de la categoria ${categoryName[top]} ` +
          `y solo hay ${count[low]} de ${categoryName[low]}. Una carta concentrada en un solo tipo de plato ` +
          `reduce el ticket promedio porque el cliente no encuentra con que acompanar. ` +
          `Se recomienda incorporar mas opciones de ${categoryName[low]}.`
      })
    })

    return alerts.slice(0, 2)
  }

  missingCategory({ items, dishCategory, categories, categoryName, publishedMenus }) {
    if (categories.length === 0) return []

    const alerts = []

    publishedMenus.forEach((menu) => {
      const own = items.filter((item) => item.menu_pages.menus.id === menu.id)
      if (own.length < 4) return

      const present = new Set(own.map((item) => dishCategory[item.dish_id]).filter(Boolean))
      const missing = categories.filter((category) => !present.has(category.id))

      if (missing.length === 0) return

      const names = missing.map((category) => categoryName[category.id]).join(" y ")

      alerts.push({
        level: "warning",
        title: `Faltan categorias en ${menu.name}`,
        message:
          `Esta carta no ofrece ninguna opcion de ${names}. Cada categoria ausente es una venta ` +
          `que se pierde por completo, sobre todo en bebidas y postres, que son las de mayor margen. ` +
          `Se recomienda agregar al menos dos opciones de ${names} antes de publicarla nuevamente.`
      })
    })

    return alerts.slice(0, 2)
  }

  repeatedInMenu({ items, dishName, publishedMenus }) {
    const alerts = []

    publishedMenus.forEach((menu) => {
      const own = items.filter((item) => item.menu_pages.menus.id === menu.id)
      const count = {}

      own.forEach((item) => {
        count[item.dish_id] = (count[item.dish_id] || 0) + 1
      })

      const repeated = Object.keys(count).filter((id) => count[id] > 1)
      if (repeated.length === 0) return

      const detail = repeated
        .slice(0, 3)
        .map((id) => `${dishName[id]} aparece ${count[id]} veces`)
        .join(", ")

      alerts.push({
        level: "warning",
        title: `Platos repetidos en ${menu.name}`,
        message:
          `${detail}. Repetir un plato en varias secciones de la misma carta confunde al cliente ` +
          `y suele generar reclamos cuando los precios no coinciden. Se recomienda dejarlo en una ` +
          `sola seccion, o diferenciarlo claramente por porcion o presentacion.`
      })
    })

    return alerts.slice(0, 2)
  }

  emptySections({ items, pages }) {
    const used = new Set(items.map((item) => item.menu_pages.id))

    const empty = pages.filter(
      (page) => page.menus.status === "published" && !used.has(page.id)
    )

    if (empty.length === 0) return []

    const detail = empty
      .slice(0, 3)
      .map((page) => `${page.section} en ${page.menus.name}`)
      .join(", ")

    return [
      {
        level: "warning",
        title: "Secciones vacias",
        message:
          `Hay ${this.count(empty.length, "seccion", "secciones")} de cartas publicadas ` +
          `sin ningun plato asignado: ${detail}. ` +
          `Una seccion vacia da la impresion de una carta incompleta. Se recomienda asignarle platos ` +
          `o eliminarla de la carta.`
      }
    ]
  }

  itemsWithoutPrice({ items }) {
    const missing = items.filter((item) => !item.price)

    if (missing.length === 0) return []

    const share = Math.round((missing.length / items.length) * 100)

    return [
      {
        level: "warning",
        title: "Platos sin precio",
        message:
          `${this.count(missing.length, "plato publicado no tiene", "platos publicados no tienen")} ` +
          `precio asignado, el ${share} por ciento de la carta. ` +
          `Sin precio no entran en el calculo del ticket promedio ni en los reportes de rentabilidad. ` +
          `Se recomienda completar los precios antes de la proxima publicacion.`
      }
    ]
  }

  priceOutlier({ items, dishName }) {
    const sections = {}

    items.forEach((item) => {
      const price = Number(item.price)
      if (!price) return

      const key = item.menu_pages.id
      if (!sections[key]) {
        sections[key] = { section: item.menu_pages.section, menu: item.menu_pages.menus.name, rows: [] }
      }

      sections[key].rows.push({ dish: item.dish_id, price })
    })

    const alerts = []

    Object.values(sections).forEach((group) => {
      if (group.rows.length < 3) return

      const total = group.rows.reduce((sum, row) => sum + row.price, 0)
      const average = total / group.rows.length
      const top = group.rows.reduce((a, b) => (a.price > b.price ? a : b))

      if (top.price < average * 2) return

      alerts.push({
        level: "info",
        title: "Precio fuera de rango",
        message:
          `${dishName[top.dish]} cuesta ${top.price} en la seccion ${group.section} de ${group.menu}, ` +
          `mas del doble del promedio de esa seccion, que es ${average.toFixed(2)}. ` +
          `Un precio muy alejado del resto suele quedar sin rotacion. Se recomienda revisarlo o ` +
          `moverlo a una seccion de especialidades.`
      })
    })

    return alerts.slice(0, 1)
  }

  priceJumps({ items }) {
    const history = {}

    items.forEach((item) => {
      const date = item.menu_pages.menus.menu_date
      const price = Number(item.price)
      const name = item.dishes ? item.dishes.name : null

      if (!date || !price || !name) return

      if (!history[name]) history[name] = []
      history[name].push({ date, price })
    })

    const alerts = []

    Object.keys(history).forEach((name) => {
      const rows = history[name].sort((a, b) => a.date.localeCompare(b.date))
      if (rows.length < 2) return

      const first = rows[0].price
      const last = rows[rows.length - 1].price
      const change = ((last - first) / first) * 100

      if (change >= 25) alerts.push({ name, change: Math.round(change), first, last })
    })

    if (alerts.length === 0) return []

    const top = alerts.sort((a, b) => b.change - a.change)[0]

    return [
      {
        level: "warning",
        title: "Incremento de precio pronunciado",
        message:
          `${top.name} paso de ${top.first} a ${top.last} entre cartas, un aumento del ${top.change} por ciento. ` +
          `Subidas de este tamano se notan y pueden desplazar al cliente hacia opciones mas baratas. ` +
          `Se recomienda verificar que el costo del insumo lo justifique y escalonar el ajuste.`
      }
    ]
  }

  unusedDishes({ dishes, items, dishName }) {
    const active = dishes.filter((dish) => dish.is_active)
    if (active.length === 0) return []

    const used = new Set(items.map((item) => item.dish_id))
    const idle = active.filter((dish) => !used.has(dish.id))

    if (idle.length === 0) return []

    const share = Math.round((idle.length / active.length) * 100)
    if (share < 25) return []

    const sample = idle
      .slice(0, 3)
      .map((dish) => dishName[dish.id])
      .join(", ")

    return [
      {
        level: share > 60 ? "warning" : "info",
        title: "Catalogo subutilizado",
        message:
          `${idle.length} platos activos, el ${share} por ciento del catalogo, no aparecen en ninguna carta. ` +
          `Ejemplos: ${sample}. Mantener platos que nunca se ofrecen dificulta encontrar los que si se usan. ` +
          `Se recomienda incorporarlos a una carta de temporada o darlos de baja.`
      }
    ]
  }

  inactiveDishes({ dishes }) {
    if (dishes.length < 20) return []

    const inactive = dishes.filter((dish) => !dish.is_active)
    if (inactive.length === 0) return []

    const share = Math.round((inactive.length / dishes.length) * 100)
    if (share < 30) return []

    return [
      {
        level: "info",
        title: "Muchos platos inactivos",
        message:
          `${inactive.length} platos estan desactivados, el ${share} por ciento del catalogo. ` +
          `Se recomienda revisar si alguno puede reincorporarse a la carta antes de crear platos nuevos ` +
          `que cumplan la misma funcion.`
      }
    ]
  }

  salesConcentration({ orders, dishName }) {
    if (orders.length === 0) return []

    const totals = {}
    let global = 0

    orders.forEach((order) => {
      const amount = Number(order.total) || 0
      totals[order.dish_id] = (totals[order.dish_id] || 0) + amount
      global += amount
    })

    if (global === 0) return []

    const ranking = Object.keys(totals)
      .map((id) => ({ id: Number(id), amount: totals[id] }))
      .sort((a, b) => b.amount - a.amount)

    const top = ranking[0]
    const share = Math.round((top.amount / global) * 100)

    if (share < 20) return []

    return [
      {
        level: share > 40 ? "warning" : "info",
        title: "Ventas concentradas en un plato",
        message:
          `${dishName[top.id] || "Un plato"} concentra el ${share} por ciento de los ingresos. ` +
          `Depender de un solo plato es riesgoso si sube el precio del insumo o se agota. ` +
          `Se recomienda asegurar su abastecimiento y promover platos con margen similar para repartir la demanda.`
      }
    ]
  }

  longSections({ items }) {
    const sections = {}

    items.forEach((item) => {
      const key = item.menu_pages.id
      if (!sections[key]) {
        sections[key] = { section: item.menu_pages.section, menu: item.menu_pages.menus.name, total: 0 }
      }
      sections[key].total += 1
    })

    const long = Object.values(sections)
      .filter((group) => group.total > 12)
      .sort((a, b) => b.total - a.total)

    if (long.length === 0) return []

    const top = long[0]

    return [
      {
        level: "info",
        title: "Seccion demasiado extensa",
        message:
          `La seccion ${top.section} de ${top.menu} tiene ${top.total} platos. Las cartas muy largas ` +
          `alargan la decision del cliente y complican la operacion en cocina. ` +
          `Se recomienda dejar entre seis y diez opciones por seccion y rotar el resto por temporada.`
      }
    ]
  }

  priceDrops({ items }) {
    const history = {}

    items.forEach((item) => {
      const date = item.menu_pages.menus.menu_date
      const price = Number(item.price)
      const name = item.dishes ? item.dishes.name : null

      if (!date || !price || !name) return

      if (!history[name]) history[name] = []
      history[name].push({ date, price })
    })

    const alerts = []

    Object.keys(history).forEach((name) => {
      const rows = history[name].sort((a, b) => a.date.localeCompare(b.date))
      if (rows.length < 2) return

      const first = rows[0].price
      const last = rows[rows.length - 1].price
      const change = ((first - last) / first) * 100

      if (change >= 20) alerts.push({ name, change: Math.round(change), first, last })
    })

    if (alerts.length === 0) return []

    const top = alerts.sort((a, b) => b.change - a.change)[0]

    return [
      {
        level: "info",
        title: "Reduccion de precio",
        message:
          `${top.name} bajo de ${top.first} a ${top.last}, una reduccion del ${top.change} por ciento. ` +
          `Si no respondio a una caida real del costo, el margen se esta absorbiendo. ` +
          `Se recomienda comparar el precio con el costo actual del insumo antes de mantenerlo.`
      }
    ]
  }

  priceGap({ items }) {
    const grouped = {}

    items.forEach((item) => {
      const price = Number(item.price)
      const name = item.dishes ? item.dishes.name : null
      if (!price || !name) return

      if (!grouped[name]) grouped[name] = []
      grouped[name].push(price)
    })

    const alerts = []

    Object.keys(grouped).forEach((name) => {
      const prices = grouped[name]
      if (prices.length < 2) return

      const low = Math.min(...prices)
      const high = Math.max(...prices)

      if (high < low * 1.5) return

      alerts.push({ name, low, high, gap: Math.round(((high - low) / low) * 100) })
    })

    if (alerts.length === 0) return []

    const top = alerts.sort((a, b) => b.gap - a.gap)[0]

    return [
      {
        level: "warning",
        title: "Mismo plato con precios muy distintos",
        message:
          `${top.name} se ofrece desde ${top.low} hasta ${top.high}, una diferencia del ${top.gap} por ciento ` +
          `entre cartas. Cuando el cliente nota la brecha percibe un precio arbitrario. ` +
          `Se recomienda unificar el precio o diferenciar claramente la porcion de cada version.`
      }
    ]
  }

  featuredBalance({ items }) {
    if (items.length < 6) return []

    const featured = items.filter((item) => item.is_featured).length

    if (featured === 0) {
      return [
        {
          level: "info",
          title: "Ningun plato destacado",
          message:
            `Ninguno de los ${items.length} platos publicados esta marcado como destacado. ` +
            `Los platos destacados guian la eleccion del cliente hacia las opciones de mejor margen. ` +
            `Se recomienda destacar entre dos y cuatro por carta.`
        }
      ]
    }

    const share = Math.round((featured / items.length) * 100)

    if (share < 30) return []

    return [
      {
        level: "info",
        title: "Demasiados platos destacados",
        message:
          `${featured} platos estan marcados como destacados, el ${share} por ciento de la carta. ` +
          `Cuando casi todo esta destacado, el cliente deja de distinguir la recomendacion. ` +
          `Se recomienda reducirlos a los pocos que realmente quieras impulsar.`
      }
    ]
  }

  missingDescription({ dishes }) {
    const active = dishes.filter((dish) => dish.is_active)
    if (active.length < 10) return []

    const missing = active.filter((dish) => !dish.description || !dish.description.trim())
    if (missing.length === 0) return []

    const share = Math.round((missing.length / active.length) * 100)
    if (share < 20) return []

    return [
      {
        level: "info",
        title: "Platos sin descripcion",
        message:
          `${missing.length} platos activos no tienen descripcion, el ${share} por ciento del catalogo. ` +
          `La descripcion es lo que convence al cliente que no conoce el plato. ` +
          `Se recomienda completarla al menos en los que aparecen en cartas publicadas.`
      }
    ]
  }

  menuAging({ publishedMenus }) {
    if (publishedMenus.length === 0) return []

    const dates = publishedMenus
      .map((menu) => menu.menu_date)
      .filter(Boolean)
      .sort()

    if (dates.length === 0) return []

    const last = new Date(dates[dates.length - 1])
    const today = new Date()
    const months = Math.floor((today - last) / (1000 * 60 * 60 * 24 * 30))

    if (months < 6) return []

    return [
      {
        level: "warning",
        title: "Carta sin renovar",
        message:
          `La carta publicada mas reciente es de hace ${months} meses. Una carta sin cambios pierde ` +
          `atractivo para el cliente habitual y no refleja los precios ni los insumos de temporada. ` +
          `Se recomienda preparar una carta nueva o actualizar la vigente.`
      }
    ]
  }

  draftMenus({ menus }) {
    const drafts = menus.filter((menu) => menu.status === "draft")
    if (drafts.length === 0) return []

    const names = drafts.slice(0, 3).map((menu) => menu.name).join(", ")

    return [
      {
        level: "info",
        title: "Cartas en borrador",
        message:
          `Hay ${this.count(drafts.length, "carta", "cartas")} en borrador: ${names}. ` +
          `Mientras esten en borrador no entran en los reportes ni son visibles como oferta vigente. ` +
          `Se recomienda publicarlas o archivarlas para mantener el historial limpio.`
      }
    ]
  }

  noSales({ orders, items }) {
    if (orders.length > 0 || items.length === 0) return []

    return [
      {
        level: "info",
        title: "Sin ventas registradas",
        message:
          `Hay ${items.length} platos publicados pero ninguna venta cargada. Sin ventas no es posible ` +
          `saber que platos funcionan ni calcular el ticket promedio. ` +
          `Se recomienda empezar a registrar los pedidos para que los reportes reflejen el negocio real.`
      }
    ]
  }

  categoryWithoutSales({ orders, items, dishCategory, categoryName }) {
    if (orders.length === 0) return []

    const sold = new Set(orders.map((order) => dishCategory[order.dish_id]).filter(Boolean))
    const offered = new Set(items.map((item) => dishCategory[item.dish_id]).filter(Boolean))

    const idle = [...offered].filter((id) => !sold.has(id))
    if (idle.length === 0) return []

    const names = idle.map((id) => categoryName[id]).filter(Boolean).join(" y ")
    if (!names) return []

    return [
      {
        level: "warning",
        title: "Categoria sin ninguna venta",
        message:
          `No se registra una sola venta de ${names}, aunque hay platos publicados en esa categoria. ` +
          `Suele deberse a que el mozo no la ofrece o a que esta al final de la carta. ` +
          `Se recomienda sugerirla de forma activa y ubicarla en un lugar mas visible.`
      }
    ]
  }

  pendingOrders({ orders }) {
    if (orders.length < 5) return []

    const pending = orders.filter((order) => order.status === "pendiente")
    if (pending.length === 0) return []

    const share = Math.round((pending.length / orders.length) * 100)
    if (share < 25) return []

    return [
      {
        level: "warning",
        title: "Pedidos pendientes acumulados",
        message:
          `${pending.length} pedidos siguen en estado pendiente, el ${share} por ciento del total. ` +
          `Los pedidos sin cerrar distorsionan el calculo de ingresos y pueden esconder cobros no realizados. ` +
          `Se recomienda revisarlos y cerrarlos antes de tomar decisiones sobre la carta.`
      }
    ]
  }

  discountImpact({ orders }) {
    if (orders.length < 5) return []

    let discount = 0
    let gross = 0

    orders.forEach((order) => {
      discount += Number(order.discount) || 0
      gross += (Number(order.quantity) || 0) * (Number(order.unit_price) || 0)
    })

    if (gross === 0 || discount === 0) return []

    const share = Math.round((discount / gross) * 100)
    if (share < 10) return []

    return [
      {
        level: "warning",
        title: "Descuentos elevados",
        message:
          `Los descuentos representan el ${share} por ciento de la venta bruta. ` +
          `Un descuento sostenido en ese nivel indica que el precio de carta esta por encima de lo que ` +
          `el cliente acepta pagar. Se recomienda ajustar los precios en lugar de descontar caso por caso.`
      }
    ]
  }

  salesTrend({ orders }) {
    if (orders.length < 8) return []

    const totals = {}

    orders.forEach((order) => {
      if (!order.order_date) return
      totals[order.order_date] = (totals[order.order_date] || 0) + (Number(order.total) || 0)
    })

    const dates = Object.keys(totals).sort()
    if (dates.length < 4) return []

    const half = Math.floor(dates.length / 2)
    const before = dates.slice(0, half).reduce((sum, date) => sum + totals[date], 0) / half
    const after =
      dates.slice(half).reduce((sum, date) => sum + totals[date], 0) / (dates.length - half)

    if (before === 0) return []

    const change = Math.round(((after - before) / before) * 100)

    if (change <= -20) {
      return [
        {
          level: "warning",
          title: "Ingresos en caida",
          message:
            `Los ingresos del periodo mas reciente son ${Math.abs(change)} por ciento menores que los del ` +
            `periodo anterior. Se recomienda revisar si coincide con un cambio de carta o de precios, ` +
            `y reforzar la promocion de los platos con mejor margen.`
        }
      ]
    }

    if (change >= 25) {
      return [
        {
          level: "info",
          title: "Ingresos en alza",
          message:
            `Los ingresos crecieron ${change} por ciento respecto al periodo anterior. ` +
            `Se recomienda identificar que platos impulsaron la subida y asegurar su abastecimiento ` +
            `antes de que la demanda supere la capacidad de cocina.`
        }
      ]
    }

    return []
  }

  dishesWithoutSales({ orders, items, dishName }) {
    if (orders.length === 0) return []

    const sold = new Set(orders.map((order) => order.dish_id))
    const published = new Set(items.map((item) => item.dish_id))
    const idle = [...published].filter((id) => !sold.has(id))

    if (idle.length === 0) return []

    const sample = idle
      .slice(0, 3)
      .map((id) => dishName[id])
      .filter(Boolean)
      .join(", ")

    return [
      {
        level: "warning",
        title: "Platos publicados sin ventas",
        message:
          `${this.count(idle.length, "plato esta", "platos estan")} en carta pero sin ninguna venta ` +
          `registrada. Ejemplos: ${sample}. ` +
          `Ocupan espacio en la carta y obligan a mantener insumos que rotan poco. ` +
          `Se recomienda destacarlos durante una semana y, si no mejoran, reemplazarlos.`
      }
    ]
  }
}

export default new Insight()
