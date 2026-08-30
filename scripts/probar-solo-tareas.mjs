import "dotenv/config"
import { readFileSync } from "node:fs"
const URL = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY, API = "http://localhost:4000/api"

const login = async (e,p) => (await (await fetch(`${API}/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:e,password:p})})).json())
const rest = async (jwt,ruta,o={}) => { const r = await fetch(`${URL}/rest/v1/${ruta}`,{...o,headers:{apikey:ANON,Authorization:`Bearer ${jwt}`,"Content-Type":"application/json",...(o.headers||{})}}); const t=await r.text(); const b=t?JSON.parse(t):null; if(!r.ok) throw new Error(b?.message||`HTTP ${r.status}`); return b }
const rpc = (jwt,fn,a={}) => rest(jwt,`rpc/${fn}`,{method:"POST",body:JSON.stringify(a)})
const call = async (jwt,m,ruta,c) => { const r = await fetch(`${API}${ruta}`,{method:m,headers:{Authorization:`Bearer ${jwt}`,"Content-Type":"application/json"},...(c?{body:JSON.stringify(c)}:{})}); return {s:r.status,b:await r.json().catch(()=>null)} }
const ok = (t,c,x="") => console.log(`  ${c?"OK  ":"FALLA"} ${t.padEnd(48)} ${x}`)

const admin = await login("admin@rimberio.com","Admin2026!")
const trab  = await login("trabajador@rimberio.com","Trabajo2026!")
const tA = admin.token, tT = trab.token

console.log("EL ENDPOINT DE SUGERENCIAS YA NO EXISTE")
const viejo = await call(tT,"GET","/empresa/sugerencias")
ok("GET /api/empresa/sugerencias -> 404", viejo.s === 404, `HTTP ${viejo.s}: ${viejo.b?.error}`)

console.log("\nESTADO INICIAL DEL TRABAJADOR")
let tareas = await rest(tT,"tareas?select=*")
ok("sin tareas asignadas, no ve nada que hacer", tareas.length === 0, `${tareas.length} tareas`)

console.log("\nPREPARACION")
const importar = async (a,e,p) => { const f=new FormData(); f.append("file",new Blob([readFileSync(`../datos-ejemplo/${a}`)]),a); f.append("empresa",e); f.append("esPropia",String(p)); const r=await fetch(`${API}/imports`,{method:"POST",headers:{Authorization:`Bearer ${tT}`},body:f}); const b=await r.json(); if(p) await rpc(tT,"empresa_materializar",{p_import_id:b.importacion.id,p_estructura:b.estructura}); return b.importacion.id }
const propio = await importar("rimberio_ventas_2026.csv","Rimberio",true)
const otro   = await importar("sabor_norteno_ventas_2026.csv","Sabor Norteno",false)
ok("archivos importados", true)

tareas = await rest(tT,"tareas?select=*")
ok("con CSV cargados SIGUE sin tareas", tareas.length === 0, "nada aparece por si solo")

console.log("\nEL ADMIN ASIGNA")
const comp = await call(tA,"POST","/comparar",{ids:[propio,otro]})
const conAccion = comp.b.insights.find(i=>i.accion)
const idT = trab.perfil.id
const t1 = await call(tA,"POST","/tareas",{titulo:conAccion.titulo,mensaje:conAccion.mensaje,nivel:conAccion.nivel,accion:conAccion.accion,origen:"Sabor Norteno",asignadaA:idT})
ok("admin asigna un insight", t1.s === 200, `pide la columna ${t1.b.columna_sugerida}`)

console.log("\nEL TRABAJADOR AHORA SI VE TRABAJO")
tareas = await rest(tT,"tareas?select=*")
ok("aparece la tarea", tareas.length === 1, `${tareas[0].titulo.slice(0,42)}...`)
ok("solo lo que el admin asigno", tareas.every(t=>t.asignada_a===idT))

console.log("\nAISLAMIENTO ENTRE TRABAJADORES")
const otrosTrab = (await call(tA,"GET","/tareas/trabajadores")).b.filter(t=>t.id!==idT)
const t2 = await call(tA,"POST","/tareas",{titulo:"Tarea de otro",mensaje:"No deberia verla Tito",asignadaA:otrosTrab[0].id})
ok("admin asigna a otro trabajador", t2.s === 200, otrosTrab[0].email)
tareas = await rest(tT,"tareas?select=*")
ok("Tito NO ve la tarea del otro", tareas.length === 1, `sigue viendo ${tareas.length}`)
const todas = (await call(tA,"GET","/tareas")).b
ok("el admin si ve las dos", todas.length === 2)
