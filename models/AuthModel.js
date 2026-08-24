import { publicClient } from "../config/supabase.js"

class AuthModel {
  constructor() {
    this.db = publicClient()
  }

  async register(email, password, fullName) {
    const { data, error } = await this.db.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    })

    if (error) throw error
    return data
  }

  async verify(email, token) {
    const { data, error } = await this.db.auth.verifyOtp({
      email,
      token,
      type: "signup"
    })

    if (error) throw error
    return data
  }

  async resend(email) {
    const { error } = await this.db.auth.resend({ type: "signup", email })
    if (error) throw error
    return true
  }

  async login(email, password) {
    const { data, error } = await this.db.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }
}

export default AuthModel
