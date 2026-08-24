import { userClient } from "../config/supabase.js"

class ReportModel {
  constructor(token) {
    this.db = userClient(token)
  }

  async dishes() {
    const { data, error } = await this.db
      .from("dishes")
      .select("id,name,description,is_active,category_id")

    if (error) throw error
    return data
  }

  async categories() {
    const { data, error } = await this.db
      .from("dish_categories")
      .select("id,name")
      .order("sort_order", { ascending: true })

    if (error) throw error
    return data
  }

  async items() {
    const { data, error } = await this.db
      .from("menu_items")
      .select(
        "dish_id,price,high_price,is_featured,dishes(name,description,category_id)," +
          "menu_pages(id,section,menu_id,menus(id,name,menu_date,status))"
      )

    if (error) throw error
    return data.filter((item) => item.menu_pages && item.menu_pages.menus)
  }

  async pages() {
    const { data, error } = await this.db
      .from("menu_pages")
      .select("id,section,menu_id,menus(name,status)")

    if (error) throw error
    return data.filter((page) => page.menus)
  }

  async menus() {
    const { data, error } = await this.db.from("menus").select("id,name,menu_date,status")
    if (error) throw error
    return data
  }

  async orders() {
    const { data, error } = await this.db
      .from("orders")
      .select("dish_id,quantity,unit_price,discount,total,order_date,status")
      .order("order_date", { ascending: true })

    if (error) throw error
    return data
  }
}

export default ReportModel
