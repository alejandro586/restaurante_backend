import "dotenv/config"
import { readFileSync } from "node:fs"

const ref = process.env.SUPABASE_PROJECT_REF
const token = process.env.SUPABASE_ACCESS_TOKEN

if (!ref || !token) {
  console.error("Faltan SUPABASE_PROJECT_REF o SUPABASE_ACCESS_TOKEN en .env")
  process.exit(1)
}

const arg = process.argv[2]

if (!arg) {
  console.error('Uso: node scripts/db.mjs <archivo.sql | "SELECT ...">')
  process.exit(1)
}

const query = arg.trim().toLowerCase().endsWith(".sql") ? readFileSync(arg, "utf8") : arg

const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query })
})

const body = await response.text()

if (!response.ok) {
  console.error(`ERROR ${response.status}`)
  console.error(body)
  process.exit(1)
}

try {
  console.log(JSON.stringify(JSON.parse(body), null, 2))
} catch {
  console.log(body)
}
