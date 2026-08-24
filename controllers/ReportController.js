import ReportModel from "../models/ReportModel.js"
import Insight from "../utils/Insight.js"

class ReportController {
  async index(req, res) {
    try {
      const model = new ReportModel(req.token)

      const [dishes, categories, items, menus, orders, pages] = await Promise.all([
        model.dishes(),
        model.categories(),
        model.items(),
        model.menus(),
        model.orders(),
        model.pages()
      ])

      const published = items.filter((item) => item.menu_pages.menus.status === "published")

      res.json({
        summary: this.summary(dishes, menus, published, orders),
        byCategory: this.byCategory(dishes, categories),
        topDishes: this.topDishes(published, dishes),
        salesByDate: this.salesByDate(orders),
        priceRange: this.priceRange(published),
        insights: Insight.generate({
          dishes,
          categories,
          items: published,
          orders,
          menus,
          pages
        })
      })
    } catch (error) {
      res.status(500).json({ error: "No se pudieron cargar los reportes" })
    }
  }

  summary(dishes, menus, items, orders) {
    const revenue = orders.reduce((total, order) => total + (Number(order.total) || 0), 0)
    const units = orders.reduce((total, order) => total + (Number(order.quantity) || 0), 0)
    const prices = items.map((item) => Number(item.price)).filter((value) => value > 0)
    const average = prices.length
      ? prices.reduce((total, value) => total + value, 0) / prices.length
      : 0

    return {
      dishes: dishes.filter((dish) => dish.is_active).length,
      menus: menus.filter((menu) => menu.status === "published").length,
      items: items.length,
      averagePrice: Number(average.toFixed(2)),
      revenue: Number(revenue.toFixed(2)),
      units
    }
  }

  byCategory(dishes, categories) {
    return categories.map((category) => ({
      name: category.name,
      total: dishes.filter((dish) => dish.category_id === category.id).length
    }))
  }

  topDishes(items, dishes) {
    const names = {}
    dishes.forEach((dish) => {
      names[dish.id] = dish.name
    })

    const count = {}
    items.forEach((item) => {
      count[item.dish_id] = (count[item.dish_id] || 0) + 1
    })

    return Object.keys(count)
      .map((id) => ({ name: names[id] || "Sin nombre", total: count[id] }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
  }

  salesByDate(orders) {
    const totals = {}

    orders.forEach((order) => {
      const date = order.order_date
      if (!date) return
      totals[date] = (totals[date] || 0) + (Number(order.total) || 0)
    })

    return Object.keys(totals)
      .sort()
      .map((date) => ({ date, total: Number(totals[date].toFixed(2)) }))
  }

  priceRange(items) {
    const grouped = {}

    items.forEach((item) => {
      const name = item.dishes?.name
      const price = Number(item.price)
      if (!name || !price) return

      if (!grouped[name]) grouped[name] = { name, lowest: price, highest: price, times: 0 }

      grouped[name].lowest = Math.min(grouped[name].lowest, price)
      grouped[name].highest = Math.max(grouped[name].highest, price)
      grouped[name].times += 1
    })

    return Object.values(grouped)
      .sort((a, b) => b.times - a.times)
      .slice(0, 10)
  }
}

const controller = new ReportController()

export default {
  index: controller.index.bind(controller)
}
