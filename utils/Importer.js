import * as XLSX from "xlsx"
import { aIdentificador, deducirTipo } from "./Estructura.js"

const LIMITE_FILAS = 20000

class Importer {
  /**
   * Lee el archivo sin asumir ninguna estructura. Un XLSX empieza con la
   * firma PK de un zip; cualquier otra cosa se trata como texto delimitado.
   */
  leer(buffer, nombreArchivo = "") {
    const esZip = buffer[0] === 0x50 && buffer[1] === 0x4b

    // En CSV se lee en crudo: si no, la libreria adivina que "2026-01" es
    // una fecha y la reescribe como "12/31/25", corrompiendo la columna.
    // En Excel si conviene el formateo, porque las fechas reales estan
    // guardadas como numero de serie y sin formato saldrian ilegibles.
    const libro = esZip
      ? XLSX.read(buffer, { type: "buffer", raw: false, cellDates: true })
      : XLSX.read(this.texto(buffer), { type: "string", raw: true })

    const hoja = libro.Sheets[libro.SheetNames[0]]

    if (!hoja) {
      throw Object.assign(new Error("El archivo no tiene ninguna hoja con datos"), { status: 400 })
    }

    const filas = XLSX.utils.sheet_to_json(hoja, { defval: "", raw: !esZip })

    if (filas.length === 0) {
      throw Object.assign(new Error("El archivo no tiene filas de datos"), { status: 400 })
    }

    if (filas.length > LIMITE_FILAS) {
      throw Object.assign(
        new Error(`El archivo supera las ${LIMITE_FILAS.toLocaleString("es-PE")} filas permitidas`),
        { status: 400 }
      )
    }

    return {
      filas,
      formato: esZip || /\.xlsx?$/i.test(nombreArchivo) ? "excel" : "csv"
    }
  }

  /** Quita el BOM que Excel agrega al exportar CSV en UTF-8. */
  texto(buffer) {
    return buffer.toString("utf8").replace(/^﻿/, "")
  }

  /**
   * Describe la estructura encontrada: cabeceras originales, el nombre
   * que tendrian como columna de Postgres y el tipo deducido.
   */
  analizar(filas) {
    const cabeceras = []

    filas.forEach((fila) => {
      Object.keys(fila).forEach((clave) => {
        const limpia = String(clave).trim()
        if (limpia && !cabeceras.includes(limpia)) cabeceras.push(limpia)
      })
    })

    if (cabeceras.length === 0) {
      throw Object.assign(new Error("No se detectaron columnas en el archivo"), { status: 400 })
    }

    const usados = new Set()

    return cabeceras.map((cabecera) => {
      let columna = aIdentificador(cabecera) || "columna"

      // Dos cabeceras distintas pueden colapsar al mismo identificador
      let intento = columna
      let n = 2
      while (usados.has(intento)) {
        intento = `${columna}_${n}`
        n += 1
      }
      usados.add(intento)

      return {
        original: cabecera,
        columna: intento,
        tipo: deducirTipo(filas.map((fila) => fila[cabecera]))
      }
    })
  }

  /** Deja cada fila con las cabeceras normalizadas y sin claves vacias. */
  limpiar(filas, estructura) {
    return filas.map((fila) => {
      const salida = {}

      estructura.forEach(({ original }) => {
        const valor = fila[original]
        salida[original] = typeof valor === "string" ? valor.trim() : (valor ?? "")
      })

      return salida
    })
  }

  /** Descarta las filas totalmente vacias, que Excel suele dejar al final. */
  sinVacias(filas) {
    return filas.filter((fila) =>
      Object.values(fila).some((valor) => String(valor ?? "").trim() !== "")
    )
  }
}

export default new Importer()
