import { userClient } from "../config/supabase.js"

const FIELDS = "id,name,description,is_active,category_id,dish_categories(name)"

class DishModel {
  constructor(token) {
    this.db = userClient(token)
  }

  async findAll({ search = "", categoryId = "", status = "all" } = {}) {
    let query = this.db.from("dishes").select(FIELDS).order("name", { ascending: true })

    if (search) query = query.ilike("name", `*${search}*`)
    if (categoryId) query = query.eq("category_id", categoryId)
    if (status === "active") query = query.eq("is_active", true)
    if (status === "inactive") query = query.eq("is_active", false)

    const { data, error } = await query
    if (error) throw error
    return data
  }

  async create(dish) {
    const { data, error } = await this.db.from("dishes").insert(dish).select(FIELDS).single()
    if (error) throw error
    return data
  }

  async update(id, dish) {
    const { data, error } = await this.db
      .from("dishes")
      .update(dish)
      .eq("id", id)
      .select(FIELDS)
      .single()

    if (error) throw error
    return data
  }

  async deactivate(id) {
    const { error } = await this.db.from("dishes").update({ is_active: false }).eq("id", id)
    if (error) throw error
    return true
  }

  async bulkUpsert(rows) {
    const { data, error } = await this.db
      .from("dishes")
      .upsert(rows, { onConflict: "name_normalized" })
      .select("id")

    if (error) throw error
    return data
  }

  async categories() {
    const { data, error } = await this.db
      .from("dish_categories")
      .select("id,name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })

    if (error) throw error
    return data
  }
}

export default DishModel
