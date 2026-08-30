import { createClient } from "@supabase/supabase-js"

const url = process.env.SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_KEY

const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
}

export const publicClient = () => createClient(url, anonKey, options)

export const userClient = (token) =>
  createClient(url, anonKey, {
    ...options,
    global: { headers: { Authorization: `Bearer ${token}` } }
  })

// Ignora RLS. Se usa solo cuando el controlador ya verifico que quien pide
// es administrador, o para leer el perfil que resuelve el rol.
export const adminClient = () => createClient(url, serviceKey, options)
