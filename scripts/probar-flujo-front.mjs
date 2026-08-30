import "dotenv/config"
import { readFileSync } from "node:fs"

const URL = process.env.SUPABASE_URL
const ANON = process.env.SUPABASE_ANON_KEY
const API = "http://localhost:4000/api"

const login = async (e, p) =>
  (await (await fetch(`${API}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: e, password: p })
  })).json()).token

// Lo que hace el navegador: PostgREST con anon key publica + JWT del usuario
const rpc = async (jwt, fn, args = {}) => {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json", Origin: "http://localhost:5000" },
    body: JSON.stringify(args)
  })
  const b = await r.json()
  if (!r.ok) throw new Error(b.message || `HTTP ${r.status}`)
  return b
}

const tT = await login("trabajador@rimberio.com", "Trabajo2026!")
const tA = await login("admin@rimberio.com", "Admin2026!")

const importar = async (archivo, empresa, propia) => {
  const form = new FormData()
  form.append("file", new Blob([readFileSync(`../datos-ejemplo/${archivo}`)]), archivo)
  form.append("empresa", empresa)
  form.append("esPropia", String(propia))

  const r = await fetch(`${API}/imports`, { method: "POST", headers: { Authorization: `Bearer ${tT}` }, body: form })
  const b = await r.json()
  if (!r.ok) { console.log(`  FALLA ${archivo}: ${b.error}`); return null }

  // El navegador materializa por su cuenta, el backend ya no toca la base
  let mat = ""
  if (propia) {
    const m = await rpc(tT, "empresa_materializar", { p_import_id: b.importacion.id, p_estructura: b.estructura })
    mat = `-> RPC creo ${m.tabla} (${m.filas} filas, ${m.columnas} cols)`
  }

  console.log(`  OK   ${archivo.padEnd(34)} ${String(b.resumen.filas).padStart(4)} filas  ${mat}`)
  return b.importacion.id
}

console.log("IMPORTACION (backend guarda, navegador materializa)")
const propio = await importar("rimberio_ventas_2026.csv", "Rimberio", true)
await importar("sabor_norteno_ventas_2026.csv", "Sabor Norteno", false)
await importar("la_buena_mesa_ventas_2026.csv", "La Buena Mesa", false)
await importar("costa_marina_ventas_2026.csv", "Costa Marina", false)

console.log("\nMODULO DEL TRABAJADOR (100% desde el navegador, sin Express)")
const leer = await rpc(tT, "empresa_leer", { p_tabla: "empresa_datos", p_limite: 2 })
console.log(`  OK   leer tabla                 ${leer.total} filas, ${leer.columnas.length} columnas`)
const add = await rpc(tT, "empresa_agregar_columna", { p_tabla: "empresa_datos", p_columna: "canal_venta", p_tipo: "texto", p_defecto: "Salon", p_motivo: "Sabor Norteno saca el 40% del delivery" })
console.log(`  OK   ALTER TABLE ADD COLUMN     ${add.columna} (${add.tipo})`)
const tab = await rpc(tT, "empresa_crear_tabla", { p_nombre: "programa_fidelidad", p_columnas: [{ nombre: "socio", tipo: "texto" }, { nombre: "puntos", tipo: "entero" }], p_motivo: "La Buena Mesa tiene club de socios" })
console.log(`  OK   CREATE TABLE               ${tab.tabla} (${tab.columnas} columnas)`)
const cel = await rpc(tT, "empresa_actualizar_celda", { p_tabla: "empresa_datos", p_id: 1, p_columna: "canal_venta", p_valor: "Delivery" })
console.log(`  OK   UPDATE celda               ${cel.columna}`)
const final = await rpc(tT, "empresa_leer", { p_tabla: "empresa_datos", p_limite: 1 })
console.log(`  OK   estado final               ${final.columnas.map(c => c.columna).join(", ")}`)
console.log(`       fila 1 canal_venta =       ${final.filas[0].canal_venta}`)

console.log("\nRESTO DEL SISTEMA (sigue por el backend, sin cambios)")
const sug = await (await fetch(`${API}/empresa/sugerencias`, { headers: { Authorization: `Bearer ${tT}` } })).json()
console.log(`  OK   sugerencias (analisis)     ${sug.sugerencias.map(s => s.columna).join(", ")}`)
const lst = await (await fetch(`${API}/imports`, { headers: { Authorization: `Bearer ${tA}` } })).json()
console.log(`  OK   admin ve las cards         ${lst.length} archivos`)
const cmp = await (await fetch(`${API}/comparar`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tA}` }, body: JSON.stringify({ ids: [propio, lst.find(i => i.empresa === "Sabor Norteno").id] }) })).json()
console.log(`  OK   comparacion + insights     ${cmp.insights.length} insights, ${cmp.series.periodos.length} periodos`)
