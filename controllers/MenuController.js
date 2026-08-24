import MenuModel from "../models/MenuModel.js"

const failed = (res, error) => {
  if (error.code === "23503") {
    return res.status(409).json({ error: "El plato o la seccion no existen" })
  }
  res.status(500).json({ error: "No se pudo completar la operacion" })
}

class MenuController {
  async index(req, res) {
    try {
      const model = new MenuModel(req.token)
      const items = await model.findItems(req.query)
      res.json(items)
    } catch (error) {
      failed(res, error)
    }
  }

  async menus(req, res) {
    try {
      const model = new MenuModel(req.token)
      const menus = await model.findMenus()
      res.json(menus)
    } catch (error) {
      failed(res, error)
    }
  }

  async sections(req, res) {
    try {
      const model = new MenuModel(req.token)
      const sections = await model.findSections(req.params.menuId)
      res.json(sections)
    } catch (error) {
      failed(res, error)
    }
  }

  async assign(req, res) {
    const { dishId, pageId, price, highPrice, note, isFeatured } = req.body

    if (!dishId || !pageId) {
      return res.status(400).json({ error: "Debe seleccionar el plato, el menu y la seccion" })
    }

    if (price !== undefined && price !== null && price !== "" && Number(price) < 0) {
      return res.status(400).json({ error: "El precio no puede ser negativo" })
    }

    if (highPrice && Number(highPrice) < Number(price)) {
      return res.status(400).json({ error: "El precio maximo debe ser mayor al precio base" })
    }

    try {
      const model = new MenuModel(req.token)
      const position = await model.nextPosition(pageId)

      const item = await model.assign({
        menu_page_id: pageId,
        dish_id: dishId,
        price: price === "" || price === undefined ? null : Number(price),
        high_price: highPrice ? Number(highPrice) : null,
        note: note ? note.trim() : null,
        is_featured: Boolean(isFeatured),
        position
      })

      res.status(201).json(item)
    } catch (error) {
      failed(res, error)
    }
  }

  async updateItem(req, res) {
    const { price, highPrice, note, isFeatured, position } = req.body

    if (price !== undefined && price !== null && price !== "" && Number(price) < 0) {
      return res.status(400).json({ error: "El precio no puede ser negativo" })
    }

    if (highPrice && Number(highPrice) < Number(price)) {
      return res.status(400).json({ error: "El precio maximo debe ser mayor al precio base" })
    }

    try {
      const model = new MenuModel(req.token)
      const item = await model.updateItem(req.params.id, {
        price: price === "" || price === undefined ? null : Number(price),
        high_price: highPrice ? Number(highPrice) : null,
        note: note ? note.trim() : null,
        is_featured: Boolean(isFeatured),
        position: position ? Number(position) : 0,
        updated_at: new Date().toISOString()
      })

      res.json(item)
    } catch (error) {
      failed(res, error)
    }
  }

  async removeItem(req, res) {
    try {
      const model = new MenuModel(req.token)
      await model.removeItem(req.params.id)
      res.json({ removed: true })
    } catch (error) {
      failed(res, error)
    }
  }
}

export default new MenuController()
