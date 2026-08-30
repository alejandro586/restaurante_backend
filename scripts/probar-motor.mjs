import { readFileSync } from "node:fs"
import Importer from "../utils/Importer.js"
import Comparador from "../utils/Comparador.js"
import Insight from "../utils/Insight.js"

const cargar = (archivo, empresa, esPropia) => {
  const buffer = readFileSync(`../datos-ejemplo/${archivo}`)
  const { filas } = Importer.leer(buffer, archivo)
  const estructura = Importer.analizar(filas)
  const limpias = Importer.sinVacias(Importer.limpiar(filas, estructura))

  return Comparador.analizar(
    { id: archivo, empresa, archivo, es_propia: esPropia, columnas: estructura.map((e) => e.original) },
    limpias
  )
}

const nuestra = cargar("rimberio_ventas_2026.csv", "Rimberio", true)
const otra = cargar("sabor_norteno_ventas_2026.csv", "Sabor Norteno", false)

console.log("ROLES DETECTADOS")
console.log("  Rimberio      ", JSON.stringify(nuestra.roles))
console.log("  Sabor Norteno ", JSON.stringify(otra.roles))
console.log("\nCAPACIDADES")
console.log("  Rimberio      ", nuestra.capacidades.map((c) => c.clave).join(", ") || "(ninguna)")
console.log("  Sabor Norteno ", otra.capacidades.map((c) => c.clave).join(", ") || "(ninguna)")
console.log("\nMETRICAS         Rimberio        Sabor Norteno")
console.log("  ingresos      ", String(nuestra.ingresos).padEnd(15), otra.ingresos)
console.log("  unidades      ", String(nuestra.unidades).padEnd(15), otra.unidades)
console.log("  ticket        ", String(nuestra.ticketPromedio).padEnd(15), otra.ticketPromedio)
console.log("  productos     ", String(nuestra.productos).padEnd(15), otra.productos)

console.log("\n" + "=".repeat(78))
Insight.comparar(nuestra, otra).forEach((i, n) => {
  console.log(`\n[${i.nivel.toUpperCase()}] ${n + 1}. ${i.titulo}`)
  console.log("   " + i.mensaje.replace(/(.{74})/g, "$1\n   "))
  if (i.accion) console.log(`   >> ACCION: agregar columna "${i.accion.columna}" (${i.accion.tipoDato}) -- ${i.accion.ejemplo}`)
})
