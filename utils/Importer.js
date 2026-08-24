import * as XLSX from "xlsx"
import { normalizeName } from "./normalize.js"

class Importer {
  read(buffer) {
    const book = XLSX.read(buffer, { type: "buffer", raw: false })
    const sheet = book.Sheets[book.SheetNames[0]]
    return XLSX.utils.sheet_to_json(sheet, { defval: "" })
  }

  build(rows, categories) {
    const map = {}
    categories.forEach((item) => {
      map[normalizeName(item.name)] = item.id
    })

    const valid = []
    const errors = []
    const seen = new Set()

    rows.forEach((row, index) => {
      const line = index + 2
      const name = String(row.name || row.nombre || "").trim()

      if (!name) {
        errors.push({ line, reason: "El nombre esta vacio" })
        return
      }

      const normalized = normalizeName(name)

      if (seen.has(normalized)) {
        errors.push({ line, reason: `El plato "${name}" esta repetido en el archivo` })
        return
      }

      let categoryId = null
      const rawCategory = String(row.category_id || row.category || row.categoria || "").trim()

      if (rawCategory) {
        if (/^\d+$/.test(rawCategory)) {
          categoryId = Number(rawCategory)
        } else {
          categoryId = map[normalizeName(rawCategory)] || null
          if (!categoryId) {
            errors.push({ line, reason: `La categoria "${rawCategory}" no existe` })
            return
          }
        }
      }

      seen.add(normalized)

      valid.push({
        name,
        name_normalized: normalized,
        description: String(row.description || row.descripcion || "").trim() || null,
        category_id: categoryId
      })
    })

    return { valid, errors }
  }
}

export default new Importer()
