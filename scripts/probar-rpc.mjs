import "dotenv/config"

const URL = process.env.SUPABASE_URL
const ANON = process.env.SUPABASE_ANON_KEY
const API = "http://localhost:4000/api"

const login = async (e, p) =>
  (await (await fetch(`${API}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: e, password: p })
  })).json()).token

// Exactamente lo que hara el navegador: PostgREST con anon key + JWT
const rpc = async (jwt, fn, args = {}) => {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
      Origin: "http://localhost:5000"
    },
    body: JSON.stringify(args)
  })
  return { s: r.status, b: await r.json() }
}

const tT = await login("trabajador@rimberio.com", "Trabajo2026!")
const tA = await login("admin@rimberio.com", "Admin2026!")

const ok = (t, c, x = "") => console.log(`  ${c ? "OK  " : "FALLA"} ${t.padEnd(44)} ${x}`)

console.log("LECTURA")
const tablas = await rpc(tT, "empresa_tablas")
ok("empresa_tablas", tablas.s === 200, JSON.stringify(tablas.b))
const leer = await rpc(tT, "empresa_leer", { p_tabla: "empresa_datos", p_limite: 2 })
ok("empresa_leer", leer.s === 200 && leer.b.existe, `${leer.b.total} filas, ${leer.b.columnas?.length} columnas`)

console.log("\nDDL")
const add = await rpc(tT, "empresa_agregar_columna", {
  p_tabla: "empresa_datos", p_columna: "costo_unitario", p_tipo: "moneda",
  p_defecto: "0", p_motivo: "Medir margen como la competencia"
})
ok("agregar columna (ALTER TABLE)", add.s === 200, JSON.stringify(add.b))
const crear = await rpc(tT, "empresa_crear_tabla", {
  p_nombre: "canales_venta",
  p_columnas: [{ nombre: "canal", tipo: "texto" }, { nombre: "pedidos", tipo: "entero" }, { nombre: "activo", tipo: "booleano" }],
  p_motivo: "Registrar delivery como Sabor Norteno"
})
ok("crear tabla (CREATE TABLE)", crear.s === 200, JSON.stringify(crear.b))
const celda = await rpc(tT, "empresa_actualizar_celda", {
  p_tabla: "empresa_datos", p_id: 1, p_columna: "costo_unitario", p_valor: "12.50"
})
ok("actualizar celda", celda.s === 200, JSON.stringify(celda.b))

console.log("\nSEGURIDAD (todo esto sale del navegador, con la anon key publica)")
const casos = [
  ["admin llamando funcion de trabajador", await rpc(tA, "empresa_tablas")],
  ["sin JWT (solo anon key)",              await rpc(ANON, "empresa_tablas")],
  ["DDL sobre profiles",                   await rpc(tT, "empresa_agregar_columna", { p_tabla: "profiles", p_columna: "hack", p_tipo: "texto" })],
  ["DDL sobre auth.users",                 await rpc(tT, "empresa_agregar_columna", { p_tabla: "users", p_columna: "hack", p_tipo: "texto" })],
  ["columna reservada id",                 await rpc(tT, "empresa_agregar_columna", { p_tabla: "empresa_datos", p_columna: "id", p_tipo: "texto" })],
  ["inyeccion en el tipo",                 await rpc(tT, "empresa_agregar_columna", { p_tabla: "empresa_datos", p_columna: "x", p_tipo: "text; drop table profiles" })],
  ["inyeccion en el nombre",               await rpc(tT, "empresa_agregar_columna", { p_tabla: "empresa_datos", p_columna: 'y"; drop table profiles --', p_tipo: "texto" })],
  ["columna duplicada",                    await rpc(tT, "empresa_agregar_columna", { p_tabla: "empresa_datos", p_columna: "costo_unitario", p_tipo: "texto" })]
]
casos.forEach(([n, r]) => ok(n + " -> rechazado", r.s >= 400, `HTTP ${r.s}: ${(r.b.message || "").slice(0, 58)}`))

console.log("\nINTEGRIDAD TRAS LOS ATAQUES")
const check = await rpc(tT, "empresa_leer", { p_tabla: "empresa_datos", p_limite: 1 })
ok("profiles sigue existiendo", (await rpc(tT, "empresa_tablas")).s === 200)
ok("empresa_datos intacta", check.b.total === 312, `${check.b.total} filas, ${check.b.columnas.length} columnas`)
