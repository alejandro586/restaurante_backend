import DishModel from "../models/DishModel.js"
import Importer from "../utils/Importer.js"
import { normalizeName } from "../utils/normalize.js"
import { sendError } from "../utils/apiError.js"

const failed = (res, error) => {
  if (error.code === "23505") {
    return res.status(409).json({ error: "Ese plato ya existe en el catalogo" })
  }
  if (error.code === "23503") {
    return res.status(409).json({ error: "La categoria seleccionada no existe" })
  }
  sendError(res, error)
}

class DishController {
  async index(req, res) {
    try {
      const model = new DishModel(req.token)
      const dishes = await model.findAll(req.query)
      res.json(dishes)
    } catch (error) {
      failed(res, error)
    }
  }

  async categories(req, res) {
    try {
      const model = new DishModel(req.token)
      const categories = await model.categories()
      res.json(categories)
    } catch (error) {
      failed(res, error)
    }
  }

  async create(req, res) {
    const { name, description, categoryId } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "El nombre es obligatorio" })
    }

    try {
      const model = new DishModel(req.token)
      const dish = await model.create({
        name: name.trim(),
        name_normalized: normalizeName(name),
        description: description ? description.trim() : null,
        category_id: categoryId || null
      })

      res.status(201).json(dish)
    } catch (error) {
      failed(res, error)
    }
  }

  async update(req, res) {
    const { name, description, categoryId, isActive } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "El nombre es obligatorio" })
    }

    try {
      const model = new DishModel(req.token)
      const dish = await model.update(req.params.id, {
        name: name.trim(),
        name_normalized: normalizeName(name),
        description: description ? description.trim() : null,
        category_id: categoryId || null,
        is_active: isActive !== false,
        updated_at: new Date().toISOString()
      })

      res.json(dish)
    } catch (error) {
      failed(res, error)
    }
  }

  async destroy(req, res) {
    try {
      const model = new DishModel(req.token)
      await model.deactivate(req.params.id)
      res.json({ deactivated: true })
    } catch (error) {
      failed(res, error)
    }
  }

  async import(req, res) {
    if (!req.file) {
      return res.status(400).json({ error: "No se recibio ningun archivo" })
    }

    try {
      const model = new DishModel(req.token)
      const categories = await model.categories()
      const rows = Importer.read(req.file.buffer)

      if (rows.length === 0) {
        return res.status(400).json({ error: "El archivo no contiene filas" })
      }

      const { valid, errors } = Importer.build(rows, categories)

      if (valid.length === 0) {
        return res.status(400).json({ error: "Ninguna fila es valida", errors })
      }

      const saved = await model.bulkUpsert(valid)

      res.json({ total: rows.length, imported: saved.length, errors })
    } catch (error) {
      failed(res, error)
    }
  }
}

export default new DishController()
