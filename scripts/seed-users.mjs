import "dotenv/config"

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY

const cuentas = [
  { email: "admin@rimberio.com", password: "Admin2026!", full_name: "Ana Admin", role: "admin" },
  { email: "trabajador@rimberio.com", password: "Trabajo2026!", full_name: "Tito Trabajador", role: "trabajador" }
]

for (const cuenta of cuentas) {
  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: cuenta.email,
      password: cuenta.password,
      email_confirm: true,
      user_metadata: { full_name: cuenta.full_name }
    })
  })

  const body = await response.json()

  if (!response.ok) {
    console.log(`${cuenta.email}: ${body.msg || body.message || JSON.stringify(body)}`)
    continue
  }

  console.log(`${cuenta.email}: creado (${body.id})`)
}
