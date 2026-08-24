import { userClient } from "../config/supabase.js"

const ITEM_FIELDS =
  "id,price,high_price,position,is_featured,note,dish_id," +
  "dishes(id,name,description,is_active,category_id,dish_categories(name))," +
  "menu_pages(id,section,menus(id,name,menu_date,status))"

class MenuModel {
  constructor(token) {
    this.db = userClient(token)
  }

  async findItems({ menuId = "" } = {}) {
    let query = this.db.from("menu_items").select(ITEM_FIELDS).order("id", { ascending: false })

    if (menuId) query = query.eq("menu_pages.menu_id", menuId)

    const { data, error } = await query
    if (error) throw error
    return data.filter((item) => item.menu_pages)
  }

  async findMenus() {
    const { data, error } = await this.db
      .from("menus")
      .select("id,name,menu_date,status")
      .order("menu_date", { ascending: false })

    if (error) throw error
    return data
  }

  async findSections(menuId) {
    const { data, error } = await this.db
      .from("menu_pages")
      .select("id,section,page_number")
      .eq("menu_id", menuId)
      .order("page_number", { ascending: true })

    if (error) throw error
    return data
  }

  async assign(item) {
    const { data, error } = await this.db
      .from("menu_items")
      .insert(item)
      .select(ITEM_FIELDS)
      .single()

    if (error) throw error
    return data
  }

  async updateItem(id, item) {
    const { data, error } = await this.db
      .from("menu_items")
      .update(item)
      .eq("id", id)
      .select(ITEM_FIELDS)
      .single()

    if (error) throw error
    return data
  }

  async removeItem(id) {
    const { error } = await this.db.from("menu_items").delete().eq("id", id)
    if (error) throw error
    return true
  }

  async nextPosition(pageId) {
    const { data, error } = await this.db
      .from("menu_items")
      .select("position")
      .eq("menu_page_id", pageId)
      .order("position", { ascending: false })
      .limit(1)

    if (error) throw error
    return data.length ? Number(data[0].position) + 1 : 1
  }
}

export default MenuModel
