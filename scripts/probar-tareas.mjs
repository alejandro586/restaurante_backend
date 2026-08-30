import "dotenv/config"
import { readFileSync } from "node:fs"

const URL = process.env.SUPABASE_URL
const ANON = process.env.SUPABASE_ANON_KEY
const API = "http://localhost:4000/api"

const login = async (e, p) =>
  (await (await fetch(`${API}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: e, password: p })
  })).json())

const rest = async (jwt, ruta, opciones = {}) => {
  const r = await fetch(`${URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json", ...(opciones.headers || {}) }
  })
  const t = await r.text()
  const b = t ? JSON.parse(t) : null
  if (!r.ok) throw new Error(b?.message || `HTTP ${r.status}`)
  return b
}
const rpc = (jwt, fn, args = {}) => rest(jwt, `rpc/${fn}`, { method: "POST", body: JSON.stringify(args) })

const apiCall = async (jwt, metodo, ruta, cuerpo) => {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {})
  })
  return { s: r.status, b: await r.json() }
}

const ok = (t, c, x = "") => console.log(`  ${c ? "OK  " : "FALLA"} ${t.padEnd(46)} ${x}`)

const admin = await login("admin@rimberio.com", "Admin2026!")
const trab = await login("trabajador@rimberio.com", "Trabajo2026!")
const tA = admin.token, tT = trab.token
const idTrabajador = trab.perfil.id

// --- preparar datos ---
console.log("PREPARACION")
const importar = async (archivo, empresa, propia) => {
  const form = new FormData()
  form.append("file", new Blob([readFileSync(`../datos-ejemplo/${archivo}`)]), archivo)
  form.append("empresa", empresa); form.append("esPropia", String(propia))
  const r = await fetch(`${API}/imports`, { method: "POST", headers: { Authorization: `Bearer ${tT}` }, body: form })
  const b = await r.json()
  if (propia) await rpc(tT, "empresa_materializar", { p_import_id: b.importacion.id, p_estructura: b.estructura })
  return b.importacion.id
}
const propio = await importar("rimberio_ventas_2026.csv", "Rimberio", true)
const otro = await importar("sabor_norteno_ventas_2026.csv", "Sabor Norteno", false)
ok("archivos importados", true, "Rimberio + Sabor Norteno")

// --- admin compara y asigna ---
console.log("\nADMIN ASIGNA")
const trabajadores = await apiCall(tA, "GET", "/tareas/trabajadores")
ok("lista de trabajadores", trabajadores.s === 200, `${trabajadores.b.length} disponibles`)

const comp = await apiCall(tA, "POST", "/comparar", { ids: [propio, otro] })
const insights = comp.b.insights
ok("insights de la comparacion", insights.length > 0, `${insights.length} (${insights.filter(i => i.accion).length} con columna)`)

const conAccion = insights.find((i) => i.accion)
const sinAccion = insights.find((i) => !i.accion)

const t1 = await apiCall(tA, "POST", "/tareas", {
  titulo: conAccion.titulo, mensaje: conAccion.mensaje, nivel: conAccion.nivel,
  accion: conAccion.accion, origen: "Sabor Norteno", asignadaA: idTrabajador
})
ok("asignar insight CON columna", t1.s === 200, `columna pedida: ${t1.b.columna_sugerida}`)

const t2 = await apiCall(tA, "POST", "/tareas", {
  titulo: sinAccion.titulo, mensaje: sinAccion.mensaje, nivel: sinAccion.nivel,
  accion: null, origen: "Sabor Norteno", asignadaA: idTrabajador
})
ok("asignar insight SIN columna", t2.s === 200, "tarea de lectura")

const malo = await apiCall(tA, "POST", "/tareas", {
  titulo: "x", mensaje: "y", asignadaA: "00000000-0000-0000-0000-000000000000"
})
ok("destinatario inexistente rechazado", malo.s === 400, malo.b.error)

// --- trabajador ve sus tareas ---
console.log("\nTRABAJADOR VE SUS TAREAS (directo contra la base)")
let tareas = await rest(tT, "tareas?select=*&order=created_at.desc")
ok("ve sus tareas", tareas.length === 2, `${tareas.filter(t => t.estado === "pendiente").length} pendientes`)

const otroTrab = trabajadores.b.find((t) => t.id !== idTrabajador)
ok("hay otro trabajador para probar aislamiento", Boolean(otroTrab), otroTrab?.email)

// --- cierre automatico ---
console.log("\nCIERRE AUTOMATICO")
const pedida = tareas.find((t) => t.columna_sugerida)
const res = await rpc(tT, "empresa_agregar_columna", {
  p_tabla: "empresa_datos", p_columna: pedida.columna_sugerida,
  p_tipo: pedida.tipo_sugerido, p_motivo: "Tarea asignada por el admin"
})
ok("crea la columna a mano", true, `${res.columna} (${res.tipo})`)
ok("la tarea se cerro sola", res.tareasCerradas === 1, `tareasCerradas=${res.tareasCerradas}`)

tareas = await rest(tT, "tareas?select=*")
const cerrada = tareas.find((t) => t.id === pedida.id)
ok("estado en la base", cerrada.estado === "completada" && cerrada.cierre === "automatico", `${cerrada.estado} / ${cerrada.cierre}`)

// --- cierre manual ---
console.log("\nCIERRE MANUAL")
const lectura = tareas.find((t) => !t.columna_sugerida)
await rest(tT, `tareas?id=eq.${lectura.id}`, {
  method: "PATCH",
  body: JSON.stringify({ estado: "completada", completada_at: new Date().toISOString(), cierre: "manual" })
})
tareas = await rest(tT, "tareas?select=*")
ok("tarea de lectura marcada a mano", tareas.find(t => t.id === lectura.id).estado === "completada", "cierre=manual")
ok("no quedan pendientes", tareas.filter(t => t.estado === "pendiente").length === 0)

// --- seguridad ---
console.log("\nSEGURIDAD")
const w = await apiCall(tT, "POST", "/tareas", { titulo: "x", mensaje: "y", asignadaA: idTrabajador })
ok("trabajador NO puede asignar", w.s === 403, `HTTP ${w.s}`)
try {
  await rest(tT, `tareas?id=eq.${lectura.id}`, { method: "PATCH", body: JSON.stringify({ asignada_a: otroTrab.id }) })
  ok("trabajador NO puede reasignar", false, "PASO -- PROBLEMA")
} catch (e) { ok("trabajador NO puede reasignar", true, e.message.slice(0, 44)) }
const vistaAdmin = await apiCall(tA, "GET", "/tareas")
ok("admin ve el avance", vistaAdmin.s === 200, `${vistaAdmin.b.length} tareas, destinatario: ${vistaAdmin.b[0]?.destinatario}`)
