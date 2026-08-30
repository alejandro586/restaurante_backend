import { readFileSync } from "node:fs"
import Importer from "../utils/Importer.js"
import Comparador from "../utils/Comparador.js"
import Insight from "../utils/Insight.js"

const cargar = (archivo, empresa, esPropia) => {
  const { filas } = Importer.leer(readFileSync(`../datos-ejemplo/${archivo}`), archivo)
  const estructura = Importer.analizar(filas)
  const limpias = Importer.sinVacias(Importer.limpiar(filas, estructura))
  return Comparador.analizar(
    { id: archivo, empresa, archivo, es_propia: esPropia, columnas: estructura.map((e) => e.original) },
    limpias
  )
}

const nuestra = cargar("rimberio_ventas_2026.csv", "Rimberio", true)
console.log(`Rimberio (propia) capacidades: ${nuestra.capacidades.map(c=>c.clave).join(", ") || "(ninguna)"}\n`)

const rivales = [
  ["sabor_norteno_ventas_2026.csv", "Sabor Norteno"],
  ["la_buena_mesa_ventas_2026.csv", "La Buena Mesa"],
  ["costa_marina_ventas_2026.csv", "Costa Marina"]
]

let todoOk = true

for (const [archivo, empresa] of rivales) {
  const otra = cargar(archivo, empresa, false)
  const insights = Insight.comparar(nuestra, otra)
  const conAccion = insights.filter((i) => i.accion)
  const sinAccion = insights.filter((i) => !i.accion)

  const bien = insights.length > 0 && sinAccion.length === 0
  if (!bien) todoOk = false

  console.log("=".repeat(74))
  console.log(`Rimberio  vs  ${empresa}`)
  console.log(`  capacidades del rival: ${otra.capacidades.map(c=>c.clave).join(", ") || "(ninguna)"}`)
  console.log(`  ${bien ? "OK  " : "FALLA"} ${insights.length} insights, todos asignables (${sinAccion.length} sin accion)`)
  insights.forEach((i, n) => {
    console.log(`\n  ${n + 1}. [${i.nivel}] ${i.titulo}`)
    console.log(`     -> columna "${i.accion.columna}" (${i.accion.tipoDato}) — ${i.accion.ejemplo}`)
  })
  console.log("")
}

console.log("=".repeat(74))
console.log(todoOk ? "TODAS las comparaciones generan tareas asignables" : "HAY COMPARACIONES SIN NADA QUE ASIGNAR")
