import { createClient } from "@supabase/supabase-js"

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_ANON_KEY

const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
}

export const publicClient = () => createClient(url, key, options)

export const userClient = (token) =>
  createClient(url, key, {
    ...options,
    global: { headers: { Authorization: `Bearer ${token}` } }
  })
