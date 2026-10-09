import type { Item, ItemCatalog, ItemIssueCode, RecipeStatus } from "@/lib/api/types"

export const SUPPORT_GROUP = "Phụ trợ"
export const SUPPORT_VARIANTS = ["Đại địa", "Liệt hoả"] as const

export const RECIPE_STATUS_LABEL: Record<RecipeStatus, string> = {
  verified: "Đã xác nhận",
  none: "Không cần ghép",
  unverified: "Chưa xác nhận",
}

export const ISSUE_LABEL: Record<ItemIssueCode, string> = {
  level_difference: "Lệch cấp",
  missing_position: "Thiếu vị trí",
  duplicate_position: "Trùng vị trí",
  shared_support_position: "Chung vị trí nhánh",
}

export interface CatalogProblem {
  itemId: string | null
  kind: "item" | "position" | "recipe" | "cycle"
  message: string
}

const ITEM_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Port of `program/trang-bi/backend-items.mjs#validateCatalog`. Returns every problem instead of
 * throwing on the first one so the editor can highlight them all.
 */
export function validateCatalog(catalog: Pick<ItemCatalog, "categories" | "items">): CatalogProblem[] {
  const problems: CatalogProblem[] = []
  const byId = new Map<string, Item>()
  for (const item of catalog.items) {
    if (byId.has(item.id)) problems.push({ itemId: item.id, kind: "item", message: `Mã trùng: ${item.id}` })
    byId.set(item.id, item)
  }
  const groups = new Set(catalog.categories.map((category) => category.name))

  for (const item of catalog.items) {
    const fail = (kind: CatalogProblem["kind"], message: string) => problems.push({ itemId: item.id, kind, message })
    if (!ITEM_ID.test(item.id)) fail("item", "Mã chỉ gồm chữ thường, số và dấu gạch ngang.")
    if (!item.name.trim()) fail("item", "Tên không được để trống.")
    if (!Number.isInteger(item.price) || item.price < 0) fail("item", "Giá phải là số nguyên không âm.")
    if (![1, 2, 3].includes(item.tier)) fail("item", "Cấp phải là 1, 2 hoặc 3.")
    if (!item.shopPositions.length) fail("position", "Cần ít nhất một vị trí trong shop.")
    for (const position of item.shopPositions) {
      if (!groups.has(position.group)) fail("position", `Nhóm không tồn tại: ${position.group}`)
      for (const value of [position.row, position.column]) {
        if (value !== null && (!Number.isInteger(value) || value < 0))
          fail("position", "Hàng/cột phải là số nguyên không âm.")
      }
    }
    const { status, components } = item.recipe
    if (status !== "verified" && components.length) fail("recipe", "Chỉ công thức đã xác nhận mới có nguyên liệu.")
    if (status === "verified" && !components.length)
      fail("recipe", "Công thức đã xác nhận cần ít nhất một nguyên liệu.")
    const seen = new Set<string>()
    for (const component of components) {
      if (!byId.has(component.itemId)) fail("recipe", `Nguyên liệu không tồn tại: ${component.itemId}`)
      if (component.itemId === item.id) fail("recipe", "Không thể dùng chính món này làm nguyên liệu.")
      if (seen.has(component.itemId)) fail("recipe", `Nguyên liệu bị lặp: ${component.itemId}. Hãy tăng số lượng.`)
      seen.add(component.itemId)
      if (!Number.isInteger(component.quantity) || component.quantity <= 0)
        fail("recipe", "Số lượng phải là số nguyên dương.")
    }
  }

  const done = new Set<string>()
  const active = new Set<string>()
  const visit = (id: string, path: string[]): void => {
    if (active.has(id)) {
      problems.push({ itemId: id, kind: "cycle", message: `Công thức tạo vòng lặp: ${[...path, id].join(" → ")}` })
      return
    }
    if (done.has(id)) return
    const item = byId.get(id)
    if (!item) return
    active.add(id)
    for (const component of item.recipe.components) visit(component.itemId, [...path, id])
    active.delete(id)
    done.add(id)
  }
  for (const item of catalog.items) visit(item.id, [])
  return problems
}

/** Items whose verified recipe uses `itemId`. */
export function buildsInto(items: Item[], itemId: string): Item[] {
  return items.filter(
    (item) =>
      item.recipe.status === "verified" && item.recipe.components.some((component) => component.itemId === itemId),
  )
}

export function componentsCost(items: Item[], components: Item["recipe"]["components"]): number {
  const byId = new Map(items.map((item) => [item.id, item]))
  return components.reduce((sum, component) => sum + (byId.get(component.itemId)?.price ?? 0) * component.quantity, 0)
}

export interface RecipeNode {
  item: Item
  quantity: number
  children: RecipeNode[]
}

/** Expands the verified recipe of `itemId` into a tree; guards against cycles. */
export function recipeTree(items: Item[], itemId: string, quantity = 1, trail: string[] = []): RecipeNode | null {
  const item = items.find((candidate) => candidate.id === itemId)
  if (!item) return null
  if (trail.includes(itemId)) return { item, quantity, children: [] }
  const children = item.recipe.components
    .map((component) => recipeTree(items, component.itemId, component.quantity, [...trail, itemId]))
    .filter((node): node is RecipeNode => node !== null)
  return { item, quantity, children }
}

export function changedItemIds(base: Item[], next: Item[]): string[] {
  const before = new Map(base.map((item) => [item.id, JSON.stringify(item)]))
  return next.filter((item) => before.get(item.id) !== JSON.stringify(item)).map((item) => item.id)
}
