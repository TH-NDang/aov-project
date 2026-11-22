export type ItemLayout = "shop" | "list"

/** Below this width the shop board has no room for its three columns, so the items read as a list. */
export const NARROW_ITEM_LAYOUT = "(max-width: 767px)"

/**
 * How the reader asked to see the items: the address decides, otherwise the shop board where there is room for its
 * three columns and the list on a phone. A link that asks for the grid gets the list.
 */
export function preferredItemLayout(requested: string | null, narrow: boolean): ItemLayout {
  if (requested === "list" || requested === "grid") return "list"
  return requested === "shop" || !narrow ? "shop" : "list"
}
