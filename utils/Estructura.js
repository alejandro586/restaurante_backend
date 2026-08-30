import { normalizeName } from "./normalize.js"

/**
 * Analisis de la estructura de un archivo importado. No ejecuta nada
 * contra la base: solo describe que columnas trae y de que tipo son, para
 * que el frontend pueda pedirle a Postgres que cree la tabla.
 */

/**
 * Convierte una cabecera de CSV en un identificador de Postgres valido:
 * minusculas, sin tildes, sin espacios y sin caracteres especiales.
 */
export const aIdentificador = (valor) => {
  const base = normalizeName(valor)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 58)

  if (!base) return ""

  // Postgres no acepta identificadores que empiecen con digito
  return /^[0-9]/.test(base) ? `c_${base}`.slice(0, 58) : base
}

/**
 * Deduce el tipo de una columna a partir de sus valores. Ante la duda
 * devuelve texto, que nunca falla al insertar.
 */
export const deducirTipo = (valores) => {
  const llenos = valores
    .map((v) => String(v ?? "").trim())
    .filter((v) => v !== "")
    .slice(0, 200)

  if (llenos.length === 0) return "texto"

  const booleanos = ["si", "no", "true", "false", "sí", "1", "0", "x"]
  if (llenos.every((v) => booleanos.includes(v.toLowerCase()))) return "booleano"

  const numero = /^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$/
  if (llenos.every((v) => numero.test(v))) {
    return llenos.every((v) => /^-?\d+$/.test(v)) ? "entero" : "numero"
  }

  if (llenos.every((v) => /^\d{4}-\d{2}(-\d{2})?$/.test(v))) {
    // 2026-01 no es una fecha valida para Postgres, se guarda como texto
    return llenos.every((v) => /^\d{4}-\d{2}-\d{2}$/.test(v)) ? "fecha" : "texto"
  }

  return "texto"
}
