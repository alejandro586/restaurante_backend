import "dotenv/config"
import { writeFileSync, mkdirSync } from "node:fs"

const ref = process.env.SUPABASE_PROJECT_REF
const token = process.env.SUPABASE_ACCESS_TOKEN

const sql = async (query) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query })
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

const platos = await sql(
  "select d.name, c.name as categoria from dishes d " +
    "join dish_categories c on c.id = d.category_id where d.is_active order by c.name, d.name"
)

const porCategoria = {}
platos.forEach((p) => {
  if (!porCategoria[p.categoria]) porCategoria[p.categoria] = []
  porCategoria[p.categoria].push(p.name)
})

console.log(`${platos.length} platos:`, Object.keys(porCategoria).map((k) => `${k}=${porCategoria[k].length}`).join(" "))

// Generador pseudoaleatorio con semilla, para que los archivos sean reproducibles
let semilla = 20260829
const rnd = () => {
  semilla = (semilla * 1103515245 + 12345) % 2147483648
  return semilla / 2147483648
}
const entre = (min, max) => min + rnd() * (max - min)
const entero = (min, max) => Math.round(entre(min, max))
const elegir = (lista) => lista[Math.floor(rnd() * lista.length)]

// Rango de precio y volumen tipico por categoria
const perfil = {
  Entrada: { precio: [14, 32], unidades: [40, 190] },
  Fondo: { precio: [24, 62], unidades: [60, 320] },
  Postre: { precio: [10, 24], unidades: [25, 130] },
  Bebida: { precio: [6, 22], unidades: [90, 420] }
}

const MESES = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]

// Toma n platos de cada categoria respetando una proporcion
const muestra = (cantidades) => {
  const salida = []
  Object.keys(cantidades).forEach((categoria) => {
    const disponibles = [...(porCategoria[categoria] || [])]
    for (let i = 0; i < cantidades[categoria] && disponibles.length; i += 1) {
      const idx = Math.floor(rnd() * disponibles.length)
      salida.push({ nombre: disponibles.splice(idx, 1)[0], categoria })
    }
  })
  return salida
}

const csv = (cabeceras, filas) => {
  const escapar = (v) => {
    const s = String(v ?? "")
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cabeceras.join(","), ...filas.map((f) => cabeceras.map((h) => escapar(f[h])).join(","))].join("\r\n")
}

const dec = (n, d = 2) => Number(n.toFixed(d))

const archivos = {}

// =====================================================================
// 1. RIMBERIO (nuestra empresa) - estructura basica, solo salon
// =====================================================================
{
  const seleccion = muestra({ Entrada: 12, Fondo: 26, Postre: 6, Bebida: 8 })
  const filas = []

  seleccion.forEach((p) => {
    const base = perfil[p.categoria]
    const precio = dec(entre(base.precio[0], base.precio[1]))

    MESES.forEach((mes) => {
      const unidades = entero(base.unidades[0] * 0.7, base.unidades[1] * 0.7)
      filas.push({
        plato: p.nombre,
        categoria: p.categoria,
        precio_unitario: precio,
        unidades_vendidas: unidades,
        ingreso_total: dec(precio * unidades),
        mes
      })
    })
  })

  archivos["rimberio_ventas_2026.csv"] = csv(
    ["plato", "categoria", "precio_unitario", "unidades_vendidas", "ingreso_total", "mes"],
    filas
  )
}

