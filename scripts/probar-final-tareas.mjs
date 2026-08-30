import "dotenv/config"
import { readFileSync } from "node:fs"
const URL=process.env.SUPABASE_URL, ANON=process.env.SUPABASE_ANON_KEY, API="http://localhost:4000/api"
const login=async(e,p)=>(await(await fetch(`${API}/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:e,password:p})})).json())
const rest=async(j,r,o={})=>{const x=await fetch(`${URL}/rest/v1/${r}`,{...o,headers:{apikey:ANON,Authorization:`Bearer ${j}`,"Content-Type":"application/json",...(o.headers||{})}});const t=await x.text();const b=t?JSON.parse(t):null;if(!x.ok)throw new Error(b?.message||`HTTP ${x.status}`);return b}
const rpc=(j,f,a={})=>rest(j,`rpc/${f}`,{method:"POST",body:JSON.stringify(a)})
const call=async(j,m,r,c)=>{const x=await fetch(`${API}${r}`,{method:m,headers:{Authorization:`Bearer ${j}`,"Content-Type":"application/json"},...(c?{body:JSON.stringify(c)}:{})});return{s:x.status,b:await x.json().catch(()=>null)}}
const ok=(t,c,x="")=>console.log(`  ${c?"OK  ":"FALLA"} ${t.padEnd(50)} ${x}`)

const A=await login("admin@rimberio.com","Admin2026!"), T=await login("trabajador@rimberio.com","Trabajo2026!")
const imp=async(a,e,p)=>{const f=new FormData();f.append("file",new Blob([readFileSync(`../datos-ejemplo/${a}`)]),a);f.append("empresa",e);f.append("esPropia",String(p));const r=await fetch(`${API}/imports`,{method:"POST",headers:{Authorization:`Bearer ${T.token}`},body:f});const b=await r.json();if(p)await rpc(T.token,"empresa_materializar",{p_import_id:b.importacion.id,p_estructura:b.estructura});return b.importacion.id}

const propio=await imp("rimberio_ventas_2026.csv","Rimberio",true)
const ids={
  "Sabor Norteno": await imp("sabor_norteno_ventas_2026.csv","Sabor Norteno",false),
  "La Buena Mesa": await imp("la_buena_mesa_ventas_2026.csv","La Buena Mesa",false),
  "Costa Marina":  await imp("costa_marina_ventas_2026.csv","Costa Marina",false)
}
console.log("4 archivos importados (Costa Marina ahora con 9 columnas)\n")

console.log("CADA COMPARACION PRODUCE SOLO INSIGHTS ASIGNABLES")
const columnas = new Set()
for (const [empresa,id] of Object.entries(ids)) {
  const c=await call(A.token,"POST","/comparar",{ids:[propio,id]})
  const ins=c.b.insights
  ok(`Rimberio vs ${empresa}`, ins.length>0 && ins.every(i=>i.accion), `${ins.length} insights, ${ins.filter(i=>i.accion).length} con columna`)
  ins.forEach(i=>columnas.add(`${i.accion.columna} (${i.accion.tipoDato})`))
}
console.log(`\n  columnas distintas que se pueden pedir: ${columnas.size}`)
console.log(`  ${[...columnas].join("\n  ")}`)

console.log("\nASIGNAR Y EJECUTAR")
const c=await call(A.token,"POST","/comparar",{ids:[propio,ids["Costa Marina"]]})
const ins=c.b.insights[0]
const t=await call(A.token,"POST","/tareas",{titulo:ins.titulo,mensaje:ins.mensaje,nivel:ins.nivel,accion:ins.accion,origen:"Costa Marina",asignadaA:T.perfil.id})
ok("admin asigna", t.s===200, `pide ${t.b.columna_sugerida} (${t.b.tipo_sugerido})`)
const r=await rpc(T.token,"empresa_agregar_columna",{p_tabla:"empresa_datos",p_columna:t.b.columna_sugerida,p_tipo:t.b.tipo_sugerido,p_motivo:"Tarea del admin"})
ok("trabajador la crea a mano", true, `${r.columna} (${r.tipo})`)
ok("la tarea se cerro sola", r.tareasCerradas===1)

console.log("\nMODO ARCHIVO SUELTO (sin comparacion)")
const uno=await call(A.token,"POST","/comparar",{ids:[propio]})
ok("sigue mostrando el resumen informativo", uno.b.insights.length>0, `${uno.b.insights.length} insights`)
ok("ninguno es asignable, no se muestra el boton", uno.b.insights.every(i=>!i.accion))