// =====================================================================
// 2. SABOR NORTENO - tiene delivery y promociones
// =====================================================================
{
  const seleccion = muestra({ Entrada: 10, Fondo: 24, Postre: 7, Bebida: 9 })
  const filas = []

  seleccion.forEach((p) => {
    const base = perfil[p.categoria]
    const precioCarta = dec(entre(base.precio[0], base.precio[1]) * 1.08)
    const enPromo = rnd() < 0.28

    MESES.forEach((mes) => {
      ;["Salon", "Delivery", "Para llevar"].forEach((canal) => {
        const factor = canal === "Salon" ? 1 : canal === "Delivery" ? 0.85 : 0.4
        const unidades = entero(base.unidades[0] * factor, base.unidades[1] * factor)
        if (unidades <= 0) return
        const precio = canal === "Delivery" ? dec(precioCarta * 1.12) : precioCarta
        filas.push({
          producto: p.nombre,
          tipo: p.categoria,
          precio_carta: precioCarta,
          precio_final: precio,
          unidades: unidades,
          ingreso_total: dec(precio * unidades),
          canal,
          en_promocion: enPromo ? "SI" : "NO",
          mes
        })
      })
    })
  })

  archivos["sabor_norteno_ventas_2026.csv"] = csv(
    ["producto", "tipo", "precio_carta", "precio_final", "unidades", "ingreso_total", "canal", "en_promocion", "mes"],
    filas
  )
}

// =====================================================================
// 3. LA BUENA MESA - combos, fidelizacion y resenas
// =====================================================================
{
  const seleccion = muestra({ Entrada: 9, Fondo: 22, Postre: 8, Bebida: 7 })
  const filas = []

  seleccion.forEach((p) => {
    const base = perfil[p.categoria]
    const precio = dec(entre(base.precio[0], base.precio[1]) * 1.15)
    const esCombo = rnd() < 0.35
    const resena = dec(entre(3.6, 4.9), 1)

    MESES.forEach((mes) => {
      const unidades = entero(base.unidades[0] * 1.15, base.unidades[1] * 1.15)
      const socios = entero(unidades * 0.25, unidades * 0.55)
      filas.push({
        item: p.nombre,
        familia: p.categoria,
        precio_unitario: precio,
        cantidad: unidades,
        venta_total: dec(precio * unidades),
        es_combo: esCombo ? "Si" : "No",
        ventas_socios_club: socios,
        resena_promedio: resena,
        mes
      })
    })
  })

  archivos["la_buena_mesa_ventas_2026.csv"] = csv(
    ["item", "familia", "precio_unitario", "cantidad", "venta_total", "es_combo", "ventas_socios_club", "resena_promedio", "mes"],
    filas
  )
}

// =====================================================================
// 4. COSTA MARINA - ticket alto, controla costos y mide satisfaccion
// =====================================================================
{
  const seleccion = muestra({ Entrada: 8, Fondo: 18, Postre: 5, Bebida: 6 })
  const filas = []

  seleccion.forEach((p) => {
    const base = perfil[p.categoria]
    const precio = dec(entre(base.precio[0], base.precio[1]) * 1.42)

    // Food cost tipico del rubro: entre el 28 y el 38 por ciento del precio
    const costo = dec(precio * entre(0.28, 0.38))
    const calificacion = dec(entre(3.9, 5.0), 1)

    MESES.forEach((mes) => {
      const unidades = entero(base.unidades[0] * 0.55, base.unidades[1] * 0.55)
      filas.push({
        nombre_plato: p.nombre,
        seccion: p.categoria,
        precio: precio,
        costo_unitario: costo,
        margen_bruto: dec((precio - costo) * unidades),
        vendidos: unidades,
        total: dec(precio * unidades),
        calificacion_google: calificacion,
        mes
      })
    })
  })

  archivos["costa_marina_ventas_2026.csv"] = csv(
    [
      "nombre_plato",
      "seccion",
      "precio",
      "costo_unitario",
      "margen_bruto",
      "vendidos",
      "total",
      "calificacion_google",
      "mes"
    ],
    filas
  )
}

const carpeta = new URL("../../datos-ejemplo/", import.meta.url)
mkdirSync(carpeta, { recursive: true })

Object.keys(archivos).forEach((nombre) => {
  writeFileSync(new URL(nombre, carpeta), archivos[nombre], "utf8")
  const lineas = archivos[nombre].split("\r\n")
  console.log(`${nombre.padEnd(34)} ${String(lineas.length - 1).padStart(5)} filas  ${lineas[0].split(",").length} columnas`)
})
